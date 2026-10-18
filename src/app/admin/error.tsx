"use client";

import Link from "next/link";

export default function ErrorAdmin({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <h1 className="text-2xl font-bold">No fue posible completar la operación</h1>
      <p className="mt-3">Revisá la conexión e intentá nuevamente.</p>
      <button type="button" onClick={reset} className="mt-5 rounded-lg bg-blue-800 px-5 py-3 text-white">Reintentar</button>
      <Link href="/login" className="ml-4 text-blue-800 underline">Ir al acceso administrativo</Link>
    </main>
  );
}
