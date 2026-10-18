"use server";

import { obtenerAdministrador } from "@/lib/supabase/admin";

export async function cambiarEstadoConsulta(destino: unknown) {
  try {
    const admin = await obtenerAdministrador();
    if (!admin) return { error: "La sesión no está autorizada." };
    if (destino !== "abierta" && destino !== "cerrada") return { error: "El estado solicitado no es válido." };
    const { data, error } = await admin.supabase.rpc("cambiar_estado_consulta", { p_evento: admin.evento.id, p_estado: destino });
    if (error?.code === "22023") return { error: "No se pudo cambiar el estado. Para abrir se necesitan preguntas válidas y credenciales; solo se puede cerrar una consulta abierta y el cierre es definitivo." };
    if (error || data !== destino) return { error: "No se pudo confirmar el cambio. Actualizá la página para consultar el estado actual antes de intentar nuevamente." };
    return { estado: destino };
  } catch { return { error: "No fue posible confirmar el cambio. Revisá la conexión y actualizá la página." }; }
}
