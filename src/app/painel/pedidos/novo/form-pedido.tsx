"use client";

import { CampoData } from "@/components/campo-data";
import { EscolhaPagamento, faltaNoPagamento, pagamentoInicial, paraEnviar, type Pagamento } from "@/components/escolha-pagamento";
import { useState, useTransition } from "react";
import { History, Minus, Plus } from "lucide-react";
import { UNIDADES } from "@/lib/constantes";
import { criarPedido, editarPedido } from "../actions";

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
type ClienteForm = { id: string; nome: string; forma: string | null; prazo: number | null; precos: Record<string, number>; ultimoPedido: { produtoId: string; quantidade: number }[] };
type Fornecedor = { id: string; nome: string };
/** chave "fornecedorId|itemId" → caixas em estoque e custo médio da caixa */
type PorFornecedor = Record<string, { saldo: number; custo: number | null }>;

/** Pedido já lançado, pra editar */
export type EdicaoPedido = {
  id: number;
  clienteId: string;
  origem: string;
  observacao: string;
  entregue: boolean;
  /** valor já recebido (trava valor e cliente); nulo = ainda em aberto */
  pago: number | null;
  itens: { produtoId: string; quantidade: number; precoUnit: number; fornecedorId: string | null }[];
  pagamento: Pagamento;
};

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
  hoje,
  voltarProDia = false,
  edicao,
}: {
  produtos: ProdutoCatalogo[];
  clientes: ClienteForm[];
  fornecedores: Fornecedor[];
  porFornecedor: PorFornecedor;
  diaInicial: string;
  hoje: string;
  /** veio do Dia a dia: volta pra lá depois de salvar */
  voltarProDia?: boolean;
  edicao?: EdicaoPedido;
}) {
  const doPedido = <T,>(f: (i: EdicaoPedido["itens"][number]) => T): Record<string, T> => Object.fromEntries((edicao?.itens ?? []).map((i) => [i.produtoId, f(i)]));
  const [clienteId, setClienteId] = useState(edicao?.clienteId ?? "");
  const [dia, setDia] = useState(diaInicial);
  const [origem, setOrigem] = useState<"WHATSAPP" | "PAINEL">(edicao?.origem === "PAINEL" ? "PAINEL" : "WHATSAPP");
  const [observacao, setObservacao] = useState(edicao?.observacao ?? "");
  const [pagamento, setPagamento] = useState(() => edicao?.pagamento ?? pagamentoInicial());
  // dia que já passou: normalmente a entrega já aconteceu
  const [marcouEntregue, setEntregue] = useState<boolean | null>(edicao ? edicao.entregue : null);
  const [recebido, setRecebido] = useState(false);
  const jaChegou = dia <= hoje;
  const entregue = marcouEntregue ?? dia < hoje;
  const [qtd, setQtd] = useState<Record<string, number>>(() => doPedido((i) => i.quantidade));
  const [valor, setValor] = useState<Record<string, string>>(() => doPedido((i) => comoTexto(i.precoUnit)));
  const [fornecedor, setFornecedor] = useState<Record<string, string>>(() => doPedido((i) => i.fornecedorId ?? ""));
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
    setPagamento(pagamentoInicial(clientes.find((c) => c.id === id))); // idem a forma e o prazo
  }

  function repetirUltimo() {
    if (!cliente) return;
    setQtd(Object.fromEntries(cliente.ultimoPedido.map((i) => [i.produtoId, i.quantidade])));
  }

  function enviar() {
    setErro(undefined);
    if (valorInvalido) return setErro("Confira o valor de cada produto.");
    if (faltaFornecedor) return setErro("Escolha o fornecedor de cada produto.");
    const falta = faltaNoPagamento(pagamento, dia);
    if (falta) return setErro(falta);
    iniciar(async () => {
      const dados = {
        clienteId,
        dia,
        origem,
        observacao,
        pagamento: paraEnviar(pagamento, dia),
        itens: linhas.map((p) => ({ produtoId: p.id, quantidade: qtd[p.id], precoUnit: precoDe(p)!, fornecedorId: fornecedor[p.id] })),
        entregue: jaChegou || edicao ? entregue : false,
        recebido: jaChegou && !edicao && recebido,
        voltarProDia,
      };
      const r = edicao ? await editarPedido(edicao.id, dados) : await criarPedido(dados);
      if (r?.erro) setErro(r.erro);
    });
  }

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
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
              <div className="flex items-center gap-2 max-lg:w-full">
                <button type="button" onClick={() => mudar(p, -(PASSO[p.unidade] ?? 1))} disabled={q === 0} className="botao-secundario size-9 p-0 max-lg:h-12 max-lg:w-14" aria-label={`Menos ${p.item} ${p.embalagem}`}>
                  <Minus className="size-4" />
                </button>
                <span className="tabular hidden w-16 text-center font-semibold lg:inline">
                  {q} {UNIDADES[p.unidade] ?? p.unidade}
                </span>
                <QuantidadeDigitada valor={q} unidade={UNIDADES[p.unidade] ?? p.unidade} rotulo={`Quantidade de ${p.item} ${p.embalagem}`} aoMudar={(v) => setQtd((x) => ({ ...x, [p.id]: v }))} />
                <button type="button" onClick={() => mudar(p, PASSO[p.unidade] ?? 1)} className="botao-secundario size-9 p-0 max-lg:h-12 max-lg:w-14" aria-label={`Mais ${p.item} ${p.embalagem}`}>
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

      {/* no celular este cartão se abre em dois: cliente e entrega em cima, resumo no fim */}
      <aside className="h-fit max-xl:contents xl:sticky xl:top-6 xl:space-y-4 xl:rounded-2xl xl:border xl:border-stone-200/80 xl:bg-white xl:p-5 xl:shadow-cartao">
        <div className="max-xl:order-first max-xl:min-w-0 max-xl:rounded-2xl max-xl:border max-xl:border-stone-200/80 max-xl:bg-white max-xl:p-4 max-xl:shadow-cartao space-y-4">
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
        {edicao?.pago != null && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">Já pago ({reais(edicao.pago)}). Pra mudar valor ou cliente, desfaça o pagamento na tela do pedido.</p>}
        {!edicao && cliente && cliente.ultimoPedido.length > 0 && (
          <button type="button" onClick={repetirUltimo} className="botao-secundario w-full">
            <History className="size-4" /> Repetir o último pedido
          </button>
        )}
        <div className={`grid gap-3 ${edicao?.origem === "APP" ? "" : "grid-cols-2"}`}>
          <label className="block">
            <span className="text-sm font-medium">Entrega</span>
            <CampoData value={dia} onChange={setDia} required className="campo mt-1" />
          </label>
          {edicao?.origem !== "APP" && (
            <label className="block">
              <span className="text-sm font-medium">Chegou por</span>
              <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)} className="campo mt-1">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PAINEL">Telefone / balcão</option>
              </select>
            </label>
          )}
        </div>
        <EscolhaPagamento valor={pagamento} entrega={dia} aoMudar={setPagamento} />
        {(jaChegou || edicao) && (
          <div className="space-y-1">
            <Marcador marcado={entregue} aoMudar={setEntregue} texto="Já foi entregue" detalhe="baixa as caixas do estoque no dia da entrega" />
            {!edicao && <Marcador marcado={recebido} aoMudar={setRecebido} texto="Já recebi o pagamento" detalhe="não fica em aberto" />}
          </div>
        )}
        </div>
        <div className="max-xl:min-w-0 max-xl:rounded-2xl max-xl:border max-xl:border-stone-200/80 max-xl:bg-white max-xl:p-4 max-xl:shadow-cartao space-y-4">
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
        {erro && <p className="text-sm text-red-600 max-lg:hidden">{erro}</p>}
        {!erro && linhas.length > 0 && faltaFornecedor > 0 && <p className="text-xs text-amber-700">Falta escolher o fornecedor de {faltaFornecedor} produto(s).</p>}
        <button type="button" onClick={enviar} disabled={enviando || !clienteId || linhas.length === 0} className="botao-primario w-full max-lg:hidden">
          {enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Salvar pedido"}
        </button>
        </div>
      </aside>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700 lg:hidden">{erro}</p>}
      <div className="acao-fixa lg:hidden">
        <span className="min-w-0">
          <span className="block text-sm leading-tight text-stone-500">{linhas.length ? (!clienteId ? "falta o cliente" : faltaFornecedor ? "falta o fornecedor" : faltaNoPagamento(pagamento, dia) ? "falta o pagamento" : "Total") : "Total"}</span>
          <span className="tabular block text-lg leading-tight font-bold text-marca-950">{reais(total)}</span>
        </span>
        <button type="button" onClick={enviar} disabled={enviando || !clienteId || linhas.length === 0} className="botao-primario flex-1">
          {enviando ? "Salvando…" : edicao ? "Salvar alterações" : "Salvar pedido"}
        </button>
      </div>
    </div>
  );
}

function Marcador({ marcado, aoMudar, texto, detalhe }: { marcado: boolean; aoMudar: (v: boolean) => void; texto: string; detalhe: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-marca-900 max-lg:size-6" />
      <span className="text-sm font-medium">
        {texto} <span className="block text-xs font-normal text-stone-500">{detalhe}</span>
      </span>
    </label>
  );
}

/** Celular: quantidade digitada direto (10 caixas não são 20 toques no +). Aceita "2,5" */
function QuantidadeDigitada({ valor, unidade, rotulo, aoMudar }: { valor: number; unidade: string; rotulo: string; aoMudar: (v: number) => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <label className="relative flex-1 lg:hidden">
      <input
        inputMode="decimal"
        aria-label={rotulo}
        value={texto ?? (valor ? String(valor).replace(".", ",") : "")}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setTexto(t);
          aoMudar(Math.round((numero(t) ?? 0) * 10) / 10);
        }}
        onBlur={() => setTexto(null)}
        className="campo tabular h-12 pr-14 text-center font-semibold"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-stone-500">{unidade}</span>
    </label>
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
