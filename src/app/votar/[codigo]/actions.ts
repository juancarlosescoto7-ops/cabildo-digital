"use server";

import { hashCredencial } from "@/lib/token-servidor";
import { clienteVotacion } from "@/lib/supabase/votacion";
import { validarRespuestas, type ResultadoVotacion } from "@/lib/votacion";

export async function enviarVotacion(codigo: unknown, datos: unknown): Promise<ResultadoVotacion> {
  const hash = hashCredencial(codigo);
  if (!hash) return { estado: "error", mensaje: "La credencial no es válida." };
  if (!validarRespuestas(datos)) return { estado: "error", mensaje: "Respondé exactamente una vez cada pregunta con una opción válida." };
  try {
    const respuestas = datos.map((r) => ({ pregunta_id: r.pregunta_id, opcion_id: r.opcion_id }));
    const { error } = await clienteVotacion().rpc("registrar_votacion", { p_hash: hash, p_respuestas: respuestas });
    if (!error) return { estado: "confirmada", mensaje: "Tu votación se registró correctamente. Gracias por participar." };
    if (error.code === "CV002") return { estado: "utilizada", mensaje: "Esta credencial ya fue utilizada. Si un envío anterior perdió la conexión, la votación pudo haberse registrado. No se agregaron votos nuevos con este intento." };
    if (error.code === "CV001") return { estado: "error", mensaje: "La credencial no es válida." };
    if (error.code === "CV003") return { estado: "error", mensaje: "La consulta no está abierta. Todavía no se habilitó o ya finalizó." };
    if (error.code === "CV004" || error.code === "22P02") return { estado: "error", mensaje: "Las respuestas no son válidas. Respondé todas las preguntas con sus opciones correspondientes." };
    return { estado: "error", mensaje: "No se pudo confirmar el envío. Intentá nuevamente con este mismo QR; una votación registrada no se contará dos veces." };
  } catch {
    return { estado: "error", mensaje: "No se pudo confirmar el envío. Revisá la conexión e intentá nuevamente con este mismo QR; no se registrará dos veces." };
  }
}
