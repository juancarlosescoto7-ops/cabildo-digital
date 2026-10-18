begin;

-- No se crean tablas de respuestas ni vínculos entre opciones y credenciales.
-- El rol del secreto del servidor tiene acceso explícito y acotado a estas tablas.
revoke all on public.cabildo_configuracion, public.cabildo_preguntas,
  public.cabildo_opciones, public.cabildo_credenciales from service_role;
grant usage on schema public to service_role;
grant select on public.cabildo_configuracion, public.cabildo_preguntas,
  public.cabildo_opciones, public.cabildo_credenciales to service_role;
grant update(version) on public.cabildo_configuracion to service_role; -- SELECT FOR SHARE
grant update(votos) on public.cabildo_opciones to service_role;
grant update(usado, usado_en) on public.cabildo_credenciales to service_role;

create function cabildo_privado.validar_transicion_consulta()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if NEW.estado = OLD.estado then return NEW; end if;
  if not ((OLD.estado = 'preparacion' and NEW.estado = 'abierta')
    or (OLD.estado = 'abierta' and NEW.estado = 'cerrada')) then
    raise exception using errcode = '22023', message = 'El cierre es definitivo y no se puede volver a preparación.';
  end if;
  if NEW.estado = 'abierta' then
    if not exists (select 1 from public.cabildo_preguntas where configuracion_id = OLD.id)
      or exists (
        select 1 from public.cabildo_preguntas p where p.configuracion_id = OLD.id
        and (p.texto !~ '[^[:space:]]' or
          (select count(*) from public.cabildo_opciones o where o.pregunta_id = p.id) < 2)
      ) or exists (
        select 1 from public.cabildo_opciones o join public.cabildo_preguntas p on p.id = o.pregunta_id
        where p.configuracion_id = OLD.id and o.texto !~ '[^[:space:]]'
      ) or not exists (select 1 from public.cabildo_credenciales where evento_id = OLD.id) then
      raise exception using errcode = '22023', message = 'Antes de abrir se necesitan preguntas, opciones válidas y credenciales generadas.';
    end if;
  end if;
  return NEW;
end;
$$;
revoke all on function cabildo_privado.validar_transicion_consulta() from public, anon, authenticated;
create trigger validar_transicion_consulta before update of estado on public.cabildo_configuracion
for each row execute function cabildo_privado.validar_transicion_consulta();

create function cabildo_privado.cambiar_estado_consulta(p_evento uuid, p_estado text)
returns text language plpgsql security definer set search_path = '' as $$
declare evento public.cabildo_configuracion%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Acceso no autorizado.'; end if;
  select * into evento from public.cabildo_configuracion where id = p_evento for update;
  if not found or evento.administrador_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Acceso no autorizado.';
  end if;
  if p_estado is null or p_estado not in ('abierta', 'cerrada') then
    raise exception using errcode = '22023', message = 'Estado de destino inválido.';
  end if;
  if not ((evento.estado = 'preparacion' and p_estado = 'abierta')
    or (evento.estado = 'abierta' and p_estado = 'cerrada')) then
    raise exception using errcode = '22023', message = 'La transición no está permitida; el cierre es definitivo.';
  end if;
  update public.cabildo_configuracion set estado = p_estado where id = p_evento;
  return p_estado;
end;
$$;
revoke all on function cabildo_privado.cambiar_estado_consulta(uuid, text) from public, anon, authenticated;
grant execute on function cabildo_privado.cambiar_estado_consulta(uuid, text) to authenticated;
create function public.cambiar_estado_consulta(p_evento uuid, p_estado text)
returns text language sql security invoker set search_path = '' as $$
  select cabildo_privado.cambiar_estado_consulta(p_evento, p_estado);
$$;
revoke all on function public.cambiar_estado_consulta(uuid, text) from public, anon, authenticated;
grant execute on function public.cambiar_estado_consulta(uuid, text) to authenticated;

-- Solo el backend con clave secreta puede leer una papeleta por hash. No devuelve votos.
create function public.leer_papeleta(p_hash text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('titulo', c.titulo, 'estado',
      case when k.usado then 'utilizada' when c.estado = 'abierta' then 'lista' else c.estado end,
      'preguntas', case when c.estado = 'abierta' and not k.usado then (
        select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'texto', p.texto,
          'opciones', (select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto) order by o.orden)
            from public.cabildo_opciones o where o.pregunta_id = p.id)
        ) order by p.orden), '[]'::jsonb)
        from public.cabildo_preguntas p where p.configuracion_id = c.id
      ) else '[]'::jsonb end)
    from public.cabildo_credenciales k join public.cabildo_configuracion c on c.id = k.evento_id
    where k.token_hash = p_hash and p_hash ~ '^[0-9a-f]{64}$'
  ), '{"estado":"invalida","preguntas":[]}'::jsonb);
$$;
revoke all on function public.leer_papeleta(text) from public, anon, authenticated;
grant execute on function public.leer_papeleta(text) to service_role;

create function public.registrar_votacion(p_hash text, p_respuestas jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  evento public.cabildo_configuracion%rowtype;
  credencial public.cabildo_credenciales%rowtype;
  respuesta jsonb;
  esperadas integer;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'CV001', message = 'Credencial inválida.';
  end if;
  -- Orden global de bloqueos: evento SHARE -> credencial UPDATE -> opciones por UUID.
  -- SHARE permite otros votantes y espera a cualquier cambio de estado del administrador.
  select c.* into evento from public.cabildo_configuracion c
    where c.id = (select evento_id from public.cabildo_credenciales where token_hash = p_hash)
    for share;
  if not found then raise exception using errcode = 'CV001', message = 'Credencial inválida.'; end if;
  if evento.estado <> 'abierta' then
    raise exception using errcode = 'CV003', message = 'La consulta no está abierta.';
  end if;
  select * into credencial from public.cabildo_credenciales
    where token_hash = p_hash and evento_id = evento.id for update;
  if not found then raise exception using errcode = 'CV001', message = 'Credencial inválida.'; end if;
  if credencial.usado then raise exception using errcode = 'CV002', message = 'La credencial ya fue utilizada.'; end if;
  if jsonb_typeof(p_respuestas) is distinct from 'array' then
    raise exception using errcode = 'CV004', message = 'Las respuestas deben ser una lista completa.';
  end if;
  select count(*) into esperadas from public.cabildo_preguntas where configuracion_id = evento.id;
  if esperadas = 0 or jsonb_array_length(p_respuestas) <> esperadas then
    raise exception using errcode = 'CV004', message = 'Respondé exactamente una vez cada pregunta.';
  end if;
  for respuesta in select value from jsonb_array_elements(p_respuestas) loop
    if jsonb_typeof(respuesta) is distinct from 'object'
      or jsonb_typeof(respuesta->'pregunta_id') is distinct from 'string'
      or jsonb_typeof(respuesta->'opcion_id') is distinct from 'string'
      or (respuesta->>'pregunta_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (respuesta->>'opcion_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'CV004', message = 'Formato de respuesta inválido.';
    end if;
  end loop;
  if (select count(distinct (r->>'pregunta_id')::uuid) from jsonb_array_elements(p_respuestas) r) <> esperadas
    or (select count(*) from jsonb_array_elements(p_respuestas) r
      join public.cabildo_preguntas p on p.id = (r->>'pregunta_id')::uuid and p.configuracion_id = evento.id
      join public.cabildo_opciones o on o.id = (r->>'opcion_id')::uuid and o.pregunta_id = p.id) <> esperadas then
    raise exception using errcode = 'CV004', message = 'Preguntas duplicadas, ajenas u opciones inválidas.';
  end if;
  -- Orden fijo para evitar deadlocks incluso si se altera el orden del JSON.
  perform o.id from public.cabildo_opciones o
    join jsonb_array_elements(p_respuestas) r on o.id = (r->>'opcion_id')::uuid
    order by o.id for update of o;
  update public.cabildo_opciones o set votos = o.votos + 1
    from jsonb_array_elements(p_respuestas) r where o.id = (r->>'opcion_id')::uuid;
  update public.cabildo_credenciales set usado = true, usado_en = clock_timestamp() where id = credencial.id;
  -- No se inserta un historial ni se conserva la selección de esta credencial.
end;
$$;
revoke all on function public.registrar_votacion(text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_votacion(text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
