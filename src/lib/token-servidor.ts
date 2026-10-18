import { createHash } from "node:crypto";

export function hashCredencial(codigo: unknown): string | null {
  if (typeof codigo !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codigo)) return null;
  const bytes = Buffer.from(codigo, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== codigo) return null;
  return createHash("sha256").update(codigo, "utf8").digest("hex");
}
