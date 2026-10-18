-- Ejecutar con SQL Editor después de aplicar la migración y asignar administrador.
-- Simula roles reales de la Data API dentro de una transacción que se revierte.
begin;

do $$ begin
  if not exists (select 1 from public.cabildo_configuracion
    where administrador_id is not null and estado = 'preparacion') then
    raise exception 'Asigná el administrador y mantené el evento en preparación antes de probar.';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', administrador_id, 'role', 'authenticated')::text, true)
from public.cabildo_configuracion;
set local role authenticated;

do $$
declare e public.cabildo_configuracion%rowtype; v integer;
begin
  select * into strict e from public.cabildo_configuracion;
  v := public.guardar_cabildo(e.id, e.version,
    '[{"id":"11111111-1111-4111-8111-111111111111","texto":"Pregunta de prueba","opciones":["Sí","No"]}]');
  if (select count(*) from public.cabildo_preguntas) <> 1
    or (select count(*) from public.cabildo_opciones) <> 2 then
    raise exception 'Falló la creación.';
  end if;
  begin
    perform public.guardar_cabildo(e.id, e.version, '[]');
    raise exception 'Se aceptó una versión desactualizada.';
  exception when serialization_failure then null; end;
  begin
    perform public.guardar_cabildo(e.id, v,
      '[{"id":"11111111-1111-4111-8111-111111111111","texto":"Inválida","opciones":[" ","No"]}]');
    raise exception 'Se aceptó una opción vacía.';
  exception when invalid_parameter_value then null; end;
  if (select version from public.cabildo_configuracion) <> v
    or (select texto from public.cabildo_preguntas) <> 'Pregunta de prueba' then
    raise exception 'Un guardado inválido alteró datos.';
  end if;
  v := public.guardar_cabildo(e.id, v,
    '[{"id":"11111111-1111-4111-8111-111111111111","texto":"Pregunta editada","opciones":["Alternativa editada","Otra"]}]');
  if (select texto from public.cabildo_preguntas) <> 'Pregunta editada' then
    raise exception 'Falló la edición.';
  end if;
  v := public.guardar_cabildo(e.id, v, '[]');
  if exists (select 1 from public.cabildo_preguntas)
    or exists (select 1 from public.cabildo_opciones) then
    raise exception 'Falló la eliminación en cascada.';
  end if;
  begin
    delete from public.cabildo_preguntas;
    raise exception 'Se permitió escritura directa.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
update public.cabildo_configuracion set estado = 'abierta';
set local role authenticated;
do $$ declare e public.cabildo_configuracion%rowtype; begin
  select * into strict e from public.cabildo_configuracion;
  begin
    perform public.guardar_cabildo(e.id, e.version, '[]');
    raise exception 'Se permitió guardar fuera de preparación.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.cabildo_configuracion)
    or exists (select 1 from public.cabildo_preguntas)
    or exists (select 1 from public.cabildo_opciones) then
    raise exception 'RLS permitió leer a otra cuenta.';
  end if;
  begin
    perform public.guardar_cabildo('00000000-0000-4000-8000-000000000001', 0, '[]');
    raise exception 'Se permitió guardar a otra cuenta.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    perform 1 from public.cabildo_configuracion;
    raise exception 'Se permitió lectura anónima.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guardar_cabildo('00000000-0000-4000-8000-000000000001', 0, '[]');
    raise exception 'Se permitió guardar sin sesión.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
select 'Pruebas SQL completadas; cambios revertidos.' as resultado;
