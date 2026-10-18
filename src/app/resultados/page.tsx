import type { Metadata } from "next";
import PantallaResultados from "./pantalla-resultados";

export const metadata: Metadata = { title: "Resultados | Cabildo Digital" };

export default function ResultadosPage() {
  return <PantallaResultados />;
}
