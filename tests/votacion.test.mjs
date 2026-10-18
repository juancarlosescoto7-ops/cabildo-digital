import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { hashCredencial } from "../src/lib/token-servidor.ts";
import { validarRespuestas, mensajeEstado } from "../src/lib/votacion.ts";

const q1 = "11111111-1111-4111-8111-111111111111";
const q2 = "22222222-2222-4222-8222-222222222222";
const o1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const o2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("valida un token canónico de 32 bytes y reproduce el hash de la etapa 4", () => {
  const token = randomBytes(32).toString("base64url");
  assert.equal(hashCredencial(token), createHash("sha256").update(token).digest("hex"));
  for (const valor of [null, {}, "", "a".repeat(42), "!".repeat(43), "A".repeat(42) + "B", "../codigo", token + "="]) assert.equal(hashCredencial(valor), null);
});

test("rechaza respuestas incompletas, tipos manipulados e IDs inválidos", () => {
  for (const dato of [null, {}, [], [null], [{ pregunta_id: q1 }], [{ pregunta_id: 1, opcion_id: o1 }], [{ pregunta_id: q1, opcion_id: "incorrecta" }], Array(101).fill({ pregunta_id:q1, opcion_id:o1 })]) assert.equal(validarRespuestas(dato), false);
});

test("rechaza duplicados incluso con UUID en distintas mayúsculas", () => {
  assert.equal(validarRespuestas([{ pregunta_id:o1, opcion_id:o2 }, { pregunta_id:o1.toUpperCase(), opcion_id:o2 }]), false);
  assert.equal(validarRespuestas([{ pregunta_id:q1, opcion_id:o1 }, { pregunta_id:q2, opcion_id:o2 }]), true);
});

test("explica todos los estados del token y de la consulta en español", () => {
  for (const estado of ["invalida", "utilizada", "preparacion", "cerrada", "lista"]) assert.ok(mensajeEstado(estado).length > 20);
});
