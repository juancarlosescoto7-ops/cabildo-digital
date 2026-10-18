import test from "node:test";
import assert from "node:assert/strict";
import { prepararResultados, esResultadoPublico } from "../src/lib/resultados.ts";

function registro(estado = "abierta") {
  return {
    titulo: "Cabildo de prueba", estado,
    administrador_id: "privado", token_hash: "privado", id: "privado",
    cabildo_credenciales: [{ count: 3 }],
    cabildo_preguntas: [
      { texto: "Segunda", orden: 1, cabildo_opciones: [{texto:"B",orden:1,votos:1},{texto:"A",orden:0,votos:1}] },
      { texto: "Primera", orden: 0, cabildo_opciones: [{texto:"No",orden:1,votos:1},{texto:"Sí",orden:0,votos:2}] },
    ],
  };
}

test("ordena preguntas/opciones y calcula cada denominador sin alterar contadores", () => {
  const origen = registro(); const copia = structuredClone(origen);
  const r = prepararResultados(origen);
  assert.deepEqual(r.preguntas.map(p=>p.texto), ["Primera","Segunda"]);
  assert.deepEqual(r.preguntas[0].opciones.map(o=>o.texto), ["Sí","No"]);
  assert.equal(r.preguntas[0].total, 3); assert.equal(r.preguntas[1].total, 2);
  assert.equal(r.preguntas[0].opciones[0].porcentaje, 2/3*100);
  assert.equal(r.preguntas[0].opciones[0].porcentaje.toFixed(1), "66.7");
  assert.equal(r.preguntas[1].opciones[0].porcentaje, 50);
  assert.deepEqual(origen, copia);
});

test("las participaciones cuentan credenciales utilizadas, no respuestas sumadas", () => {
  const r = prepararResultados(registro());
  assert.equal(r.participaciones, 3);
  assert.equal(r.preguntas.reduce((n,p)=>n+p.total,0), 5);
});

test("cero votos no divide por cero y mantiene todas las opciones", () => {
  const base = registro("preparacion"); base.cabildo_credenciales = [{count:0}];
  base.cabildo_preguntas.forEach(p=>p.cabildo_opciones.forEach(o=>o.votos=0));
  const r = prepararResultados(base);
  assert.equal(r.participaciones,0);
  for(const p of r.preguntas) for(const o of p.opciones) {
    assert.equal(o.votos,0); assert.equal(o.porcentaje,0); assert.equal(o.porcentaje.toFixed(1),"0.0");
  }
  base.cabildo_credenciales=[]; assert.equal(prepararResultados(base).participaciones,0);
});

test("solo devuelve campos públicos explícitos, sin IDs, hashes ni administración", () => {
  const r = prepararResultados(registro());
  assert.deepEqual(Object.keys(r).sort(),["estado","participaciones","preguntas","titulo"]);
  assert.deepEqual(Object.keys(r.preguntas[0]).sort(),["opciones","texto","total"]);
  assert.deepEqual(Object.keys(r.preguntas[0].opciones[0]).sort(),["porcentaje","texto","votos"]);
  assert.equal(JSON.stringify(r).includes("privado"),false);
});

test("admite los tres estados y una consulta sin preguntas", () => {
  for(const estado of ["preparacion","abierta","cerrada"]) assert.equal(prepararResultados(registro(estado)).estado,estado);
  const base=registro();base.cabildo_preguntas=[];
  assert.deepEqual(prepararResultados(base).preguntas,[]);
});

test("rechaza contadores y respuestas HTTP inválidos para no reemplazar datos anteriores", () => {
  for(const valor of [null,{},registro("incorrecto"),{...registro(),cabildo_credenciales:[{count:-1}]}]) assert.throws(()=>prepararResultados(valor));
  const base=registro();base.cabildo_preguntas[0].cabildo_opciones[0].votos=1.5;
  assert.throws(()=>prepararResultados(base));
  assert.equal(esResultadoPublico(prepararResultados(registro())),true);
  assert.equal(esResultadoPublico({error:"No disponible"}),false);
});
