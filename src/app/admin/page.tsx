import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { obtenerAdministrador } from "@/lib/supabase/admin";
import type { Cabildo } from "@/lib/cabildo";
import EditorPreguntas from "./editor-preguntas";
import CargandoAdmin from "./loading";
import CodigosQr from "./codigos-qr";
import { leerResumenCredenciales } from "@/lib/supabase/credenciales";
import { configurarUrlQr } from "@/lib/credenciales";
import EstadoConsulta from "./estado-consulta";

export default function AdminPage() {
  return <Suspense fallback={<CargandoAdmin />}><Administracion /></Suspense>;
}

async function Administracion() {
  await connection();
  let admin;
  try { admin = await obtenerAdministrador(); } catch {
    return <main className="p-8 text-slate-900">No fue posible conectar con Supabase. Revisá la configuración del servidor e intentá nuevamente.</main>;
  }
  if (!admin) redirect("/login");
  const { data, error } = await admin.supabase.from("cabildo_configuracion")
    .select("id, titulo, estado, version, cabildo_preguntas(id, texto, orden, cabildo_opciones(texto, orden))")
    .eq("id", admin.evento.id).single();
  if (error || !data) return <main className="p-8 text-slate-900">No fue posible recuperar las preguntas. Recargá la página o revisá la migración y los permisos de Supabase.</main>;
  const inicial: Cabildo = {
    id: data.id, titulo: data.titulo, estado: data.estado, version: data.version,
    preguntas: data.cabildo_preguntas.sort((a, b) => a.orden - b.orden).map((p) => ({
      id: p.id, texto: p.texto,
      opciones: p.cabildo_opciones.sort((a, b) => a.orden - b.orden).map((o) => o.texto),
    })),
  };
  const resumen = await leerResumenCredenciales(admin).catch(() => null);
  let urlBase = null;
  let errorUrl = null;
  try { urlBase = configurarUrlQr(process.env.CABILDO_URL_BASE, {
    activo: process.env.VERCEL, dominioProduccion: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  }); }
  catch (error) { errorUrl = error instanceof Error ? error.message : "Revisá la URL base de los QR."; }
  return <>
    <EstadoConsulta inicial={inicial.estado} />
    <div className="admin-preguntas"><EditorPreguntas key={inicial.id} inicial={inicial} /></div>
    <CodigosQr resumenInicial={resumen} estadoInicial={inicial.estado} urlBase={urlBase} errorUrl={errorUrl} />
  </>;
}
