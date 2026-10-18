import "server-only";
import { crearCliente } from "./server";

export async function obtenerAdministrador() {
  const supabase = await crearCliente();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email_confirmed_at || user.is_anonymous) return null;
  // RLS devuelve el evento únicamente a la cuenta asignada por UUID.
  const { data: evento, error: lectura } = await supabase
    .from("cabildo_configuracion")
    .select("id, titulo, estado, version")
    .eq("administrador_id", user.id)
    .single();
  if (lectura || !evento) return null;
  return { supabase, evento };
}
