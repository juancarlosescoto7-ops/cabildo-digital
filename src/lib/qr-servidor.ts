// Solo se importa desde código de servidor y pruebas Node.js.
import { randomBytes, createHash } from "node:crypto";
import QRCode from "qrcode";
import { cantidadValida, configurarUrlQr } from "./credenciales.ts";

export async function generarMaterialQr(cantidad: number, base: string) {
  if (!cantidadValida(cantidad)) throw new Error("Cantidad de credenciales inválida.");
  const { base: origen } = configurarUrlQr(base);
  return Promise.all(Array.from({ length: cantidad }, async () => {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token, "utf8").digest("hex");
    const url = `${origen}/votar/${token}`;
    const imagen = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M", margin: 4, width: 512,
      color: { dark: "#000000", light: "#ffffff" },
    });
    return { hash, imagen, url };
  }));
}
