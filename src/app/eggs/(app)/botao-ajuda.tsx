"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Guinho flutuante que abre o chat de ajuda. Some no próprio chat e na tela de pedir (lá tem a barra de "Fazer pedido") */
export function BotaoAjuda() {
  const rota = usePathname();
  if (rota.startsWith("/eggs/ajuda") || rota.startsWith("/eggs/pedir")) return null;
  return (
    <Link
      href="/eggs/ajuda"
      aria-label="Ajuda: falar com o Guinho"
      className="eggs-toque fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-20 flex items-center gap-1.5 rounded-full bg-casca-900 py-1.5 pl-1.5 pr-4 text-sm font-bold text-gema-50 shadow-[0_8px_24px_rgba(61,38,20,0.35)]"
    >
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-gema-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/eggs/guinho/guinho-acenando.png" alt="" className="mt-3 h-12 w-auto max-w-none" />
      </span>
      Ajuda
    </Link>
  );
}
