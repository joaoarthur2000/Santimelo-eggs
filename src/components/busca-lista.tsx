"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { textoDeBusca } from "@/lib/busca";

/**
 * Filtra na hora as linhas [data-busca] da lista `alvo` (id), sem ir ao servidor:
 * só esconde por CSS o que não contém todas as palavras digitadas.
 */
export function BuscaLista({ alvo, placeholder }: { alvo: string; placeholder: string }) {
  const [texto, setTexto] = useState("");
  const palavras = textoDeBusca(texto).split(/\s+/).filter(Boolean);
  const regra = palavras.map((p) => `#${alvo} [data-busca]:not([data-busca*="${p}"])`).join(",");
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-stone-400" aria-hidden />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="campo campo-busca pr-11 pl-10"
      />
      {texto && (
        <button type="button" onClick={() => setTexto("")} aria-label="Limpar busca" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-400">
          <X className="size-[18px]" />
        </button>
      )}
      {regra && <style>{`${regra}{display:none!important}`}</style>}
    </div>
  );
}
