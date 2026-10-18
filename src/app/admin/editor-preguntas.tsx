"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { validarPreguntas, type Pregunta, type Cabildo } from "@/lib/cabildo";
import { guardarPreguntas } from "./actions";
import { cerrarSesion } from "../login/actions";

type Mensaje = { texto: string; error: boolean } | null;

export default function EditorPreguntas({ inicial }: { inicial: Cabildo }) {
  const [{ preguntas, mensaje }, setConfiguracion] = useState<{ preguntas: Pregunta[]; mensaje: Mensaje }>({ preguntas: inicial.preguntas, mensaje: null });
  const [version, setVersion] = useState(inicial.version);
  const [guardando, iniciarGuardado] = useTransition();
  const bloqueado = guardando || inicial.estado !== "preparacion";

  function editar(actualizar: (actuales: Pregunta[]) => Pregunta[]) {
    setConfiguracion((actual) => ({ preguntas: actualizar(actual.preguntas), mensaje: null }));
  }
  function agregarPregunta() {
    const nueva = { id: crypto.randomUUID(), texto: "", opciones: ["", ""] };
    editar((actuales) => [...actuales, nueva]);
  }
  function actualizarPregunta(id: string, cambios: (pregunta: Pregunta) => Pregunta) {
    editar((actuales) => actuales.map((p) => p.id === id ? cambios(p) : p));
  }
  function mostrarMensaje(texto: string, error: boolean) {
    setConfiguracion((actual) => ({ ...actual, mensaje: { texto, error } }));
  }
  function guardar() {
    if (bloqueado) return;
    const error = validarPreguntas(preguntas);
    if (error) { mostrarMensaje(error, true); return; }
    iniciarGuardado(async () => {
      try {
        const resultado = await guardarPreguntas(preguntas, version);
        if (resultado.error || !resultado.preguntas || resultado.version === undefined) {
          mostrarMensaje(resultado.error ?? "No se pudo confirmar el guardado.", true);
          return;
        }
        setVersion(resultado.version);
        setConfiguracion({ preguntas: resultado.preguntas, mensaje: { texto: "Configuración guardada correctamente en Supabase.", error: false } });
      } catch {
        mostrarMensaje("No fue posible guardar. Tus cambios siguen en pantalla; revisá la conexión e intentá nuevamente.", true);
      }
    });
  }
  return (
    <main className="py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">← Volver al inicio</Link>
        <header className="mt-5">
          <p className="text-sm font-semibold text-teal-800">Cabildo Digital · Talanga</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Administración de preguntas</h1>
          <a href="#codigos-qr" className="mt-3 inline-block text-sm font-semibold text-teal-800 underline">Ir a códigos QR</a>
          <Link href="/resultados" target="_blank" rel="noopener noreferrer" className="mt-3 ml-4 inline-block text-sm font-semibold text-teal-800 underline">Abrir resultados públicos ↗</Link>
          <p className="mt-3 text-slate-600">Prepará las preguntas y sus opciones de respuesta. Cada pregunta necesita al menos dos opciones.</p>
          <p className="mt-2 text-sm text-slate-600">La configuración se guarda en la base de datos. Presioná «Guardar configuración» para conservar los cambios.</p>
        </header>
        <p className="mt-3 text-sm font-medium">Estado del cabildo: {inicial.estado === "preparacion" ? "En preparación" : inicial.estado === "abierta" ? "Abierto · edición bloqueada" : "Cerrado · edición bloqueada"}</p>
        <fieldset disabled={bloqueado} aria-busy={guardando}>
        <div className="mt-8 space-y-6">
          {preguntas.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No hay preguntas. Agregá una para comenzar.</p>}
          {preguntas.map((pregunta, indice) => (
            <section key={pregunta.id} aria-labelledby={`titulo-${pregunta.id}`} className="rounded-2xl border border-teal-900/10 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id={`titulo-${pregunta.id}`} className="text-lg font-semibold">Pregunta {indice + 1}</h2>
                <button type="button" onClick={() => editar((actuales) => actuales.filter((p) => p.id !== pregunta.id))} aria-label={`Eliminar pregunta ${indice + 1}`} className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Eliminar pregunta</button>
              </div>
              <label htmlFor={`texto-${pregunta.id}`} className="mb-2 block text-sm font-medium">Texto de la pregunta</label>
              <textarea id={`texto-${pregunta.id}`} value={pregunta.texto} onChange={(e) => actualizarPregunta(pregunta.id, (p) => ({ ...p, texto: e.target.value }))} placeholder="Escribí la pregunta…" className="w-full rounded-xl border border-slate-300 p-3 focus:border-teal-700 focus:outline-2 focus:outline-teal-700" rows={3} />
              <fieldset className="mt-5">
                <legend className="font-medium">Opciones de respuesta</legend>
                <p className="mb-4 mt-1 text-sm text-slate-500">Se deben conservar al menos dos opciones.</p>
                {pregunta.opciones.map((opcion, i) => (
                  <div key={i} className="mb-4">
                    <label htmlFor={`opcion-${pregunta.id}-${i}`} className="mb-1 block text-sm font-medium">Opción {i + 1}</label>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <input id={`opcion-${pregunta.id}-${i}`} value={opcion} onChange={(e) => actualizarPregunta(pregunta.id, (p) => ({ ...p, opciones: p.opciones.map((o, j) => j === i ? e.target.value : o) }))} className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 focus:border-teal-700 focus:outline-2 focus:outline-teal-700" />
                      <button type="button" disabled={pregunta.opciones.length <= 2} aria-label={`Eliminar opción ${i + 1} de la pregunta ${indice + 1}`} onClick={() => actualizarPregunta(pregunta.id, (p) => p.opciones.length <= 2 ? p : ({ ...p, opciones: p.opciones.filter((_, j) => j !== i) }))} className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent">Eliminar</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => actualizarPregunta(pregunta.id, (p) => ({ ...p, opciones: [...p.opciones, ""] }))} className="rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">+ Agregar opción</button>
              </fieldset>
            </section>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={agregarPregunta} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-100">+ Nueva pregunta</button>
          <button type="button" onClick={guardar} className="rounded-lg button-primary bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900">{guardando ? "Guardando…" : "Guardar configuración"}</button>
        </div>
        </fieldset>
        <form action={cerrarSesion} className="mt-5"><button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Cerrar sesión</button></form>
        <div aria-live="polite" aria-atomic="true" className="mt-5">
          {mensaje && <p className={`rounded-lg border p-4 ${mensaje.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{mensaje.texto}</p>}
        </div>
      </div>
    </main>
  );
}



