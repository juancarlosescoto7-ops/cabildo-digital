import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { cantidadValida, configurarUrlQr, esResumenCredenciales } from "../src/lib/credenciales.ts";
import { generarMaterialQr } from "../src/lib/qr-servidor.ts";

test("limita los lotes a cantidades enteras entre 1 y 100", () => {
  for (const valor of [0, -1, 101, 1.5, "12", null, NaN, Infinity]) assert.equal(cantidadValida(valor), false);
  for (const valor of [1, 12, 100]) assert.equal(cantidadValida(valor), true);
});

test("exige HTTPS público y permite HTTP únicamente en localhost", () => {
  assert.deepEqual(configurarUrlQr("https://cabildo.example/"), { base: "https://cabildo.example", local: false });
  assert.equal(configurarUrlQr("http://localhost:3000").local, true);
  assert.equal(configurarUrlQr("http://127.0.0.1:3000/").local, true);
  for (const valor of [undefined, "", "invalida", "http://cabildo.example", "https://user:password@cabildo.example", "https://cabildo.example/ruta", "https://cabildo.example?token=x", "https://cabildo.example#x", "file:///tmp", "ftp://localhost"]) {
    assert.throws(() => configurarUrlQr(valor));
  }
});

test("comprueba la consistencia de los contadores", () => {
  assert.equal(esResumenCredenciales({ total: 12, disponibles: 12, utilizadas: 0 }), true);
  for (const resumen of [null, {}, { total: 2, disponibles: 1, utilizadas: 0 }, { total: -1, disponibles: -1, utilizadas: 0 }, { total: "1", disponibles: 1, utilizadas: 0 }]) assert.equal(esResumenCredenciales(resumen), false);
});

test("genera 100 tokens únicos de 32 bytes, calcula SHA-256 y decodifica todos los PNG", async () => {
  const material = await generarMaterialQr(100, "https://cabildo.example");
  const tokens = new Set();
  const hashes = new Set();
  for (const tarjeta of material) {
    const url = new URL(tarjeta.url);
    const token = url.pathname.split("/")[2];
    assert.equal(url.origin, "https://cabildo.example");
    assert.match(url.pathname, /^\/votar\/[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(token, "base64url").length, 32);
    assert.equal(tarjeta.hash, createHash("sha256").update(token).digest("hex"));
    assert.match(tarjeta.hash, /^[a-f0-9]{64}$/);
    tokens.add(token); hashes.add(tarjeta.hash);
    const png = PNG.sync.read(Buffer.from(tarjeta.imagen.split(",")[1], "base64"));
    const leido = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    // No incluir tokens ni URL secretas en un fallo del test.
    assert.ok(leido?.data === tarjeta.url, "La imagen QR debe decodificar la URL original");
  }
  assert.equal(tokens.size, 100);
  assert.equal(hashes.size, 100);
});

test("rechaza cantidad y URL inválidas antes de producir un lote", async () => {
  await assert.rejects(generarMaterialQr(101, "https://cabildo.example"));
  await assert.rejects(generarMaterialQr(1, "http://cabildo.example"));
});
