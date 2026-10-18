import { connection } from "next/server";
import { leerResultados } from "@/lib/supabase/resultados";

const headers = { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

export async function GET() {
  await connection();
  try {
    return Response.json(await leerResultados(), { headers });
  } catch {
    return Response.json({ error: "No fue posible actualizar los resultados. Reintentaremos en unos momentos." }, { status: 503, headers });
  }
}
