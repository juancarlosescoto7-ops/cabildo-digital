import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

test("la API oculta errores internos y desactiva caché también cuando falla Supabase", async () => {
  const source = await readFile(new URL("../src/app/api/resultados/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const moduloCompilado = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduloCompilado, exports: moduloCompilado.exports, Response,
    require(nombre) {
      if (nombre === "next/server") return { connection: async () => {} };
      if (nombre === "@/lib/supabase/resultados") return { leerResultados: async () => { throw new Error("Detalle interno confidencial"); } };
      throw new Error("Importación inesperada");
    },
  });
  const respuesta = await moduloCompilado.exports.GET();
  assert.equal(respuesta.status, 503);
  assert.deepEqual(await respuesta.json(), { error: "No fue posible actualizar los resultados. Reintentaremos en unos momentos." });
  for (const nombre of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) assert.match(respuesta.headers.get(nombre), /no-store/);
});
