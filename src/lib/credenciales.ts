export const MAXIMO_LOTE = 100;
export type ResumenCredenciales = { total: number; disponibles: number; utilizadas: number };
export type TarjetaQr = { numero: number; imagen: string };
export type LoteQr = { tarjetas: TarjetaQr[]; resumen: ResumenCredenciales };

export function cantidadValida(cantidad: unknown): cantidad is number {
  return typeof cantidad === "number" && Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= MAXIMO_LOTE;
}

export function configurarUrlQr(valor: string | undefined, vercel?: { activo?: string; dominioProduccion?: string }): { base: string; local: boolean } {
  // Los QR impresos deben conservar el dominio estable de producción.
  if (vercel?.activo === "1") {
    const configurada = valor ? configurarUrlQr(valor) : null;
    if (configurada && !configurada.local) return configurada;
    if (!vercel.dominioProduccion) {
      throw new Error("Configurá CABILDO_URL_BASE con el dominio público HTTPS del cabildo antes de generar QR en Vercel.");
    }
    const publica = configurarUrlQr(`https://${vercel.dominioProduccion}`);
    if (publica.local) throw new Error("Los QR en Vercel deben apuntar a un dominio público.");
    return publica;
  }
  if (!valor) throw new Error("Configurá CABILDO_URL_BASE antes de generar códigos QR.");
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error("CABILDO_URL_BASE debe ser una URL válida."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    (!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Usá una URL base HTTPS sin rutas, credenciales ni parámetros; HTTP solo se permite para localhost.");
  }
  if (url.origin.length > 250) throw new Error("La URL base es demasiado larga para las tarjetas QR.");
  return { base: url.origin, local };
}

export function esResumenCredenciales(valor: unknown): valor is ResumenCredenciales {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as Record<string, unknown>;
  return [r.total, r.disponibles, r.utilizadas].every((n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)
    && r.total === (r.disponibles as number) + (r.utilizadas as number);
}
