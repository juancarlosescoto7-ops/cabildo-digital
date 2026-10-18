"use server";

import { obtenerAdministrador } from "@/lib/supabase/admin";
import { leerResumenCredenciales } from "@/lib/supabase/credenciales";
import { cantidadValida, configurarUrlQr, esResumenCredenciales, type LoteQr } from "@/lib/credenciales";
import { generarMaterialQr } from "@/lib/qr-servidor";

export async function consultarCredenciales() {
  try {
    const admin = await obtenerAdministrador();
    if (!admin) return { error: "La sesión no está autorizada. Iniciá sesión nuevamente." };
    const resumen = await leerResumenCredenciales(admin);
    if (!resumen) return { error: "No fue posible consultar las credenciales. Revisá la conexión y la migración de esta etapa." };
    return { resumen, estado: admin.evento.estado as string };
  } catch {
    return { error: "No fue posible conectar con Supabase para consultar las credenciales." };
  }
}

export async function generarCredenciales(cantidad: unknown): Promise<{ error: string } | { lote: LoteQr }> {
  try {
    const admin = await obtenerAdministrador();
    if (!admin) return { error: "La sesión no está autorizada. Iniciá sesión nuevamente." };
    if (admin.evento.estado !== "preparacion") return { error: "Solo se pueden generar credenciales mientras el cabildo está en preparación." };
    if (!cantidadValida(cantidad)) return { error: "Ingresá una cantidad entera entre 1 y 100." };
    const { base } = configurarUrlQr(process.env.CABILDO_URL_BASE);
    // Preparar las imágenes antes de insertar: un fallo de renderizado no crea filas.
    const material = await generarMaterialQr(cantidad, base);
    // Solo viajan hashes a la base; la RPC verifica autorización y estado bajo bloqueo.
    const { data, error } = await admin.supabase.rpc("generar_credenciales", {
      p_evento: admin.evento.id, p_hashes: material.map((c) => c.hash),
    });
    if (error) {
      if (error.code === "42501") return { error: "No tenés autorización o el cabildo ya no está en preparación." };
      return { error: "No se pudo confirmar la creación del lote. Consultá los contadores antes de volver a generar; los códigos de un lote creado sin recibir su respuesta no pueden recuperarse." };
    }
    if (!data || typeof data !== "object" || !esResumenCredenciales(data.resumen) ||
      !Number.isSafeInteger(data.primero) || data.primero < 1) {
      return { error: "No se pudo confirmar el lote recibido. Consultá los contadores antes de intentar nuevamente." };
    }
    return { lote: {
      tarjetas: material.map((c, i) => ({ numero: data.primero + i, imagen: c.imagen })),
      resumen: data.resumen,
    } };
  } catch {
    return { error: "No fue posible completar la generación. Revisá la URL base y la conexión. Consultá los contadores antes de intentar nuevamente." };
  }
}
