"use client";

import { useState, useTransition } from "react";
import { EscolhaPagamento, faltaNoPagamento, paraEnviar, type Pagamento } from "@/components/escolha-pagamento";
import { definirPagamento } from "../actions";

/** Corrige a forma ou o prazo de um pedido que ainda não foi pago */
export function MudarPagamento({ pedidoId, entrega, atual }: { pedidoId: number; entrega: string; atual: Pagamento }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => {
          setValor(atual);
          setErro(null);
          setAberto(true);
        }}
        className="toque text-sm font-medium text-marca-700 hover:underline"
      >
        Mudar forma ou prazo
      </button>
    );

  function salvar() {
    const falta = faltaNoPagamento(valor, entrega);
    if (falta) return setErro(falta);
    iniciar(async () => {
      const r = await definirPagamento(pedidoId, paraEnviar(valor, entrega));
      if (r?.erro) setErro(r.erro);
      else setAberto(false);
    });
  }

  return (
    <div className="space-y-3 border-t border-stone-100 pt-3">
      <EscolhaPagamento valor={valor} entrega={entrega} aoMudar={setValor} />
      {erro && (
        <p role="alert" className="text-sm text-red-600">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={salvar} disabled={salvando} className="botao-primario flex-1">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} disabled={salvando} className="botao-secundario">
          Cancelar
        </button>
      </div>
    </div>
  );
}
