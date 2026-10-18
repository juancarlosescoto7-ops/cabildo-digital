import Link from "next/link";
import PanelShell from "@/components/panel-shell";
import Icono, { type NombreIcono } from "@/components/icono";
import { identidad } from "@/lib/identidad";

const accesos: { titulo: string; descripcion: string; href: string; etiqueta: string; accion: string; icono: NombreIcono }[] = [
  { titulo: "Resultados", descripcion: "Consultá los resultados y la participación, con actualización automática.", href: "/resultados", etiqueta: "Pantalla pública", accion: "Ver resultados", icono: "resultados" },
  { titulo: "Configuración", descripcion: "Prepará las preguntas, sus opciones y el estado de la consulta.", href: "/admin", etiqueta: "Administración", accion: "Configurar cabildo", icono: "configuracion" },
  { titulo: "Votos y QR", descripcion: "Gestioná las credenciales y consultá cuántas están disponibles o utilizadas.", href: "/admin#codigos-qr", etiqueta: "Administración", accion: "Gestionar credenciales", icono: "qr" },
];

export default function Home() {
  return <PanelShell seccion="inicio">
    <main>
      <section className="hero-municipal relative isolate overflow-hidden rounded-3xl px-7 py-10 text-white sm:px-10 sm:py-14" style={{ backgroundImage: `linear-gradient(100deg, rgba(4,47,46,.97) 0%, rgba(15,118,110,.89) 64%, rgba(13,148,136,.65) 100%), url('${identidad.fondo}')` }}>
        <div className="hero-orbita pointer-events-none absolute -right-24 -top-36 size-[480px] rounded-full border border-white/15" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-widest uppercase"><span className="size-1.5 rounded-full bg-teal-200" />Talanga participa</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Cabildo Digital</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-teal-50/90">La voz de nuestra comunidad,<br className="hidden sm:block" /> en un solo espacio.</p>
          <p className="mt-5 max-w-lg text-sm leading-6 text-teal-100/80">Consulta ciudadana sobre el establecimiento de comercios chinos en el municipio de Talanga.</p>
          <Link href="/resultados" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-900 shadow-sm transition-colors hover:bg-teal-50">Consultar resultados<Icono nombre="flecha" className="size-4" /></Link>
        </div>
      </section>
      <section aria-labelledby="accesos-titulo" className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold tracking-[0.18em] text-teal-700 uppercase">Accesos directos</p><h2 id="accesos-titulo" className="mt-2 text-2xl font-semibold tracking-tight text-teal-950">Todo lo que necesitás, a mano</h2></div><p className="text-xs text-slate-500">Gestión del cabildo abierto</p></div>
        <div className="grid gap-5 xl:grid-cols-3">
          {accesos.map(({ titulo, descripcion, href, etiqueta, accion, icono }, i) => <Link key={href} href={href} className="acceso-card group flex flex-col rounded-2xl border border-teal-900/10 bg-white p-6 transition-[transform,box-shadow,border-color] hover:border-teal-500/40 hover:shadow-lg motion-safe:hover:-translate-y-1">
            <div className="flex items-center justify-between gap-3"><span className={`flex size-12 items-center justify-center rounded-2xl ${i === 0 ? "bg-linear-to-br from-teal-600 to-teal-800 text-white shadow-md shadow-teal-900/10" : "bg-teal-50 text-teal-700"}`}><Icono nombre={icono} /></span><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">{etiqueta}</span></div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight text-teal-950">{titulo}</h3><p className="mt-2 grow text-sm leading-6 text-slate-500">{descripcion}</p><span className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-teal-700">{accion}<Icono nombre="flecha" className="size-4 transition-transform motion-safe:group-hover:translate-x-1" /></span>
          </Link>)}
        </div>
      </section>
      <aside className="mt-7 flex items-start gap-4 rounded-2xl border border-teal-900/8 bg-teal-50/70 p-5"><Icono nombre="escudo" className="mt-0.5 size-5 shrink-0 text-teal-700" /><div><p className="text-sm font-semibold text-teal-950">Una credencial, una participación</p><p className="mt-1 text-sm leading-6 text-slate-600">Cada asistente participa desde su código QR individual. La configuración y la gestión de credenciales requieren acceso administrativo.</p></div></aside>
    </main>
  </PanelShell>;
}
