import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuracionSupabase } from "./env";

export async function crearCliente() {
  const { url, key } = configuracionSupabase();
  const almacen = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(actualizadas) {
        try {
          actualizadas.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Los Server Components solo leen cookies; proxy.ts renueva la sesión.
        }
      },
    },
  });
}
