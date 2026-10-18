"use client";

import { useState, useTransition } from "react";
import { cambiarEstadoConsulta } from "./estado-actions";

export default function EstadoConsulta({ inicial }: { inicial: string }) {
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  function cambiar(destino: "abierta" | "cerrada") {
    if (pendiente) return;
    iniciar(async () => {
      try {
        const resultado = await cambiarEstadoConsulta(destino);
        if (resultado.error) { setMensaje(resultado.error); return; }
        // Recarga completa: refleja el bloqueo de preguntas y QR en todos los componentes.
        window.location.reload();
      } catch { setMensaje("No se pudo confirmar el cambio. Actualizá la página antes de intentar nuevamente."); }
    });
  }
  return <section aria-labelledby="estado-consulta" className="qr-no-imprimir mx-auto max-w-5xl text-slate-900">
    <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-white to-teal-50 p-6 shadow-sm">
      <h2 id="estado-consulta" className="text-xl font-bold">Estado de la consulta</h2>
      <p className="mt-2 font-medium">{inicial === "preparacion" ? "En preparación" : inicial === "abierta" ? "Abierta" : "Cerrada"}</p>
      <p className="mt-2 text-sm text-slate-600">Al abrir se bloquean las preguntas y la generación de QR. El cierre es definitivo.</p>
      {inicial === "preparacion" && <p className="mt-2 text-sm text-slate-600">Se utilizarán las preguntas guardadas en la base de datos. Guardá los cambios antes de abrir.</p>}
      {inicial !== "cerrada" && <button type="button" disabled={pendiente} onClick={() => cambiar(inicial === "preparacion" ? "abierta" : "cerrada")} className="mt-4 rounded-lg button-primary bg-teal-800 px-5 py-3 font-semibold text-white disabled:opacity-60">{pendiente ? "Procesando…" : inicial === "preparacion" ? "Abrir consulta" : "Cerrar consulta"}</button>}
      <p role="status" aria-live="polite" className="mt-3 text-sm text-red-800">{mensaje}</p>
    </div>
  </section>;
}


