"use client";

import { CampoData } from "@/components/campo-data";
import { useState, useTransition } from "react";
import { History, Minus, Plus } from "lucide-react";
import { UNIDADES } from "@/lib/constantes";
import { criarPedido } from "../actions";

export type ProdutoCatalogo = {
  id: string;
  itemId: string;
  item: string;
  codigo: string | null;
  embalagem: string;
  unidade: string;
  preco: number;
  /** quanto de caixa 1 unidade consome (bandeja = 1/12); nulo = não controla estoque */
  fator: number | null;
};
type ClienteForm = { id: string; nome: string; precos: Record<string, number>; ultimoPedido: { produtoId: string; quantidade: number }[] };
type Fornecedor = { id: string; nome: string };
/** chave "fornecedorId|itemId" → caixas em estoque e custo médio da caixa */
type PorFornecedor = Record<string, { saldo: number; custo: number | null }>;

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const caixas = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cx`;
const PASSO: Record<string, number> = { caixa: 0.5, bandeja: 1 };
const ROTULO_VALOR: Record<string, string> = { caixa: "Valor da caixa", bandeja: "Valor da bandeja", pacote: "Valor do pacote" };
// "185", "185,50", "1.250,00" → número; vazio ou inválido = null
const numero = (v: string) => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const comoTexto = (v: number) => v.toFixed(2).replace(".", ",");

/** Pedido lançado pela equipe (ex: chegou pelo WhatsApp). Cada produto leva o valor do dia e o fornecedor de onde saem as caixas. */
export function FormPedido({
  produtos,
  clientes,
  fornecedores,
  porFornecedor,
  diaInicial,
}: {
  produtos: ProdutoCatalogo[];
  clientes: ClienteForm[];
  fornecedores: Fornecedor[];
  porFornecedor: PorFornecedor;
  diaInicial: string;
}) {
  const [clienteId, setClienteId] = useState("");
  const [dia, setDia] = useState(diaInicial);
  const [origem, setOrigem] = useState<"WHATSAPP" | "PAINEL">("WHATSAPP");
  const [observacao, setObservacao] = useState("");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [valor, setValor] = useState<Record<string, string>>({});
  const [fornecedor, setFornecedor] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string>();
  const [enviando, iniciar] = useTransition();

  const cliente = clientes.find((c) => c.id === clienteId);
  const precoBase = (p: ProdutoCatalogo) => cliente?.precos[p.id] ?? p.preco;
  // valor digitado; sem digitar, o combinado com o cliente ou o de tabela
  const textoValor = (p: ProdutoCatalogo) => valor[p.id] ?? comoTexto(precoBase(p));
  const precoDe = (p: ProdutoCatalogo) => numero(textoValor(p));
  const mudar = (p: ProdutoCatalogo, delta: number) =>
    setQtd((q) => ({ ...q, [p.id]: Math.max(0, Math.round(((q[p.id] ?? 0) + delta) * 10) / 10) }));
  const linhas = produtos.filter((p) => (qtd[p.id] ?? 0) > 0);
  const total = linhas.reduce((s, p) => s + qtd[p.id] * (precoDe(p) ?? 0), 0);
  const faltaFornecedor = linhas.filter((p) => !fornecedor[p.id]).length;
  const valorInvalido = linhas.some((p) => precoDe(p) === null);

  function trocarCliente(id: string) {
    setClienteId(id);
    setValor({}); // valores voltam pro combinado do cliente novo
  }

  function repetirUltimo() {
    if (!cliente) return;
    setQtd(Object.fromEntries(cliente.ultimoPedido.map((i) => [i.produtoId, i.quantidade])));
  }

  function enviar() {
    setErro(undefined);
    if (valorInvalido) return setErro("Confira o valor de cada produto.");
    if (faltaFornecedor) return setErro("Escolha o fornecedor de cada produto.");
    iniciar(async () => {
      const r = await criarPedido({
        clienteId,
        dia,
        origem,
        observacao,
        itens: linhas.map((p) => ({ produtoId: p.id, quantidade: qtd[p.id], precoUnit: precoDe(p)!, fornecedorId: fornecedor[p.id] })),
      });
      if (r?.erro) setErro(r.erro);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
      <section className="cartao divide-y divide-stone-100">
        {produtos.map((p) => {
          const negociado = cliente?.precos[p.id] !== undefined;
          const q = qtd[p.id] ?? 0;
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="tabular mr-2 rounded bg-gema-200 px-1.5 text-xs font-bold text-casca-900">{p.codigo}</span>
                  {p.item}
                </p>
                <p className="text-xs text-stone-500">
                  {p.embalagem} · {reais(precoBase(p))}
                  {negociado && <span className="ml-1 font-semibold text-green-700">preço combinado</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => mudar(p, -(PASSO[p.unidade] ?? 1))} className="botao-secundario size-9 p-0" aria-label={`Menos ${p.item} ${p.embalagem}`}>
                  <Minus className="size-4" />
                </button>
                <span className="tabular w-16 text-center font-semibold">
                  {q} {UNIDADES[p.unidade] ?? p.unidade}
                </span>
                <button type="button" onClick={() => mudar(p, PASSO[p.unidade] ?? 1)} className="botao-secundario size-9 p-0" aria-label={`Mais ${p.item} ${p.embalagem}`}>
                  <Plus className="size-4" />
                </button>
              </div>
              {q > 0 && (
                <LinhaVenda
                  produto={p}
                  quantidade={q}
                  texto={textoValor(p)}
                  aoMudarValor={(v) => setValor((x) => ({ ...x, [p.id]: v }))}
                  fornecedorId={fornecedor[p.id] ?? ""}
                  aoMudarFornecedor={(f) => setFornecedor((x) => ({ ...x, [p.id]: f }))}
                  fornecedores={fornecedores}
                  porFornecedor={porFornecedor}
                />
              )}
            </div>
          );
        })}
      </section>

      <aside className="cartao h-fit space-y-4 p-5 xl:sticky xl:top-6">
        <label className="block">
          <span className="text-sm font-medium">Cliente</span>
          <select value={clienteId} onChange={(e) => trocarCliente(e.target.value)} className="campo mt-1">
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
            <CampoData value={dia} onChange={setDia} required className="campo mt-1" />
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
                    <span className="block text-xs text-stone-500">{fornecedores.find((f) => f.id === fornecedor[p.id])?.nome ?? "sem fornecedor"}</span>
                  </span>
                  <span className="tabular">{reais(qtd[p.id] * (precoDe(p) ?? 0))}</span>
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
        {!erro && linhas.length > 0 && faltaFornecedor > 0 && <p className="text-xs text-amber-700">Falta escolher o fornecedor de {faltaFornecedor} produto(s).</p>}
        <button type="button" onClick={enviar} disabled={enviando || !clienteId || linhas.length === 0} className="botao-primario w-full">
          {enviando ? "Salvando…" : "Salvar pedido"}
        </button>
      </aside>
    </div>
  );
}

/** Valor do dia + fornecedor de um produto do pedido, com custo, lucro e estoque do fornecedor na hora */
function LinhaVenda({
  produto: p,
  quantidade,
  texto,
  aoMudarValor,
  fornecedorId,
  aoMudarFornecedor,
  fornecedores,
  porFornecedor,
}: {
  produto: ProdutoCatalogo;
  quantidade: number;
  texto: string;
  aoMudarValor: (v: string) => void;
  fornecedorId: string;
  aoMudarFornecedor: (f: string) => void;
  fornecedores: Fornecedor[];
  porFornecedor: PorFornecedor;
}) {
  const v = numero(texto);
  const dados = fornecedorId ? porFornecedor[`${fornecedorId}|${p.itemId}`] : undefined;
  const custoUnidade = dados?.custo != null && p.fator ? dados.custo * p.fator : null;
  const usa = p.fator ? quantidade * p.fator : null;
  return (
    <div className="grid w-full gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-[160px_1fr]">
      <label className="text-xs font-medium text-stone-600">
        {ROTULO_VALOR[p.unidade] ?? "Valor"} (R$)
        <input inputMode="decimal" value={texto} onChange={(e) => aoMudarValor(e.target.value)} className={`campo mt-1 ${v === null ? "border-red-400" : ""}`} />
      </label>
      <label className="text-xs font-medium text-stone-600">
        Fornecedor dessas caixas
        <select value={fornecedorId} onChange={(e) => aoMudarFornecedor(e.target.value)} className={`campo mt-1 ${fornecedorId ? "" : "border-amber-400 bg-amber-50"}`}>
          <option value="">Escolha…</option>
          {fornecedores.map((f) => {
            const saldo = porFornecedor[`${f.id}|${p.itemId}`]?.saldo;
            return (
              <option key={f.id} value={f.id}>
                {f.nome}
                {p.fator && saldo !== undefined ? ` · ${caixas(saldo)} em estoque` : ""}
              </option>
            );
          })}
        </select>
      </label>
      {fornecedorId && (
        <p className="text-xs text-stone-600 sm:col-span-2">
          {custoUnidade !== null && v !== null ? (
            <span className={v - custoUnidade >= 0 ? "text-green-800" : "font-semibold text-red-700"}>
              Custo {reais(custoUnidade)} · lucro {reais(v - custoUnidade)} por {UNIDADES[p.unidade] ?? p.unidade} ({((v - custoUnidade) / v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%) · {reais((v - custoUnidade) * quantidade)} no pedido
            </span>
          ) : (
            <span className="text-stone-500">Sem compra lançada desse fornecedor pra esse ovo: lance em Fornecedores pra ver a margem.</span>
          )}
          {usa !== null && dados && dados.saldo < usa && (
            <span className="ml-1 font-semibold text-amber-700">Estoque dele: {caixas(dados.saldo)} (o pedido usa {caixas(usa)}).</span>
          )}
        </p>
      )}
    </div>
  );
}
