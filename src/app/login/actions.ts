"use server";

import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import { obtenerAdministrador } from "@/lib/supabase/admin";

export async function iniciarSesion(_: { error: string }, formulario: FormData) {
  const email = formulario.get("email");
  const password = formulario.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || email.length > 254 || password.length > 1024) return { error: "Ingresá un correo y una contraseña válidos." };
  try {
    const supabase = await crearCliente();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: "No se pudo iniciar sesión. Verificá tus credenciales e intentá nuevamente." };
    if (!await obtenerAdministrador()) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "La cuenta no está autorizada o falta configurar el administrador del cabildo." };
    }
  } catch {
    return { error: "No fue posible conectar con Supabase. Revisá la configuración y la conexión." };
  }
  redirect("/admin");
}

export async function cerrarSesion() {
  const supabase = await crearCliente();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("No fue posible cerrar la sesión. Intentá nuevamente.");
  redirect("/login");
}
