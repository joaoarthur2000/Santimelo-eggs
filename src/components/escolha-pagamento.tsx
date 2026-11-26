"use client";

import { CampoData } from "@/components/campo-data";
import { Banknote, CalendarClock, HandCoins, QrCode, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { somarDias } from "@/lib/datas";
import { CONDICOES_DO_PEDIDO, FORMAS_DO_PEDIDO, type CondicaoDoPedido, type FormaDoPedido, type PagamentoEscolhido } from "@/lib/pagamento";

/** `dias`: prazo contado da entrega (muda junto com ela). `data`: dia escolhido no calendário (não muda) */
export type Pagamento = { forma: FormaDoPedido | ""; condicao: CondicaoDoPedido; dias: number | null; data: string };

const ATALHOS = [7, 14, 21, 28, 30];
const ICONE_FORMA: Record<FormaDoPedido, LucideIcon> = { Dinheiro: Banknote, Pix: QrCode };
const ICONE_CONDICAO: Record<CondicaoDoPedido, LucideIcon> = { VISTA: HandCoins, PRAZO: CalendarClock };

/** Começa pelo combinado com o cliente */
export function pagamentoInicial(cliente?: { forma: string | null; prazo: number | null }): Pagamento {
  const forma = FORMAS_DO_PEDIDO.find((f) => f === cliente?.forma) ?? "";
  return { forma, condicao: cliente?.prazo ? "PRAZO" : "VISTA", dias: cliente?.prazo || 7, data: "" };
}

export const vencimentoEscolhido = (p: Pagamento, entrega: string) => (p.condicao === "VISTA" ? null : p.dias !== null ? somarDias(entrega, p.dias) : p.data || null);

/** O que falta preencher (ou nada) */
export function faltaNoPagamento(p: Pagamento, entrega: string) {
  if (!p.forma) return "Escolha se o cliente paga em dinheiro ou Pix.";
  const v = vencimentoEscolhido(p, entrega);
  if (p.condicao === "PRAZO" && !v) return "Escolha a data do pagamento a prazo.";
  if (v && v < entrega) return "A data do pagamento não pode ser antes da entrega.";
  return null;
}

export const paraEnviar = (p: Pagamento, entrega: string): PagamentoEscolhido => ({ formaPagamento: p.forma as FormaDoPedido, condicaoPagamento: p.condicao, vencimento: vencimentoEscolhido(p, entrega) });

function Segmentos<T extends string>({ rotulo, nome, opcoes, valor, aoMudar }: { rotulo: string; nome: string; opcoes: { id: T; texto: string; icone: LucideIcon }[]; valor: T | ""; aoMudar: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-2 gap-1 rounded-[10px] bg-stone-100 p-1">
      {opcoes.map(({ id, texto, icone: Icone }) => (
        <label key={id} className="cursor-pointer">
          <input type="radio" name={nome} value={id} checked={valor === id} onChange={() => aoMudar(id)} className="peer sr-only" />
          <span className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm text-stone-600 transition-[background-color,color,box-shadow] duration-150 peer-checked:bg-white peer-checked:font-semibold peer-checked:text-marca-950 peer-checked:shadow-[0_1px_2px_rgb(41_28_18/0.16)] peer-focus-visible:ring-2 peer-focus-visible:ring-marca-500/40 hover:text-marca-950 max-lg:py-3">
            <Icone className="size-4" strokeWidth={1.75} aria-hidden /> {texto}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Forma (dinheiro ou Pix) e condição (à vista ou a prazo com data) do pedido */
export function EscolhaPagamento({ valor, entrega, aoMudar }: { valor: Pagamento; entrega: string; aoMudar: (p: Pagamento) => void }) {
  const id = useId();
  const vencimento = vencimentoEscolhido(valor, entrega);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Como vai pagar</legend>
      <Segmentos rotulo="Forma de pagamento" nome={`${id}-forma`} valor={valor.forma} aoMudar={(forma) => aoMudar({ ...valor, forma })} opcoes={FORMAS_DO_PEDIDO.map((f) => ({ id: f, texto: f, icone: ICONE_FORMA[f] }))} />
      <Segmentos
        rotulo="Condição de pagamento"
        nome={`${id}-condicao`}
        valor={valor.condicao}
        aoMudar={(condicao) => aoMudar({ ...valor, condicao })}
        opcoes={(Object.keys(CONDICOES_DO_PEDIDO) as CondicaoDoPedido[]).map((c) => ({ id: c, texto: CONDICOES_DO_PEDIDO[c], icone: ICONE_CONDICAO[c] }))}
      />
      {valor.condicao === "PRAZO" && (
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="flex gap-1.5" role="group" aria-label="Prazo depois da entrega">
            {ATALHOS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={valor.dias === d}
                onClick={() => aoMudar({ ...valor, dias: d, data: "" })}
                className={`tabular min-w-0 flex-1 rounded-lg py-1.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset transition-colors duration-150 max-lg:min-h-11 ${
                  valor.dias === d ? "bg-marca-900 text-white ring-marca-900" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
                }`}
              >
                {d} d
              </button>
            ))}
          </div>
          <label className="mt-2.5 block">
            <span className="text-xs font-medium text-stone-600">Data do pagamento</span>
            <CampoData value={vencimento ?? ""} onChange={(data) => aoMudar({ ...valor, dias: null, data })} min={entrega} required className="campo mt-1" aria-label="Data do pagamento" />
          </label>
        </div>
      )}
      {valor.condicao === "VISTA" && <p className="text-xs text-stone-500">Vence no dia da entrega.</p>}
    </fieldset>
  );
}
