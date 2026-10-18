import "server-only";
import { esResumenCredenciales } from "@/lib/credenciales";
import type { obtenerAdministrador } from "./admin";

type Administrador = NonNullable<Awaited<ReturnType<typeof obtenerAdministrador>>>;

export async function leerResumenCredenciales(admin: Administrador) {
  const { data, error } = await admin.supabase.rpc("resumen_credenciales", { p_evento: admin.evento.id });
  if (error || !esResumenCredenciales(data)) return null;
  return data;
}
