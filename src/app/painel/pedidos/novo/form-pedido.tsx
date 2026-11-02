"use client";

import { useState, useTransition } from "react";
import { History, Minus, Plus } from "lucide-react";
import { UNIDADES } from "@/lib/constantes";
import { criarPedido } from "../actions";

export type ProdutoCatalogo = { id: string; item: string; codigo: string | null; embalagem: string; unidade: string; preco: number };
type ClienteForm = { id: string; nome: string; precos: Record<string, number>; ultimoPedido: { produtoId: string; quantidade: number }[] };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PASSO: Record<string, number> = { caixa: 0.5, bandeja: 1 };

/** Pedido lançado pela equipe (ex: chegou pelo WhatsApp). Preço = o combinado com o cliente ou o de tabela */
export function FormPedido({ produtos, clientes, diaInicial }: { produtos: ProdutoCatalogo[]; clientes: ClienteForm[]; diaInicial: string }) {
  const [clienteId, setClienteId] = useState("");
  const [dia, setDia] = useState(diaInicial);
  const [origem, setOrigem] = useState<"WHATSAPP" | "PAINEL">("WHATSAPP");
  const [observacao, setObservacao] = useState("");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string>();
  const [enviando, iniciar] = useTransition();

  const cliente = clientes.find((c) => c.id === clienteId);
  const precoDe = (p: ProdutoCatalogo) => cliente?.precos[p.id] ?? p.preco;
  const mudar = (p: ProdutoCatalogo, delta: number) =>
    setQtd((q) => ({ ...q, [p.id]: Math.max(0, Math.round(((q[p.id] ?? 0) + delta) * 10) / 10) }));
  const linhas = produtos.filter((p) => (qtd[p.id] ?? 0) > 0);
  const total = linhas.reduce((s, p) => s + qtd[p.id] * precoDe(p), 0);

  function repetirUltimo() {
    if (!cliente) return;
    setQtd(Object.fromEntries(cliente.ultimoPedido.map((i) => [i.produtoId, i.quantidade])));
  }

  function enviar() {
    setErro(undefined);
    iniciar(async () => {
      const r = await criarPedido({ clienteId, dia, origem, observacao, itens: linhas.map((p) => ({ produtoId: p.id, quantidade: qtd[p.id] })) });
      if (r?.erro) setErro(r.erro);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
      <section className="cartao divide-y divide-stone-100">
        {produtos.map((p) => {
          const negociado = cliente?.precos[p.id] !== undefined;
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="tabular mr-2 rounded bg-gema-200 px-1.5 text-xs font-bold text-casca-900">{p.codigo}</span>
                  {p.item}
                </p>
                <p className="text-xs text-stone-500">
                  {p.embalagem} · {reais(precoDe(p))}
                  {negociado && <span className="ml-1 font-semibold text-green-700">preço combinado</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => mudar(p, -(PASSO[p.unidade] ?? 1))} className="botao-secundario size-9 p-0" aria-label={`Menos ${p.item} ${p.embalagem}`}>
                  <Minus className="size-4" />
                </button>
                <span className="tabular w-16 text-center font-semibold">
                  {qtd[p.id] ?? 0} {UNIDADES[p.unidade] ?? p.unidade}
                </span>
                <button type="button" onClick={() => mudar(p, PASSO[p.unidade] ?? 1)} className="botao-secundario size-9 p-0" aria-label={`Mais ${p.item} ${p.embalagem}`}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <aside className="cartao h-fit space-y-4 p-5 xl:sticky xl:top-6">
        <label className="block">
          <span className="text-sm font-medium">Cliente</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="campo mt-1">
            <option value="">Escolha…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        {cliente && cliente.ultimoPedido.length > 0 && (
          <button type="button" onClick={repetirUltimo} className="botao-secundario w-full">
            <History className="size-4" /> Repetir o último pedido
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Entrega</span>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="campo mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Chegou por</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)} className="campo mt-1">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PAINEL">Telefone / balcão</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Observação</span>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} maxLength={500} className="campo mt-1" />
        </label>

        <div className="border-t border-stone-200 pt-3 text-sm">
          {linhas.length === 0 ? (
            <p className="text-stone-500">Nenhum ovo escolhido.</p>
          ) : (
            <ul className="space-y-1">
              {linhas.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    {qtd[p.id]} {UNIDADES[p.unidade] ?? p.unidade} {p.item}
                  </span>
                  <span className="tabular">{reais(qtd[p.id] * precoDe(p))}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular">{reais(total)}</span>
          </p>
          <p className="text-xs text-stone-500">Frete grátis</p>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="button" onClick={enviar} disabled={enviando || !clienteId || linhas.length === 0} className="botao-primario w-full">
          {enviando ? "Salvando…" : "Salvar pedido"}
        </button>
      </aside>
    </div>
  );
}
