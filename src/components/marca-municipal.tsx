import Image from "next/image";
import { identidad } from "@/lib/identidad";

export default function MarcaMunicipal({ clara = false }: { clara?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-black/5">
      <Image src={identidad.logo} width={40} height={40} alt="Municipalidad de Talanga" className="size-full object-contain" />
    </span>
    <div className="min-w-0">
      <p className={`text-[10px] font-semibold tracking-[0.17em] uppercase ${clara ? "text-teal-200" : "text-teal-700"}`}>Municipalidad de</p>
      <p className={`text-xl font-bold tracking-tight ${clara ? "text-white" : "text-teal-950"}`}>Talanga<span className={`ml-2 text-[10px] font-medium tracking-normal ${clara ? "text-teal-200" : "text-slate-500"}`}>Honduras</span></p>
    </div>
  </div>;
}
