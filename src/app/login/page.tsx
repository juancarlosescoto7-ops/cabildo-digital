"use client";

import Link from "next/link";
import { useActionState } from "react";
import { iniciarSesion } from "./actions";
import MarcaMunicipal from "@/components/marca-municipal";
import Icono from "@/components/icono";
import { identidad } from "@/lib/identidad";

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, { error: "" });
  return (
    <main className="public-surface grid min-h-screen text-slate-900 lg:grid-cols-2">
      <section className="hero-municipal relative hidden flex-col justify-between p-12 text-white lg:flex xl:p-16" style={{ backgroundImage: `linear-gradient(145deg, rgba(4,47,46,.96), rgba(15,118,110,.85)), url('${identidad.fondo}')` }}>
        <Link href="/" aria-label="Volver al panel principal"><MarcaMunicipal clara /></Link>
        <div className="my-16 max-w-md"><p className="text-xs font-semibold tracking-[0.2em] text-teal-200 uppercase">Cabildo abierto</p><h2 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">Escuchar.<br />Participar.<br />Construir comunidad.</h2><p className="mt-6 text-base leading-7 text-teal-100/80">Un espacio de participación ciudadana para el municipio de Talanga.</p></div>
        <p className="text-xs text-teal-100/70">Municipalidad de Talanga · Honduras</p>
      </section>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-9 lg:hidden"><MarcaMunicipal /></div>
          <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">← Volver al panel principal</Link>
          <div className="mt-7 rounded-3xl border border-teal-900/10 bg-white p-7 shadow-xl shadow-teal-950/5 sm:p-9">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Icono nombre="escudo" /></span>
            <p className="mt-6 text-[10px] font-bold tracking-[0.18em] text-teal-700 uppercase">Cabildo Digital</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-teal-950">Acceso administrativo</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Ingresá con la cuenta autorizada para administrar la consulta.</p>
            <form action={accion} className="mt-7 space-y-4">
              <fieldset disabled={pendiente} className="space-y-5">
                <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="nombre@ejemplo.com" className="w-full rounded-xl border border-slate-300 p-3" /></div>
                <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} className="w-full rounded-xl border border-slate-300 p-3" /></div>
                <button type="submit" className="button-primary w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">{pendiente ? "Ingresando…" : "Iniciar sesión"}</button>
              </fieldset>
              <p role="status" aria-live="polite" className="text-sm text-red-800">{estado.error}</p>
            </form>
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">Los asistentes participan escaneando su código QR.<br />No necesitan una cuenta.</p>
        </div>
      </div>
    </main>
  );
}
