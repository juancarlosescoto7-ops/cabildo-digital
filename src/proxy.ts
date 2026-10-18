import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configuracionSupabase } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  respuesta.headers.set("Cache-Control", "private, no-store");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return respuesta;
  const { url, key } = configuracionSupabase();
  const supabase = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(actualizadas, headers) {
        actualizadas.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        actualizadas.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => respuesta.headers.set(name, value));
        respuesta.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // El control obligatorio de identidad se realiza en cada página y acción.
  }
  return respuesta;
}

export const config = { matcher: ["/admin/:path*", "/login"] };
