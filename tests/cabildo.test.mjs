import test from "node:test";
import assert from "node:assert/strict";
import { validarPreguntas } from "../src/lib/cabildo.ts";

const pregunta = () => ({
  id: "12345678-1234-4234-8234-123456789abc",
  texto: "¿Cuál es su opinión?",
  opciones: ["De acuerdo", "En desacuerdo"],
});

test("acepta una configuración válida y permite eliminar la última pregunta", () => {
  assert.equal(validarPreguntas([pregunta()]), null);
  assert.equal(validarPreguntas([]), null);
});

test("rechaza entradas manipuladas, IDs inválidos y duplicados", () => {
  for (const valor of [null, {}, "[]", [null], [{ ...pregunta(), id: "invalido" }], [pregunta(), pregunta()]]) {
    assert.equal(typeof validarPreguntas(valor), "string");
  }
});

test("identifica preguntas y opciones vacías o con tipos inválidos", () => {
  assert.match(validarPreguntas([{ ...pregunta(), texto: "  " }]), /pregunta 1/);
  for (const opciones of [[], ["Sí"], ["Sí", "  "], ["Sí", 5], null]) {
    assert.equal(typeof validarPreguntas([{ ...pregunta(), opciones }]), "string");
  }
  assert.match(validarPreguntas([{ ...pregunta(), opciones: ["Sí", ""] }]), /opción 2/);
});

test("impone límites antes de enviar información a la base de datos", () => {
  for (const valor of [
    [{ ...pregunta(), texto: "a".repeat(2001) }],
    [{ ...pregunta(), opciones: ["a".repeat(501), "No"] }],
    [{ ...pregunta(), opciones: Array(21).fill("Sí") }],
    Array(101).fill(pregunta()),
  ]) assert.equal(typeof validarPreguntas(valor), "string");
});
