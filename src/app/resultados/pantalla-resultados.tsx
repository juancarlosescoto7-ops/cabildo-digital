"use client";

import { useEffect, useState } from "react";
import { esResultadoPublico, type ResultadosPublicos } from "@/lib/resultados";
import Link from "next/link";
import MarcaMunicipal from "@/components/marca-municipal";

export default function PantallaResultados() {
  const [datos, setDatos] = useState<ResultadosPublicos | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [actualizado, setActualizado] = useState("");

  useEffect(() => {
    let detenido = false;
    let siguiente: ReturnType<typeof setTimeout>;
    let limite: ReturnType<typeof setTimeout>;
    let solicitud: AbortController | null = null;
    async function cargar() {
      solicitud = new AbortController();
      limite = setTimeout(() => solicitud?.abort(), 10000);
      try {
        const respuesta = await fetch("/api/resultados", { cache: "no-store", signal: solicitud.signal });
        if (!respuesta.ok) throw new Error("Consulta no disponible");
        const nuevos: unknown = await respuesta.json();
        if (!esResultadoPublico(nuevos)) throw new Error("Respuesta no disponible");
        if (!detenido) {
          setDatos(nuevos);
          setSinConexion(false);
          setActualizado(new Date().toLocaleTimeString("es-HN"));
        }
      } catch {
        if (!detenido) setSinConexion(true);
      } finally {
        clearTimeout(limite);
        // Programar después de completar la anterior evita solicitudes solapadas.
        if (!detenido) siguiente = setTimeout(cargar, 3000);
      }
    }
    void cargar();
    return () => { detenido = true; solicitud?.abort(); clearTimeout(siguiente); clearTimeout(limite); };
  }, []);

  const estado = datos?.estado;
  const etiqueta = estado === "preparacion" ? "En preparación" : estado === "cerrada" ? "Consulta finalizada" : "Consulta abierta";

  return (
    <main className="resultados-surface min-h-screen px-4 py-8 text-slate-50 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><MarcaMunicipal clara /><Link href="/" className="rounded-full border border-teal-200/20 px-4 py-2 text-xs font-medium text-teal-100 hover:bg-white/10">← Panel principal</Link></div>
        <header className="flex flex-col justify-between gap-6 border-b border-teal-200/15 pb-8 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-teal-300 sm:text-lg">CABILDO DIGITAL · MUNICIPALIDAD DE TALANGA</p>
            <h1 className="mt-3 text-3xl leading-tight font-bold break-words sm:text-4xl lg:text-5xl">{datos?.titulo ?? "Resultados de la consulta"}</h1>
            {estado && <p className={`mt-4 inline-block rounded-full px-4 py-2 text-base font-semibold sm:text-xl ${estado === "abierta" ? "bg-emerald-900 text-emerald-100" : "bg-teal-900 text-slate-100"}`}>{etiqueta}</p>}
          </div>
          <div className="shrink-0 rounded-xl border border-teal-200/15 bg-teal-950/60 px-6 py-4 lg:text-right">
            <p className="text-base text-teal-100/80 sm:text-xl">Participaciones registradas</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-white lg:text-6xl" data-participaciones>{datos?.participaciones.toLocaleString("es-HN") ?? "—"}</p>
          </div>
        </header>

        <div role="status" aria-live="polite" className="my-5 min-h-6 text-sm text-teal-100/80 sm:text-base">
          {sinConexion ? <p className="rounded-lg border border-amber-700 bg-amber-950 px-4 py-3 text-amber-100">Conexión interrumpida. {datos ? "Los últimos resultados visibles podrían estar desactualizados." : "Esperando los resultados."} Reintentando automáticamente…</p> : <p>{actualizado ? `Última actualización: ${actualizado} · Actualización automática cada 3 segundos` : "Cargando resultados…"}</p>}
        </div>
        {estado === "preparacion" && <p className="mb-6 rounded-xl border border-teal-200/20 bg-teal-950/60 p-5 text-lg sm:text-2xl">La consulta todavía no ha comenzado. Esta es una vista de preparación.</p>}
        {estado === "cerrada" && <p className="mb-6 text-xl font-semibold text-teal-200 sm:text-2xl">La consulta ha finalizado. Estos son los resultados finales.</p>}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          {datos?.preguntas.map((pregunta, indice) => (
            <section key={indice} aria-labelledby={`resultado-${indice}`} className="min-w-0 rounded-2xl border border-teal-200/15 bg-teal-950/60 p-5 sm:p-7">
              <p className="text-sm font-semibold tracking-wide text-teal-300 sm:text-base">PREGUNTA {indice + 1}</p>
              <h2 id={`resultado-${indice}`} className="mt-2 text-2xl leading-snug font-semibold break-words lg:text-3xl">{pregunta.texto}</h2>
              <p className="mt-3 text-base text-teal-100/80 sm:text-lg">{pregunta.total.toLocaleString("es-HN")} respuestas en esta pregunta</p>
              <div className="mt-6 space-y-6">
                {pregunta.opciones.map((opcion, i) => (
                  <div key={i}>
                    <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-end sm:gap-4">
                      <p className="min-w-0 text-lg font-medium break-words sm:text-xl lg:text-2xl">{opcion.texto}</p>
                      <p className="shrink-0 text-lg font-bold tabular-nums sm:text-xl lg:text-2xl"><span data-votos>{opcion.votos.toLocaleString("es-HN")}</span> <span className="text-sm font-normal text-teal-100/80 sm:text-base">votos</span> <span className="ml-2 text-teal-200">{opcion.porcentaje.toFixed(1)}%</span></p>
                    </div>
                    <div role="progressbar" aria-label={opcion.texto} aria-valuemin={0} aria-valuemax={100} aria-valuenow={opcion.porcentaje} aria-valuetext={`${opcion.votos} votos, ${opcion.porcentaje.toFixed(1)} por ciento`} className="h-5 overflow-hidden rounded-full bg-teal-900 sm:h-6">
                      <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${estado === "preparacion" ? "bg-slate-400" : "bg-linear-to-r from-teal-500 to-teal-300"}`} style={{ width: `${opcion.porcentaje}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        {datos && !datos.preguntas.length && <p className="mt-6 text-xl text-teal-100/80">Todavía no hay preguntas configuradas.</p>}
      </div>
    </main>
  );
}

