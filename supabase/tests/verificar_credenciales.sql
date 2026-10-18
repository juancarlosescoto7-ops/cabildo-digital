-- Aplicar primero ambas migraciones y asignar un administrador.
-- Ejecutar COMPLETO como postgres en SQL Editor. No guarda cambios de prueba.
begin;
do $$ begin
  if not exists (select 1 from public.cabildo_configuracion
    where administrador_id is not null and estado = 'preparacion') then
    raise exception 'Asigná un administrador y mantené el evento en preparación.';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', administrador_id, 'role', 'authenticated')::text, true)
from public.cabildo_configuracion;
set local role authenticated;

do $$
declare
  e uuid; antes bigint; respuesta jsonb; resumen jsonb;
  h1 text := encode(sha256(gen_random_uuid()::text::bytea), 'hex');
  h2 text := encode(sha256(gen_random_uuid()::text::bytea), 'hex');
  h3 text := encode(sha256(gen_random_uuid()::text::bytea), 'hex');
begin
  select id into strict e from public.cabildo_configuracion;
  select count(*) into antes from public.cabildo_credenciales;
  respuesta := public.generar_credenciales(e, array[h1, h2]);
  resumen := public.resumen_credenciales(e);
  if (select count(*) from public.cabildo_credenciales) <> antes + 2
    or (respuesta->>'primero')::bigint <> antes + 1
    or (resumen->>'total')::bigint <> antes + 2
    or resumen <> respuesta->'resumen'
    or (resumen->>'disponibles')::bigint + (resumen->>'utilizadas')::bigint <> antes + 2 then
    raise exception 'Falló la generación o los contadores.';
  end if;
  if (select count(*) from public.cabildo_credenciales
    where token_hash in (h1, h2) and not usado and usado_en is null) <> 2 then
    raise exception 'Los hashes o los valores iniciales son incorrectos.';
  end if;
  begin
    -- h3 es nuevo; h1 ya existe. La violación UNIQUE debe revertir todo el lote.
    perform public.generar_credenciales(e, array[h3, h1]);
    raise exception 'Se aceptó un hash ya existente.';
  exception when unique_violation then null; end;
  if exists (select 1 from public.cabildo_credenciales where token_hash = h3)
    or (select count(*) from public.cabildo_credenciales) <> antes + 2 then
    raise exception 'Un lote fallido dejó filas parciales.';
  end if;
  begin
    perform public.generar_credenciales(e, array[h3, h3]);
    raise exception 'Se aceptó un lote duplicado.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.generar_credenciales(e, array[]::text[]);
    raise exception 'Se aceptó un lote vacío.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.generar_credenciales(e, array_fill(h3, array[101]));
    raise exception 'Se aceptó un lote demasiado grande.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.generar_credenciales(e, array['token-en-claro']);
    raise exception 'Se aceptó un valor que no es un hash SHA-256.';
  exception when invalid_parameter_value then null; end;
  begin
    update public.cabildo_credenciales set usado = true, usado_en = now();
    raise exception 'Se permitió consumir credenciales directamente.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
savepoint probar_estados;
update public.cabildo_configuracion set estado = 'abierta';
set local role authenticated;
do $$ declare e uuid; begin
  select id into strict e from public.cabildo_configuracion;
  begin
    perform public.generar_credenciales(e, array[repeat('a',64)]);
    raise exception 'Se generó con evento abierto.';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.cabildo_configuracion set estado = 'cerrada';
set local role authenticated;
do $$ declare e uuid; begin
  select id into strict e from public.cabildo_configuracion;
  begin
    perform public.generar_credenciales(e, array[repeat('a',64)]);
    raise exception 'Se generó con evento cerrado.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback to savepoint probar_estados;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.cabildo_credenciales) then
    raise exception 'Una cuenta no autorizada leyó credenciales.';
  end if;
  if public.resumen_credenciales('00000000-0000-4000-8000-000000000001') is not null then
    raise exception 'Una cuenta no autorizada leyó los contadores.';
  end if;
  begin
    perform public.generar_credenciales('00000000-0000-4000-8000-000000000001', array[repeat('a',64)]);
    raise exception 'Una cuenta no autorizada generó credenciales.';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    perform token_hash from public.cabildo_credenciales;
    raise exception 'Se permitió lectura pública de hashes.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.generar_credenciales('00000000-0000-4000-8000-000000000001', array[repeat('a',64)]);
    raise exception 'Se permitió generación anónima.';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Pruebas de credenciales completadas; cambios revertidos.' as resultado;
