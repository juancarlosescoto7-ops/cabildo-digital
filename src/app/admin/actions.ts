"use server";

import { obtenerAdministrador } from "@/lib/supabase/admin";
import { validarPreguntas, type Pregunta } from "@/lib/cabildo";

export async function guardarPreguntas(datos: unknown, version: number) {
  try {
    const admin = await obtenerAdministrador();
    if (!admin) return { error: "La sesión no está autorizada. Iniciá sesión nuevamente." };
    if (admin.evento.estado !== "preparacion") return { error: "El cabildo ya no está en preparación. No se permiten modificaciones." };
    const invalido = validarPreguntas(datos);
    if (invalido) return { error: invalido };
    if (!Number.isSafeInteger(version) || version < 0) return { error: "La versión de la configuración es inválida. Recargá la página." };
    const preguntas = (datos as Pregunta[]).map((p) => ({ id: p.id, texto: p.texto.trim(), opciones: p.opciones.map((o) => o.trim()) }));
    const { data, error } = await admin.supabase.rpc("guardar_cabildo", {
      p_evento: admin.evento.id, p_version: version, p_preguntas: preguntas,
    });
    if (error) {
      if (error.code === "40001") return { error: "La configuración cambió en otra sesión. Recargá la página antes de volver a editar." };
      if (error.code === "42501") return { error: "No tenés autorización o el cabildo ya no está en preparación." };
      return { error: "No fue posible guardar la configuración. Los cambios siguen en pantalla; intentá nuevamente." };
    }
    if (typeof data !== "number") return { error: "No se pudo confirmar el guardado. Recargá la página para verificarlo." };
    return { preguntas, version: data };
  } catch {
    return { error: "No fue posible conectar con Supabase. Los cambios siguen en pantalla; intentá nuevamente." };
  }
}
