import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as esperar } from "node:timers/promises";
import pg from "pg";
import { prepararResultados } from "../src/lib/resultados.ts";

const conexion = process.env.CABILDO_TEST_DATABASE_URL;

test("PostgreSQL aislado: transacciones, permisos y concurrencia", { skip: !conexion }, async (t) => {
  // Nunca ejecutar este arnés contra Supabase ni contra una base con datos reales.
  const url = new URL(conexion);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Se requiere un PostgreSQL local de pruebas");
  assert.match(url.pathname, /^\/cabildo_test_[a-zA-Z0-9_]+$/);
  const clientes = [];
  async function conectar(rol, nombre) {
    const c = new pg.Client({ connectionString: conexion, application_name: nombre, query_timeout: 15000 });
    await c.connect(); clientes.push(c);
    if (rol) await c.query(`set role ${rol}`);
    return c;
  }
  const db = await conectar(null, "cabildo-test-owner");
  try {
    const existentes = await db.query("select count(*)::int n from information_schema.tables where table_schema in ('public','auth')");
    assert.equal(existentes.rows[0].n, 0, "La base debe estar vacía; no se borra ningún dato existente");
    await db.query(`
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
      $$;
      grant usage on schema auth to public;
    `);
    for (const archivo of ["20261017171448_cabildo_inicial.sql", "20261017212344_cabildo_credenciales.sql", "20261017215744_cabildo_votacion.sql"]) {
      await db.query(await readFile(new URL(`../supabase/migrations/${archivo}`, import.meta.url), "utf8"));
    }
    const evento = "00000000-0000-4000-8000-000000000001";
    const administrador = "99999999-9999-4999-8999-999999999999";
    await db.query("insert into auth.users(id) values ($1)", [administrador]);
    await db.query("update public.cabildo_configuracion set administrador_id=$1", [administrador]);
    const admin = await conectar("authenticated", "cabildo-test-admin");
    await admin.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:administrador,role:"authenticated"})]);
    const a = await conectar("service_role", "cabildo-test-a");
    const b = await conectar("service_role", "cabildo-test-b");
    const abrir = () => admin.query("select public.cambiar_estado_consulta($1,'abierta')", [evento]);
    const hashes = Array.from({length:10}, (_,i)=>(i+1).toString(16).padStart(64,"0"));
    const votar = (c, hash, respuestas) => c.query("select public.registrar_votacion($1,$2::jsonb)", [hash, JSON.stringify(respuestas)]);
    const rechaza = (operacion, codigo) => assert.rejects(operacion, e => e.code === codigo);
    const snapshot = async () => (await db.query("select id,votos from public.cabildo_opciones order by id")).rows;
    const resultadosPublicos = async () => {
      const r = await db.query(`select json_build_object(
        'titulo',c.titulo,'estado',c.estado,
        'cabildo_credenciales',json_build_array(json_build_object('count',(select count(*) from public.cabildo_credenciales where usado))),
        'cabildo_preguntas',(select json_agg(json_build_object('texto',p.texto,'orden',p.orden,
          'cabildo_opciones',(select json_agg(json_build_object('texto',o.texto,'orden',o.orden,'votos',o.votos)) from public.cabildo_opciones o where o.pregunta_id=p.id))) from public.cabildo_preguntas p)
      ) datos from public.cabildo_configuracion c`);
      return prepararResultados(r.rows[0].datos);
    };
    const usada = async hash => (await db.query("select usado,usado_en from public.cabildo_credenciales where token_hash=$1",[hash])).rows[0];
    const preguntas = [
      {id:"11111111-1111-4111-8111-111111111111",texto:"Primera",opciones:["Sí","No"]},
      {id:"22222222-2222-4222-8222-222222222222",texto:"Segunda",opciones:["Sí","No"]},
    ];
    await t.test("no abre sin preguntas o sin credenciales", async()=>{
      await rechaza(abrir(),"22023");
      await admin.query("select public.guardar_cabildo($1,0,$2::jsonb)",[evento,JSON.stringify(preguntas)]);
      await rechaza(abrir(),"22023");
    });
    await admin.query("select public.generar_credenciales($1,$2::text[])",[evento,hashes]);
    const opciones=(await db.query("select o.id,o.pregunta_id from public.cabildo_opciones o join public.cabildo_preguntas p on p.id=o.pregunta_id order by p.orden,o.orden")).rows;
    const respuestas=[{pregunta_id:preguntas[0].id,opcion_id:opciones[0].id},{pregunta_id:preguntas[1].id,opcion_id:opciones[2].id}];
    await t.test("leer y rechazar un voto en preparación no consume el QR",async()=>{
      const lectura=await a.query("select public.leer_papeleta($1) p",[hashes[0]]);
      assert.equal(lectura.rows[0].p.estado,"preparacion");
      await rechaza(votar(a,hashes[0],respuestas),"CV003");
      assert.equal((await usada(hashes[0])).usado,false);
    });
    await abrir();
    await t.test("papeleta ordenada sin contadores; GET lógico no consume",async()=>{
      const p=(await a.query("select public.leer_papeleta($1) p",[hashes[0]])).rows[0].p;
      assert.equal(p.estado,"lista");
      assert.deepEqual(p.preguntas.map(p=>p.texto),["Primera","Segunda"]);
      assert.equal(JSON.stringify(p).includes('"votos"'),false);
      assert.equal((await usada(hashes[0])).usado,false);
    });
    await t.test("incompleta, opción ajena, duplicada e inexistente no alteran nada",async()=>{
      const antes=await snapshot();
      for (const r of [respuestas.slice(0,1),[respuestas[0],respuestas[0]],[{...respuestas[0],opcion_id:opciones[2].id},respuestas[1]],[{...respuestas[0],opcion_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},respuestas[1]]]) await rechaza(votar(a,hashes[0],r),"CV004");
      await rechaza(votar(a,"f".repeat(64),respuestas),"CV001");
      assert.deepEqual(await snapshot(),antes); assert.equal((await usada(hashes[0])).usado,false);
    });
    await t.test("vota una vez, actualiza solo las opciones elegidas y rechaza repetición",async()=>{
      const sinVotos=await resultadosPublicos();
      assert.equal(sinVotos.participaciones,0);
      assert.ok(sinVotos.preguntas.every(p=>p.total===0));
      await votar(a,hashes[0],respuestas);
      for(const o of await snapshot()) assert.equal(o.votos,respuestas.some(r=>r.opcion_id===o.id)?1:0);
      assert.equal((await usada(hashes[0])).usado,true); assert.ok((await usada(hashes[0])).usado_en);
      const publicados=await resultadosPublicos();
      assert.equal(publicados.participaciones,1);
      assert.ok(publicados.preguntas.every(p=>p.total===1));
      const antes=await snapshot(); await rechaza(votar(a,hashes[0],respuestas),"CV002"); assert.deepEqual(await snapshot(),antes);
      assert.deepEqual(await resultadosPublicos(),publicados);
      assert.equal((await a.query("select public.leer_papeleta($1) p",[hashes[0]])).rows[0].p.estado,"utilizada");
    });
    async function esperarBloqueados() {
      for(let i=0;i<80;i++) {
        const r=await db.query("select count(*)::int n from pg_stat_activity where application_name in ('cabildo-test-a','cabildo-test-b') and wait_event_type='Lock'");
        if(r.rows[0].n===2)return;
        await esperar(25);
      }
      throw new Error("Ambas solicitudes deben estar simultáneamente bloqueadas");
    }
    await t.test("mismo QR simultáneo registra exactamente una votación",async()=>{
      const antes=await snapshot(); await db.query("begin");
      await db.query("select id from public.cabildo_credenciales where token_hash=$1 for update",[hashes[1]]);
      const trabajos=Promise.allSettled([votar(a,hashes[1],respuestas),votar(b,hashes[1],respuestas)]);
      try { await esperarBloqueados(); } finally { await db.query("commit"); }
      const resultados=await trabajos;
      assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(resultados.find(r=>r.status==='rejected').reason.code,"CV002");
      for(const o of await snapshot()) assert.equal(o.votos,antes.find(x=>x.id===o.id).votos+(respuestas.some(r=>r.opcion_id===o.id)?1:0));
    });
    await t.test("dos QR simultáneos no pierden incrementos ni causan deadlock",async()=>{
      const antes=await snapshot(); await db.query("begin");
      const primera=respuestas.map(r=>r.opcion_id).sort()[0];
      await db.query("select id from public.cabildo_opciones where id=$1 for update",[primera]);
      const trabajos=Promise.allSettled([votar(a,hashes[2],respuestas),votar(b,hashes[3],[...respuestas].reverse())]);
      try { await esperarBloqueados(); } finally { await db.query("commit"); }
      for(const resultado of await trabajos) assert.equal(resultado.status,'fulfilled');
      for(const o of await snapshot()) assert.equal(o.votos,antes.find(x=>x.id===o.id).votos+(respuestas.some(r=>r.opcion_id===o.id)?2:0));
    });
    await t.test("un error de escritura revierte contadores y uso de la credencial",async()=>{
      const original=(await db.query("select votos from public.cabildo_opciones where id=$1",[opciones[2].id])).rows[0].votos;
      await db.query("update public.cabildo_opciones set votos=2147483647 where id=$1",[opciones[2].id]);
      const antes=await snapshot(); await rechaza(votar(a,hashes[4],respuestas),"22003");
      assert.deepEqual(await snapshot(),antes); assert.equal((await usada(hashes[4])).usado,false);
      await db.query("update public.cabildo_opciones set votos=$1 where id=$2",[original,opciones[2].id]);
    });
    await t.test("bloquea editar preguntas y generar QR después de abrir",async()=>{
      await rechaza(admin.query("select public.guardar_cabildo($1,1,$2::jsonb)",[evento,JSON.stringify(preguntas)]),"42501");
      await rechaza(admin.query("select public.generar_credenciales($1,$2::text[])",[evento,["a".repeat(64)]]),"42501");
    });
    await t.test("RPC ciudadanas solo para service_role; RLS permanece activa",async()=>{
      for(const rol of ['anon','authenticated']) {
        for(const firma of ['public.leer_papeleta(text)','public.registrar_votacion(text,jsonb)']) assert.equal((await db.query("select has_function_privilege($1,$2,'execute') p",[rol,firma])).rows[0].p,false);
      }
      const anon=await conectar("anon","cabildo-test-anon");
      await rechaza(anon.query("select public.registrar_votacion($1,$2::jsonb)",[hashes[5],JSON.stringify(respuestas)]),"42501");
      const otro=await conectar("authenticated","cabildo-test-otro");
      await otro.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:"88888888-8888-4888-8888-888888888888"})]);
      await rechaza(otro.query("select public.cambiar_estado_consulta($1,'cerrada')",[evento]),"42501");
      assert.equal((await db.query("select bool_and(relrowsecurity) r from pg_class where oid in ('public.cabildo_configuracion'::regclass,'public.cabildo_preguntas'::regclass,'public.cabildo_opciones'::regclass,'public.cabildo_credenciales'::regclass)")).rows[0].r,true);
      const tablas=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
      assert.deepEqual(tablas,['cabildo_configuracion','cabildo_credenciales','cabildo_opciones','cabildo_preguntas']);
    });
    await t.test("cierre definitivo; no se puede votar ni reabrir",async()=>{
      await db.query("begin");
      await db.query("select id from public.cabildo_credenciales where token_hash=$1 for update",[hashes[5]]);
      const votoEnCurso=votar(a,hashes[5],respuestas);
      const esperarSesion=async nombre=>{
        for(let i=0;i<80;i++) {
          const r=await db.query("select count(*)::int n from pg_stat_activity where application_name=$1 and wait_event_type='Lock'",[nombre]);
          if(r.rows[0].n===1)return;
          await esperar(25);
        }
        throw new Error("La sesión debe esperar al bloqueo transaccional");
      };
      let cierre;
      try {
        await esperarSesion('cabildo-test-a');
        cierre=admin.query("select public.cambiar_estado_consulta($1,'cerrada')",[evento]);
        await esperarSesion('cabildo-test-admin');
      } finally { await db.query("commit"); }
      await Promise.all([votoEnCurso,cierre]);
      assert.equal((await usada(hashes[5])).usado,true);
      const antes=await snapshot(); await rechaza(votar(a,hashes[6],respuestas),"CV003");
      assert.deepEqual(await snapshot(),antes); assert.equal((await usada(hashes[6])).usado,false);
      await rechaza(abrir(),"22023");
      await rechaza(db.query("update public.cabildo_configuracion set estado='preparacion'"),"22023");
      assert.equal((await a.query("select public.leer_papeleta($1) p",[hashes[6]])).rows[0].p.estado,"cerrada");
    });
  } finally {
    for(const c of clientes) { try { await c.query("rollback"); } catch {} await c.end(); }
  }
});
