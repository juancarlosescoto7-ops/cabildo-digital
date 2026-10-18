export type Pregunta = { id: string; texto: string; opciones: string[] };
export type Cabildo = {
  id: string;
  titulo: string;
  estado: "preparacion" | "abierta" | "cerrada";
  version: number;
  preguntas: Pregunta[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compartida por el formulario y el servidor. La base de datos vuelve a validar.
export function validarPreguntas(datos: unknown): string | null {
  if (!Array.isArray(datos) || datos.length > 100) return "La configuración debe contener como máximo 100 preguntas.";
  const ids = new Set<string>();
  for (const [i, dato] of datos.entries()) {
    if (typeof dato !== "object" || dato === null) return "La configuración de preguntas es inválida.";
    const p = dato as Record<string, unknown>;
    if (typeof p.id !== "string" || !uuid.test(p.id) || ids.has(p.id)) return "Hay identificadores de preguntas inválidos o duplicados.";
    ids.add(p.id);
    if (typeof p.texto !== "string" || !p.texto.trim()) return `Escribí el texto de la pregunta ${i + 1}.`;
    if (p.texto.length > 2000) return `La pregunta ${i + 1} excede los 2000 caracteres.`;
    if (!Array.isArray(p.opciones) || p.opciones.length < 2 || p.opciones.length > 20) return `La pregunta ${i + 1} debe tener entre 2 y 20 opciones.`;
    for (const [j, opcion] of p.opciones.entries()) {
      if (typeof opcion !== "string" || !opcion.trim()) return `Completá la opción ${j + 1} de la pregunta ${i + 1}.`;
      if (opcion.length > 500) return `La opción ${j + 1} de la pregunta ${i + 1} excede los 500 caracteres.`;
    }
  }
  return null;
}
