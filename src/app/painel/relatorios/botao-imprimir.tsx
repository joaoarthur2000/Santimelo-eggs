"use client";

import { Printer } from "lucide-react";

/** Imprimir ou salvar em PDF (o navegador oferece "Salvar como PDF") */
export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="botao-secundario">
      <Printer className="size-4" /> Imprimir / PDF
    </button>
  );
}
