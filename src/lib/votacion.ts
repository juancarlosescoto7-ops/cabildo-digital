export type Respuesta = { pregunta_id: string; opcion_id: string };
export type PreguntaPublica = { id: string; texto: string; opciones: { id: string; texto: string }[] };
export type Papeleta = {
  estado: "invalida" | "utilizada" | "preparacion" | "cerrada" | "lista";
  titulo?: string;
  preguntas: PreguntaPublica[];
};
export type ResultadoVotacion = { estado: "confirmada" | "utilizada" | "error"; mensaje: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validarRespuestas(datos: unknown): datos is Respuesta[] {
  if (!Array.isArray(datos) || datos.length < 1 || datos.length > 100) return false;
  const ids = new Set<string>();
  return datos.every((r: unknown) => {
    if (!r || typeof r !== "object") return false;
    const respuesta = r as Record<string, unknown>;
    if (typeof respuesta.pregunta_id !== "string" || !uuid.test(respuesta.pregunta_id) ||
      typeof respuesta.opcion_id !== "string" || !uuid.test(respuesta.opcion_id) ||
      ids.has(respuesta.pregunta_id.toLowerCase())) return false;
    ids.add(respuesta.pregunta_id.toLowerCase());
    return true;
  });
}

export function mensajeEstado(estado: Papeleta["estado"]) {
  switch (estado) {
    case "invalida": return "La credencial no es válida. Revisá el código QR que recibiste.";
    case "utilizada": return "Esta credencial ya fue utilizada. No se puede registrar otra votación con este código.";
    case "preparacion": return "La votación todavía no está habilitada.";
    case "cerrada": return "La votación ha finalizado.";
    case "lista": return "Seleccioná una opción para cada pregunta.";
  }
}
