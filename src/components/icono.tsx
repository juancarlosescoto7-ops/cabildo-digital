import type { SVGProps } from "react";

export type NombreIcono = "inicio" | "resultados" | "configuracion" | "qr" | "flecha" | "escudo";
const trazos: Record<NombreIcono, string> = {
  inicio: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  resultados: "M4 20h16M6 16v-5m6 5V5m6 11v-8",
  configuracion: "M4 7h16M4 17h16M8 4v6m8 4v6",
  qr: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 14v4h-3v3h-4M21 21h.01",
  flecha: "M5 12h14m-5-5 5 5-5 5",
  escudo: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
};
export default function Icono({ nombre, ...props }: SVGProps<SVGSVGElement> & { nombre: NombreIcono }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={trazos[nombre]} /></svg>;
}
