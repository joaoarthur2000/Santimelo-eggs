"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { reais } from "@/lib/formato";
import { excluirPedido } from "./actions";

/**
 * Excluir pedido em dois cliques (o segundo confirma). `pagina`: botão grande da tela do pedido,
 * que volta pra lista do dia depois de excluir; sem ele, botão de ícone nas linhas das listas.
 */
export function ExcluirPedido({ id, pagina = false }: { id: number; pagina?: boolean }) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pago, setPago] = useState<number | null>(null); // já pago: pede a segunda confirmação
  const [apagando, iniciar] = useTransition();

  const excluir = () =>
    iniciar(async () => {
      const r = await excluirPedido(id, pagina, pago !== null);
      if (r?.erro) setErro(r.erro);
      else if (r?.pago !== undefined) setPago(r.pago);
    });

  if (erro)
    return (
      <span role="alert" className="inline-flex max-w-72 items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-800">
        {erro}
        <button type="button" onClick={() => (setErro(null), setConfirmar(false))} className="font-semibold underline">
          ok
        </button>
      </span>
    );

  if (!confirmar)
    return pagina ? (
      <button type="button" onClick={() => setConfirmar(true)} className="botao-secundario text-red-700 hover:border-red-200 hover:bg-red-50">
        <Trash2 className="size-4" /> Excluir pedido
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        aria-label={`Excluir pedido #${id}`}
        title="Excluir pedido"
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </button>
    );

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className="text-xs font-medium text-red-800">
        {pago !== null ? `Já foi pago (${reais(pago)}): o pagamento sai junto. Excluir?` : pagina ? "Excluir de vez?" : `Excluir #${id}?`}
      </span>
      <button
        type="button"
        disabled={apagando}
        onClick={excluir}
        className={`rounded-lg bg-red-600 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 ${pagina ? "px-4 py-2 text-sm" : "px-2.5 py-1.5 text-xs"}`}
      >
        {apagando ? "Excluindo…" : "Sim, excluir"}
      </button>
      <button type="button" disabled={apagando} onClick={() => (setConfirmar(false), setPago(null))} className={`rounded-lg text-stone-600 hover:bg-stone-100 ${pagina ? "px-3 py-2 text-sm" : "px-2 py-1.5 text-xs"}`}>
        Não
      </button>
    </span>
  );
}
