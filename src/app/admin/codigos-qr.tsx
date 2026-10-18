"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { MAXIMO_LOTE, type LoteQr, type ResumenCredenciales } from "@/lib/credenciales";
import { consultarCredenciales, generarCredenciales } from "./qr-actions";

type Props = {
  resumenInicial: ResumenCredenciales | null;
  estadoInicial: string;
  urlBase: { base: string; local: boolean } | null;
  errorUrl: string | null;
};

export default function CodigosQr({ resumenInicial, estadoInicial, urlBase, errorUrl }: Props) {
  const [resumen, setResumen] = useState(resumenInicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [cantidad, setCantidad] = useState("12");
  const [aceptado, setAceptado] = useState(false);
  const [lote, setLote] = useState<LoteQr | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!lote) return;
    const advertir = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", advertir);
    return () => window.removeEventListener("beforeunload", advertir);
  }, [lote]);

  function actualizarContadores() {
    iniciar(async () => {
      try {
        const resultado = await consultarCredenciales();
        if (resultado.error || !resultado.resumen) { setMensaje(resultado.error ?? "No fue posible consultar los contadores."); return; }
        setResumen(resultado.resumen);
        setEstado(resultado.estado ?? estado);
        setMensaje("Contadores actualizados.");
      } catch { setMensaje("No fue posible consultar los contadores. Revisá la conexión."); }
    });
  }

  function generar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente || lote || !aceptado || estado !== "preparacion" || !urlBase) return;
    setMensaje("");
    iniciar(async () => {
      try {
        const resultado = await generarCredenciales(Number(cantidad));
        if ("error" in resultado) { setMensaje(resultado.error); return; }
        setLote(resultado.lote);
        setResumen(resultado.lote.resumen);
        setAceptado(false);
        setMensaje("Lote generado. Imprimilo o guardalo como PDF antes de cerrar esta vista.");
      } catch {
        setMensaje("No se pudo confirmar la generación. Actualizá los contadores antes de volver a intentar; un lote creado sin recibir su respuesta no puede recuperarse.");
      }
    });
  }

  function cerrarLote() {
    if (window.confirm("¿Ya imprimiste o guardaste el PDF? Al cerrar este lote no podrás recuperar sus códigos desde la base de datos.")) {
      setLote(null);
      setMensaje("Vista del lote cerrada. Sus credenciales permanecen registradas, pero sus QR no pueden recuperarse.");
    }
  }

  async function imprimir() {
    try {
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".qr-imagen"), (imagen) => imagen.decode()));
      window.print();
    } catch { setMensaje("Esperá a que carguen todos los códigos e intentá imprimir nuevamente."); }
  }

  const hojas = lote ? Array.from({ length: Math.ceil(lote.tarjetas.length / 12) }, (_, i) => lote.tarjetas.slice(i * 12, i * 12 + 12)) : [];

  return (
    <section id="codigos-qr" aria-labelledby="titulo-qr" className="qr-panel scroll-mt-8 pb-6 text-slate-900">
      <div className="qr-contenido mx-auto max-w-5xl">
        <div className="qr-no-imprimir rounded-2xl border border-teal-900/10 bg-white p-5 shadow-sm sm:p-7">
          <h2 id="titulo-qr" className="text-2xl font-bold tracking-tight text-teal-950">Votos y códigos QR</h2>
          <p className="mt-2 text-slate-600">Credenciales anónimas individuales para el cabildo. Generación permitida únicamente en preparación.</p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center sm:gap-4">
            {([["Total", resumen?.total], ["Disponibles", resumen?.disponibles], ["Utilizadas", resumen?.utilizadas]] as const).map(([nombre, valor]) => (
              <div key={nombre} className="rounded-xl border border-teal-100 bg-teal-50/70 px-1 py-5"><dt className="text-sm text-slate-600">{nombre}</dt><dd className="mt-1 text-2xl font-bold">{valor ?? "—"}</dd></div>
            ))}
          </dl>
          {!resumen && <p className="mt-3 text-sm text-red-800">No se pudieron cargar los contadores. Revisá la migración de credenciales y actualizá.</p>}
          <button type="button" disabled={pendiente} onClick={actualizarContadores} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-50">Actualizar contadores</button>
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Imprimí o guardá los QR como PDF en este momento.</p>
            <p className="mt-1">Solo se almacena el hash de cada token. Al cerrar o actualizar esta vista, no podrás recuperar ni reimprimir los códigos desde la base de datos.</p>
            <p className="mt-2">Imprimí los QR definitivos únicamente cuando la aplicación tenga su dominio público HTTPS establecido.</p>
            {urlBase && <p className="mt-2 break-words">URL configurada: {urlBase.base}</p>}
            {urlBase?.local && <p className="mt-2 font-semibold">MODO LOCAL: estos códigos apuntan a localhost y no servirán a los asistentes desde sus teléfonos.</p>}
            {errorUrl && <p className="mt-2 font-semibold">{errorUrl}</p>}
          </div>
          {estado !== "preparacion" && <p className="mt-4 font-medium">La generación está bloqueada: el cabildo ya no está en preparación.</p>}
          <form onSubmit={generar} className="mt-5">
            <fieldset disabled={pendiente || !!lote || !urlBase || !resumen || estado !== "preparacion"} className="space-y-4 disabled:opacity-60">
              <div><label htmlFor="cantidad-qr" className="mb-1 block font-medium">Cantidad de códigos (1–{MAXIMO_LOTE})</label><input id="cantidad-qr" type="number" inputMode="numeric" min={1} max={MAXIMO_LOTE} step={1} required value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full max-w-40 rounded-lg border border-slate-300 p-3" /></div>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={aceptado} onChange={(e) => setAceptado(e.target.checked)} className="mt-1 size-4 shrink-0" /><span>Entiendo que debo imprimir o guardar el PDF antes de cerrar esta vista y que los códigos originales no podrán recuperarse.</span></label>
              <button type="submit" className="rounded-lg button-primary bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900">{pendiente ? "Procesando…" : "Generar lote de QR"}</button>
            </fieldset>
          </form>
          <p role="status" aria-live="polite" className="mt-4 text-sm">{mensaje}</p>
          {lote && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={imprimir} className="rounded-lg button-primary bg-teal-800 px-5 py-3 font-semibold text-white">Imprimir / Guardar PDF</button>
              <button type="button" onClick={cerrarLote} className="rounded-lg border border-slate-300 px-5 py-3 font-medium">Cerrar lote</button>
              <p className="w-full text-sm text-slate-600">Seleccioná papel A4, escala 100 % y desactivá los encabezados y pies del navegador. No entregués copias duplicadas de una tarjeta.</p>
            </div>
          )}
        </div>
        {hojas.length > 0 && <div className="qr-hojas mt-6 space-y-6">
          {hojas.map((tarjetas, pagina) => (
            <div key={pagina} className="qr-hoja grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tarjetas.map((tarjeta) => (
                <article key={tarjeta.numero} className="qr-tarjeta flex flex-col items-center rounded-lg border border-dashed border-slate-400 bg-white p-3 text-center text-black">
                  <h3 className="qr-marca font-bold">Cabildo Digital</h3>
                  <p className="qr-numero text-sm">Tarjeta N.º {tarjeta.numero}</p>
                  <Image unoptimized loading="eager" src={tarjeta.imagen} alt={`Código QR de la tarjeta ${tarjeta.numero}`} width={200} height={200} className="qr-imagen h-auto w-44" />
                  <p className="qr-pie text-xs">Una credencial por asistente</p>
                  {urlBase?.local && <p className="qr-prueba text-xs font-bold">PRUEBA LOCAL · NO DISTRIBUIR</p>}
                </article>
              ))}
            </div>
          ))}
        </div>}
      </div>
    </section>
  );
}


