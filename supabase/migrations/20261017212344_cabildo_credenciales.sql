begin;

create table public.cabildo_credenciales (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.cabildo_configuracion(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  usado boolean not null default false,
  usado_en timestamptz default null,
  creado_en timestamptz not null default now(),
  constraint credencial_uso_consistente check (
    (not usado and usado_en is null) or (usado and usado_en is not null)
  )
);
create index credenciales_evento_estado_idx on public.cabildo_credenciales(evento_id, usado);
alter table public.cabildo_credenciales enable row level security;
revoke all on public.cabildo_credenciales from public, anon, authenticated;
grant select on public.cabildo_credenciales to authenticated;

create policy credenciales_admin_lectura on public.cabildo_credenciales
for select to authenticated using (exists (
  select 1 from public.cabildo_configuracion c
  where c.id = evento_id and c.administrador_id = (select auth.uid())
));

create function public.resumen_credenciales(p_evento uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select (
    select jsonb_build_object(
      'total', count(*),
      'disponibles', count(*) filter (where not usado),
      'utilizadas', count(*) filter (where usado)
    ) from public.cabildo_credenciales where evento_id = c.id
  ) from public.cabildo_configuracion c
  where c.id = p_evento and c.administrador_id = (select auth.uid());
$$;
revoke all on function public.resumen_credenciales(uuid) from public, anon, authenticated;
grant execute on function public.resumen_credenciales(uuid) to authenticated;

-- Escritura privilegiada acotada al esquema privado existente, no expuesto.
-- No recibe ni genera tokens: únicamente hashes calculados en Node.js.
create function cabildo_privado.generar_credenciales(p_evento uuid, p_hashes text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  evento public.cabildo_configuracion%rowtype;
  anteriores bigint;
  resumen jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Acceso no autorizado.';
  end if;
  select * into evento from public.cabildo_configuracion where id = p_evento for update;
  if not found or evento.administrador_id is distinct from auth.uid()
    or evento.estado <> 'preparacion' then
    raise exception using errcode = '42501', message = 'Acceso no autorizado o evento fuera de preparación.';
  end if;
  if p_hashes is null or array_ndims(p_hashes) is distinct from 1
    or cardinality(p_hashes) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'El lote debe contener entre 1 y 100 hashes.';
  end if;
  if exists (select 1 from unnest(p_hashes) h where h is null or h !~ '^[0-9a-f]{64}$')
    or (select count(distinct h) from unnest(p_hashes) h) <> cardinality(p_hashes) then
    raise exception using errcode = '22023', message = 'El lote contiene hashes inválidos o duplicados.';
  end if;
  select count(*) into anteriores from public.cabildo_credenciales where evento_id = p_evento;
  -- Un único INSERT; un hash repetido en la tabla revierte TODO el lote.
  insert into public.cabildo_credenciales(evento_id, token_hash)
    select p_evento, h from unnest(p_hashes) h;
  select jsonb_build_object(
    'total', count(*),
    'disponibles', count(*) filter (where not usado),
    'utilizadas', count(*) filter (where usado)
  ) into resumen from public.cabildo_credenciales where evento_id = p_evento;
  return jsonb_build_object('primero', anteriores + 1, 'resumen', resumen);
end;
$$;
revoke all on function cabildo_privado.generar_credenciales(uuid, text[]) from public, anon, authenticated;
grant execute on function cabildo_privado.generar_credenciales(uuid, text[]) to authenticated;

create function public.generar_credenciales(p_evento uuid, p_hashes text[])
returns jsonb language sql security invoker set search_path = '' as $$
  select cabildo_privado.generar_credenciales(p_evento, p_hashes);
$$;
revoke all on function public.generar_credenciales(uuid, text[]) from public, anon, authenticated;
grant execute on function public.generar_credenciales(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';
commit;
