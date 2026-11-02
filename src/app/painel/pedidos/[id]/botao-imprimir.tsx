"use client";

import { Printer } from "lucide-react";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="botao-secundario">
      <Printer className="size-4" /> Romaneio
    </button>
  );
}
