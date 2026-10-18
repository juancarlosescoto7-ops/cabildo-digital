begin;

-- Un único evento. El administrador se asigna después desde SQL Editor.
create table public.cabildo_configuracion (
  id uuid primary key default gen_random_uuid(),
  unico boolean not null default true unique check (unico),
  titulo text not null default 'Cabildo abierto de Talanga'
    check (char_length(btrim(titulo)) between 1 and 200 and titulo ~ '[^[:space:]]'),
  estado text not null default 'preparacion'
    check (estado in ('preparacion', 'abierta', 'cerrada')),
  administrador_id uuid references auth.users(id) on delete restrict,
  version integer not null default 0 check (version >= 0)
);

create table public.cabildo_preguntas (
  id uuid primary key default gen_random_uuid(),
  configuracion_id uuid not null references public.cabildo_configuracion(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000 and texto ~ '[^[:space:]]'),
  orden integer not null default 0 check (orden >= 0),
  unique (configuracion_id, orden)
);

create table public.cabildo_opciones (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null references public.cabildo_preguntas(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500 and texto ~ '[^[:space:]]'),
  orden integer not null default 0 check (orden >= 0),
  votos integer not null default 0 check (votos >= 0),
  unique (pregunta_id, orden)
);

-- Los índices UNIQUE anteriores también cubren las FK y el orden de lectura.
create index cabildo_administrador_idx on public.cabildo_configuracion(administrador_id);

alter table public.cabildo_configuracion enable row level security;
alter table public.cabildo_preguntas enable row level security;
alter table public.cabildo_opciones enable row level security;

-- Permisos explícitos: no depender de los defaults históricos de la Data API.
revoke all on public.cabildo_configuracion, public.cabildo_preguntas,
  public.cabildo_opciones from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.cabildo_configuracion, public.cabildo_preguntas,
  public.cabildo_opciones to authenticated;

create policy configuracion_admin_lectura on public.cabildo_configuracion
for select to authenticated using (administrador_id = (select auth.uid()));

create policy preguntas_admin_lectura on public.cabildo_preguntas
for select to authenticated using (exists (
  select 1 from public.cabildo_configuracion c
  where c.id = configuracion_id and c.administrador_id = (select auth.uid())
));

create policy opciones_admin_lectura on public.cabildo_opciones
for select to authenticated using (exists (
  select 1 from public.cabildo_preguntas p
  join public.cabildo_configuracion c on c.id = p.configuracion_id
  where p.id = pregunta_id and c.administrador_id = (select auth.uid())
));

create schema if not exists cabildo_privado;
revoke all on schema cabildo_privado from public, anon, authenticated;
grant usage on schema cabildo_privado to authenticated;

-- Restricción diferida: comprueba el resultado completo al terminar la transacción.
create function cabildo_privado.comprobar_opciones()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  ids uuid[];
  pregunta uuid;
begin
  if TG_TABLE_NAME = 'cabildo_preguntas' then
    ids := array[NEW.id];
  elsif TG_OP = 'DELETE' then
    ids := array[OLD.pregunta_id];
  elsif TG_OP = 'UPDATE' then
    ids := array[OLD.pregunta_id, NEW.pregunta_id];
  else
    ids := array[NEW.pregunta_id];
  end if;
  foreach pregunta in array ids loop
    if exists (select 1 from public.cabildo_preguntas where id = pregunta)
      and (select count(*) from public.cabildo_opciones where pregunta_id = pregunta) < 2 then
      raise exception using errcode = '23514', message = 'Cada pregunta debe tener al menos dos opciones.';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function cabildo_privado.comprobar_opciones() from public, anon, authenticated;

create constraint trigger pregunta_minimo_opciones
after insert or update on public.cabildo_preguntas
deferrable initially deferred for each row
execute function cabildo_privado.comprobar_opciones();

create constraint trigger opciones_minimas
after insert or update or delete on public.cabildo_opciones
deferrable initially deferred for each row
execute function cabildo_privado.comprobar_opciones();

-- Función privilegiada en esquema NO expuesto. Necesaria porque las cuentas
-- autenticadas no tienen DML directo sobre las tablas. Verifica identidad,
-- estado y versión antes de toda escritura; no confía en user_metadata.
create function cabildo_privado.guardar_cabildo(
  p_evento uuid, p_version integer, p_preguntas jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  evento public.cabildo_configuracion%rowtype;
  pregunta jsonb;
  opcion jsonb;
  pregunta_id uuid;
  ids uuid[] := array[]::uuid[];
  orden_p integer := 0;
  orden_o integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Acceso no autorizado.';
  end if;
  select * into evento from public.cabildo_configuracion
    where id = p_evento for update;
  if not found or evento.administrador_id is distinct from auth.uid()
    or evento.estado <> 'preparacion' then
    raise exception using errcode = '42501', message = 'Acceso no autorizado o evento fuera de preparación.';
  end if;
  if p_version is distinct from evento.version then
    raise exception using errcode = '40001', message = 'La configuración fue modificada desde otra sesión.';
  end if;
  if jsonb_typeof(p_preguntas) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'La configuración debe ser una lista.';
  end if;
  if jsonb_array_length(p_preguntas) > 100 then
    raise exception using errcode = '22023', message = 'Máximo 100 preguntas.';
  end if;

  -- Validación completa ANTES de borrar. Cualquier error posterior también
  -- revierte toda la operación, incluidos borrados, inserciones y versión.
  for pregunta in select value from jsonb_array_elements(p_preguntas) loop
    if jsonb_typeof(pregunta) is distinct from 'object'
      or jsonb_typeof(pregunta->'id') is distinct from 'string'
      or jsonb_typeof(pregunta->'texto') is distinct from 'string'
      or char_length(btrim(pregunta->>'texto')) not between 1 and 2000
      or (pregunta->>'texto') !~ '[^[:space:]]'
      or char_length(pregunta->>'texto') > 2000
      or jsonb_typeof(pregunta->'opciones') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Pregunta inválida.';
    end if;
    pregunta_id := (pregunta->>'id')::uuid;
    if pregunta_id = any(ids) then
      raise exception using errcode = '22023', message = 'Identificador duplicado.';
    end if;
    ids := array_append(ids, pregunta_id);
    if jsonb_array_length(pregunta->'opciones') not between 2 and 20 then
      raise exception using errcode = '22023', message = 'Cada pregunta debe tener entre 2 y 20 opciones.';
    end if;
    for opcion in select value from jsonb_array_elements(pregunta->'opciones') loop
      if jsonb_typeof(opcion) is distinct from 'string'
        or char_length(btrim(opcion #>> '{}')) not between 1 and 500
        or (opcion #>> '{}') !~ '[^[:space:]]'
        or char_length(opcion #>> '{}') > 500 then
        raise exception using errcode = '22023', message = 'Opción vacía o inválida.';
      end if;
    end loop;
  end loop;

  delete from public.cabildo_preguntas where configuracion_id = p_evento;
  for pregunta in select value from jsonb_array_elements(p_preguntas) loop
    pregunta_id := (pregunta->>'id')::uuid;
    insert into public.cabildo_preguntas(id, configuracion_id, texto, orden)
    values (pregunta_id, p_evento, btrim(pregunta->>'texto'), orden_p);
    orden_o := 0;
    for opcion in select value from jsonb_array_elements(pregunta->'opciones') loop
      insert into public.cabildo_opciones(pregunta_id, texto, orden)
      values (pregunta_id, btrim(opcion #>> '{}'), orden_o);
      orden_o := orden_o + 1;
    end loop;
    orden_p := orden_p + 1;
  end loop;
  update public.cabildo_configuracion set version = version + 1
    where id = p_evento returning version into p_version;
  return p_version;
end;
$$;
revoke all on function cabildo_privado.guardar_cabildo(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function cabildo_privado.guardar_cabildo(uuid, integer, jsonb) to authenticated;

-- Única entrada de escritura expuesta; no eleva privilegios por sí misma.
create function public.guardar_cabildo(p_evento uuid, p_version integer, p_preguntas jsonb)
returns integer language sql security invoker set search_path = '' as $$
  select cabildo_privado.guardar_cabildo(p_evento, p_version, p_preguntas);
$$;
revoke all on function public.guardar_cabildo(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_cabildo(uuid, integer, jsonb) to authenticated;

insert into public.cabildo_configuracion(id, titulo)
values ('00000000-0000-4000-8000-000000000001', 'Cabildo abierto de Talanga');

notify pgrst, 'reload schema';
commit;
