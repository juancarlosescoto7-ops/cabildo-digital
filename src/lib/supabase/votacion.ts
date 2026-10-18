import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente distinto del de autenticación: nunca usa cookies ni comparte sesión.
export function clienteVotacion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta la configuración privada de votación.");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
