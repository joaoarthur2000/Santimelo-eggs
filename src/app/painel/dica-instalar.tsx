"use client";

import { useState, useSyncExternalStore } from "react";
import { Share, SquarePlus, X } from "lucide-react";

const CHAVE = "painel.instalar.fechado";
const nunca = () => () => {};

/** iPhone no Safari, ainda sem o ícone na tela inicial e sem ter fechado a dica */
function mostrar() {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || matchMedia("(display-mode: standalone)").matches) return false;
  if (!/iphone|ipod/i.test(nav.userAgent)) return false;
  try {
    return localStorage.getItem(CHAVE) !== "1";
  } catch {
    return true;
  }
}

/** Como pôr o painel na tela inicial do iPhone (aparece só onde faz sentido) */
export function DicaInstalarPainel() {
  const cabe = useSyncExternalStore(nunca, mostrar, () => false);
  const [fechada, setFechada] = useState(false);
  if (!cabe || fechada) return null;
  return (
    <section className="cartao relative mb-5 p-4 pr-14 lg:hidden" aria-label="Instalar na tela inicial">
      <h2 className="text-[17px] font-semibold text-marca-950">Coloque na tela inicial</h2>
      <ol className="mt-2 space-y-2 text-[15px] text-stone-600">
        <li className="flex gap-2.5">
          <Share className="mt-0.5 size-[18px] shrink-0 text-noz" aria-hidden />
          <span>
            Toque em <b>Compartilhar</b>. Se não aparecer, está dentro do botão de três pontinhos, ao lado do endereço.
          </span>
        </li>
        <li className="flex gap-2.5">
          <SquarePlus className="mt-0.5 size-[18px] shrink-0 text-noz" aria-hidden />
          <span>
            Escolha <b>Adicionar à Tela de Início</b> e toque em Adicionar.
          </span>
        </li>
      </ol>
      <button
        type="button"
        aria-label="Fechar dica"
        onClick={() => {
          try {
            localStorage.setItem(CHAVE, "1");
          } catch {}
          setFechada(true);
        }}
        className="absolute top-1 right-1 grid size-12 place-items-center text-stone-400 active:opacity-60"
      >
        <X className="size-5" />
      </button>
    </section>
  );
}
