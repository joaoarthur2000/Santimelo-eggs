"use client";

import { useTransition } from "react";
import { definirFornecedorItem } from "../actions";

/** De qual fornecedor saíram as caixas desse item. Trocar refaz a baixa do estoque na hora. */
export function FornecedorDoItem({
  itemId,
  atual,
  nomeAtual,
  opcoes,
}: {
  itemId: string;
  atual: string | null;
  nomeAtual: string | null;
  opcoes: { id: string; nome: string }[];
}) {
  const [salvando, iniciar] = useTransition();
  // fornecedor desativado continua aparecendo no pedido antigo
  const lista = atual && !opcoes.some((o) => o.id === atual) ? [...opcoes, { id: atual, nome: nomeAtual ?? "Fornecedor" }] : opcoes;
  return (
    <>
      <select
        aria-label="Fornecedor"
        defaultValue={atual ?? ""}
        disabled={salvando}
        onChange={(e) => {
          const valor = e.target.value;
          iniciar(() => definirFornecedorItem(itemId, valor));
        }}
        className={`campo py-1.5 text-sm print:hidden ${atual ? "" : "border-amber-400 bg-amber-50"}`}
      >
        <option value="">Escolha…</option>
        {lista.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
      <span className="hidden print:inline">{nomeAtual ?? "—"}</span>
    </>
  );
}
