"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";

const assinar = (f: () => void) => {
  window.addEventListener("hashchange", f);
  return () => window.removeEventListener("hashchange", f);
};

/**
 * No celular, guarda um bloco comprido atrás de um botão; no computador ele fica sempre aberto.
 * Com `id`, o link com #id (ex.: o "+" da barra) já abre o bloco.
 */
export function Recolhe({ rotulo, icone, id, children, className = "" }: { rotulo: string; icone?: React.ReactNode; id?: string; children: React.ReactNode; className?: string }) {
  const pelaRota = useSyncExternalStore(assinar, () => !!id && location.hash === `#${id}`, () => false);
  const [toque, setToque] = useState<boolean | null>(null);
  const aberto = toque ?? pelaRota;
  return (
    <div id={id} className={`scroll-mt-24 ${className}`}>
      <button type="button" aria-expanded={aberto} onClick={() => setToque(!aberto)} className="flex min-h-12 w-full items-center gap-2.5 text-left text-base font-semibold text-marca-950 lg:hidden">
        {icone}
        <span className="flex-1">{rotulo}</span>
        <ChevronDown className={`size-5 text-stone-400 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div className={aberto ? "max-lg:pt-2" : "max-lg:hidden"}>{children}</div>
    </div>
  );
}
