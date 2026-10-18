import "server-only";
import { clienteVotacion } from "./votacion";
import { prepararResultados } from "@/lib/resultados";

export async function leerResultados() {
  // Una sola consulta PostgREST: preguntas, contadores y participaciones comparten
  // la misma instantánea de PostgreSQL. No se seleccionan hashes ni filas individuales.
  const { data, error } = await clienteVotacion().from("cabildo_configuracion")
    .select("titulo,estado,cabildo_preguntas(texto,orden,cabildo_opciones(texto,orden,votos)),cabildo_credenciales(count)")
    .eq("cabildo_credenciales.usado", true)
    .abortSignal(AbortSignal.timeout(8000))
    .single();
  if (error || !data) throw new Error("Resultados no disponibles");
  return prepararResultados(data);
}
