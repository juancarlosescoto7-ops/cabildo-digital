import Link from "next/link";
import type { ReactNode } from "react";
import MarcaMunicipal from "./marca-municipal";
import Icono, { type NombreIcono } from "./icono";

const enlaces: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/", texto: "Panel principal", icono: "inicio" },
  { href: "/resultados", texto: "Resultados", icono: "resultados" },
  { href: "/admin", texto: "Configuración", icono: "configuracion" },
  { href: "/admin#codigos-qr", texto: "Votos y QR", icono: "qr" },
];

export default function PanelShell({ children, seccion }: { children: ReactNode; seccion: "inicio" | "administracion" }) {
  return <div className="panel-shell min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
    <a href="#contenido" className="skip-link qr-no-imprimir">Saltar al contenido</a>
    <aside className="panel-sidebar qr-no-imprimir flex flex-col px-5 py-6 text-teal-50 lg:sticky lg:top-0 lg:h-screen lg:px-6 lg:py-9">
      <Link href="/" aria-label="Municipalidad de Talanga · Inicio"><MarcaMunicipal clara /></Link>
      <div className="mt-8 hidden border-t border-white/10 pt-7 lg:block"><p className="text-[10px] font-semibold tracking-[0.2em] text-teal-200/70 uppercase">Cabildo abierto</p><p className="mt-2 text-lg font-semibold">Cabildo Digital</p></div>
      <nav aria-label="Navegación principal" className="mt-6 grid grid-cols-2 gap-2 lg:mt-8 lg:grid-cols-1">
        {enlaces.map(({ href, texto, icono }) => {
          const activo = (seccion === "inicio" && href === "/") || (seccion === "administracion" && href === "/admin");
          return <Link key={href} href={href} aria-current={activo ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${activo ? "bg-white/15 text-white ring-1 ring-white/15" : "text-teal-100/85 hover:bg-white/10 hover:text-white"}`}><Icono nombre={icono} className="size-5 shrink-0" />{texto}</Link>;
        })}
      </nav>
      <div className="mt-auto hidden pt-12 lg:block"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icono nombre="escudo" className="mb-3 size-6 text-teal-300" /><p className="text-sm font-medium">Participación ciudadana</p><p className="mt-2 text-xs leading-5 text-teal-100/70">Un espacio para escuchar a nuestra comunidad.</p></div><p className="mt-6 text-[11px] text-teal-100/60">Talanga, Francisco Morazán</p></div>
    </aside>
    <div className="panel-main min-w-0">
      <header className="qr-no-imprimir flex items-center justify-between gap-4 border-b border-teal-900/8 bg-white/80 px-5 py-5 sm:px-8 lg:px-10">
        <p className="text-sm text-slate-500">Cabildo Digital <span className="mx-2 text-slate-300">/</span><span className="font-semibold text-teal-950">{seccion === "inicio" ? "Panel principal" : "Administración"}</span></p>
        <span className="hidden items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 sm:inline-flex"><span className="size-1.5 rounded-full bg-teal-600" />Consulta ciudadana</span>
      </header>
      <div id="contenido" className="panel-content mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div>
      <footer className="qr-no-imprimir mx-5 flex flex-wrap justify-between gap-2 border-t border-teal-900/10 py-6 text-xs text-slate-500 sm:mx-8 lg:mx-10"><span>Municipalidad de Talanga · Honduras</span><span>Cabildo Digital · Participación ciudadana</span></footer>
    </div>
  </div>;
}
