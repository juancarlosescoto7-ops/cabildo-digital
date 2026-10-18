import { Suspense } from "react";
import { connection } from "next/server";
import { hashCredencial } from "@/lib/token-servidor";
import { clienteVotacion } from "@/lib/supabase/votacion";
import { mensajeEstado, type Papeleta } from "@/lib/votacion";
import FormularioVotacion from "./formulario";
import MarcaMunicipal from "@/components/marca-municipal";
import type { ReactNode } from "react";

function MarcoConsulta({ children }: { children: ReactNode }) {
  return <main className="public-surface min-h-screen px-4 py-8 text-slate-900 sm:px-6 sm:py-12"><div className="mx-auto max-w-2xl"><header className="mb-8"><MarcaMunicipal /></header><div className="rounded-3xl border border-teal-900/10 bg-white p-5 shadow-xl shadow-teal-950/5 sm:p-8"><p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-teal-700 uppercase">Cabildo Digital · Consulta ciudadana</p>{children}</div><footer className="mt-6 text-center text-xs text-slate-500">Municipalidad de Talanga · Participación ciudadana</footer></div></main>;
}

export default function PaginaVotacion({ params }: { params: Promise<{ codigo: string }> }) {
  return <Suspense fallback={<MarcoConsulta><p role="status">Cargando consulta…</p></MarcoConsulta>}><Consulta params={params} /></Suspense>;
}

async function Consulta({ params }: { params: Promise<{ codigo: string }> }) {
  await connection();
  const { codigo } = await params;
  const hash = hashCredencial(codigo);
  let papeleta: Papeleta = { estado: "invalida", preguntas: [] };
  if (hash) {
    try {
      const { data, error } = await clienteVotacion().rpc("leer_papeleta", { p_hash: hash });
      if (error || !data || !["invalida", "utilizada", "preparacion", "cerrada", "lista"].includes(data.estado) || !Array.isArray(data.preguntas)) throw new Error("Papeleta no disponible");
      papeleta = data as Papeleta;
      if (papeleta.estado === "lista" && !papeleta.preguntas.length) throw new Error("Papeleta vacía");
    } catch {
      return <MarcoConsulta><h1 className="text-2xl font-bold">Cabildo Digital</h1><p className="mt-4 leading-7 text-slate-600" role="status">No fue posible consultar la votación. Intentá actualizar esta página en unos momentos. Tu credencial no se ha utilizado por abrir esta página.</p></MarcoConsulta>;
    }
  }
  return <MarcoConsulta>
      <h1 className="text-2xl font-semibold tracking-tight text-teal-950 sm:text-3xl">{papeleta.titulo ?? "Consulta ciudadana"}</h1>
      <p className="mt-4 leading-7 text-slate-600" role="status">{mensajeEstado(papeleta.estado)}</p>
      {papeleta.estado === "lista" && <FormularioVotacion codigo={codigo} preguntas={papeleta.preguntas} />}
  </MarcoConsulta>;
}

