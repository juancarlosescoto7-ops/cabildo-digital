"use client";

import { useState, useTransition } from "react";
import type { PreguntaPublica, ResultadoVotacion } from "@/lib/votacion";
import { enviarVotacion } from "./actions";

export default function FormularioVotacion({ codigo, preguntas }: { codigo: string; preguntas: PreguntaPublica[] }) {
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<ResultadoVotacion | null>(null);
  const [pendiente, iniciar] = useTransition();
  const terminado = resultado?.estado === "confirmada" || resultado?.estado === "utilizada";

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente || terminado) return;
    if (!preguntas.length || preguntas.some((p) => !selecciones[p.id])) {
      setResultado({ estado: "error", mensaje: "Seleccioná una respuesta para cada pregunta antes de enviar." });
      return;
    }
    iniciar(async () => {
      try {
        setResultado(await enviarVotacion(codigo, preguntas.map((p) => ({ pregunta_id: p.id, opcion_id: selecciones[p.id] }))));
      } catch {
        setResultado({ estado: "error", mensaje: "Se perdió la conexión. Intentá nuevamente con el mismo QR; el servidor evita registrar una votación dos veces." });
      }
    });
  }

  return <>
    {!terminado && <form onSubmit={enviar} className="mt-6 space-y-5">
      <p className="text-sm text-slate-600">Respondé todas las preguntas. No se solicita ningún dato personal. Abrir esta página no utiliza tu credencial.</p>
      <fieldset disabled={pendiente} aria-busy={pendiente} className="space-y-5">
        {preguntas.map((p, indice) => <fieldset key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <legend className="max-w-full px-1 font-semibold break-words">{indice + 1}. {p.texto}</legend>
          <div className="mt-2 space-y-3">{p.opciones.map((opcion) => <label key={opcion.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-teal-800 has-checked:bg-teal-50">
            <input type="radio" name={`pregunta-${p.id}`} value={opcion.id} required checked={selecciones[p.id] === opcion.id} onChange={() => setSelecciones((actual) => ({ ...actual, [p.id]: opcion.id }))} className="mt-1 size-4 shrink-0 accent-teal-800" />
            <span className="min-w-0 break-words">{opcion.texto}</span>
          </label>)}</div>
        </fieldset>)}
        <button type="submit" className="w-full rounded-lg button-primary bg-teal-800 px-5 py-4 font-semibold text-white hover:bg-teal-900 disabled:opacity-60">{pendiente ? "Enviando…" : "Enviar votación"}</button>
      </fieldset>
    </form>}
    <div role="status" aria-live="polite" aria-atomic="true" className="mt-5">
      {resultado && <p className={`rounded-lg border p-4 ${resultado.estado === "confirmada" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950"}`}>{resultado.mensaje}</p>}
    </div>
  </>;
}

