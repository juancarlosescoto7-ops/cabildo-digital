export type ResultadosPublicos = {
  titulo: string;
  estado: "preparacion" | "abierta" | "cerrada";
  participaciones: number;
  preguntas: {
    texto: string;
    total: number;
    opciones: { texto: string; votos: number; porcentaje: number }[];
  }[];
};

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Datos de resultados inválidos");
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string {
  if (typeof valor !== "string") throw new Error("Texto de resultados inválido");
  return valor;
}
function entero(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 0) throw new Error("Contador de resultados inválido");
  return valor;
}
function lista(valor: unknown): unknown[] {
  if (!Array.isArray(valor)) throw new Error("Lista de resultados inválida");
  return valor;
}

// Construye una lista explícita de campos públicos. Nunca propaga objetos de la BD.
export function prepararResultados(datos: unknown): ResultadosPublicos {
  const c = objeto(datos);
  const estado = c.estado;
  if (estado !== "preparacion" && estado !== "abierta" && estado !== "cerrada") throw new Error("Estado de resultados inválido");
  const conteos = lista(c.cabildo_credenciales);
  const participaciones = conteos.length ? entero(objeto(conteos[0]).count) : 0;
  const preguntas = lista(c.cabildo_preguntas).map((valor) => {
    const p = objeto(valor);
    const opciones = lista(p.cabildo_opciones).map((valor) => {
      const o = objeto(valor);
      return { texto: texto(o.texto), votos: entero(o.votos), orden: entero(o.orden) };
    }).sort((a, b) => a.orden - b.orden);
    const total = entero(opciones.reduce((suma, o) => suma + o.votos, 0));
    return {
      orden: entero(p.orden), texto: texto(p.texto), total,
      opciones: opciones.map((o) => ({ texto: o.texto, votos: o.votos, porcentaje: total === 0 ? 0 : o.votos / total * 100 })),
    };
  }).sort((a, b) => a.orden - b.orden).map(({ texto, total, opciones }) => ({ texto, total, opciones }));
  return { titulo: texto(c.titulo), estado, participaciones, preguntas };
}

export function esResultadoPublico(valor: unknown): valor is ResultadosPublicos {
  try {
    const r = objeto(valor);
    texto(r.titulo); entero(r.participaciones);
    if (!["preparacion", "abierta", "cerrada"].includes(String(r.estado))) return false;
    return lista(r.preguntas).every((valor) => {
      const p = objeto(valor); texto(p.texto); entero(p.total);
      return lista(p.opciones).every((valor) => {
        const o = objeto(valor); texto(o.texto); entero(o.votos);
        return typeof o.porcentaje === "number" && Number.isFinite(o.porcentaje) && o.porcentaje >= 0 && o.porcentaje <= 100;
      });
    });
  } catch { return false; }
}
