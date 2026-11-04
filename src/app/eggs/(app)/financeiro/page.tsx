import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Handshake } from "lucide-react";
import { diaISO, formatarDia } from "@/lib/datas";
import { diasEntre, extratoDoCliente, type SituacaoConta } from "@/lib/financeiro";
import { nomeProduto, quantidade, reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { TituloEggs } from "../../guinho";

export const metadata: Metadata = { title: "Financeiro" };

const FILTROS = { todos: "Tudo", aberto: "Em aberto", pago: "Pagos" } as const;
type Filtro = keyof typeof FILTROS;

const SELO: Record<SituacaoConta, string> = {
  VENCIDA: "bg-tomate-500 text-white",
  ABERTA: "bg-gema-200 text-casca-900",
  AGENDADA: "bg-casca-100 text-casca-700",
  PAGA: "bg-green-100 text-green-900",
};

const curto = (dia: string) => formatarDia(dia, { day: "2-digit", month: "2-digit" });
const atraso = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function FinanceiroEggs({ searchParams }: PageProps<"/eggs/financeiro">) {
  const { cliente } = await exigirCliente();
  const { ver } = await searchParams;
  const filtro: Filtro = ver === "aberto" || ver === "pago" ? ver : "todos";
  const e = await extratoDoCliente(cliente.id);

  const selo = (l: (typeof e.linhas)[number]) => {
    if (l.situacao === "PAGA") return `Pago em ${curto(diaISO(l.pagoEm!))}`;
    if (l.situacao === "AGENDADA") return "Agendado";
    const d = diasEntre(e.hoje, l.vencimento);
    if (l.situacao === "VENCIDA") return `Vencido há ${-d} ${d === -1 ? "dia" : "dias"}`;
    return d === 0 ? "Vence hoje" : `Vence ${curto(l.vencimento)}`;
  };

  const visiveis = e.linhas.filter((l) =>
    filtro === "aberto" ? l.situacao !== "PAGA" : filtro === "pago" ? l.situacao === "PAGA" : true,
  );
  // Agrupa por mês da entrega
  const meses = new Map<string, typeof visiveis>();
  for (const l of visiveis) meses.set(l.entrega.slice(0, 7), [...(meses.get(l.entrega.slice(0, 7)) ?? []), l]);

  return (
    <div className="space-y-5">
      <TituloEggs pose="joinha">Financeiro</TituloEggs>

      {/* Resumo */}
      <section className={`eggs-entra rounded-[2rem] bg-casca-900 p-6 text-gema-50 ${e.vencido > 0 ? "ring-4 ring-tomate-500" : ""}`} style={atraso(0)}>
        <p className="text-xs font-bold uppercase tracking-wider text-gema-200">Valor em aberto</p>
        <p className="tabular mt-1 font-eggs text-5xl font-extrabold leading-none">{reais(e.emAberto)}</p>
        <p className="mt-2 text-sm text-gema-200">
          {e.contasAbertas === 0
            ? "Tudo em dia. Nenhuma conta em aberto."
            : `${e.contasAbertas} ${e.contasAbertas === 1 ? "pedido" : "pedidos"} aguardando pagamento`}
        </p>
        {e.vencido > 0 && e.vencidaMaisAntiga && (
          <p className="mt-3 rounded-2xl bg-tomate-500 px-3 py-2 text-sm font-bold text-white">
            {reais(e.vencido)} vencido desde {curto(e.vencidaMaisAntiga.vencimento)}. Fale com a Santimelo pra regularizar.
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-sm">
          <div>
            <dt className="text-gema-200">Próximo vencimento</dt>
            <dd className="tabular font-bold">{e.proximoVencimento ? `${curto(e.proximoVencimento.vencimento)} · ${reais(e.proximoVencimento.valor)}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-gema-200">Ainda não entregue</dt>
            <dd className="tabular font-bold">{e.agendado > 0 ? reais(e.agendado) : "—"}</dd>
          </div>
          <div>
            <dt className="text-gema-200">Pago em 30 dias</dt>
            <dd className="tabular font-bold">{reais(e.pago30)}</dd>
          </div>
          <div>
            <dt className="text-gema-200">Prazo</dt>
            <dd className="font-bold">{cliente.prazoPagamentoDias ? `${cliente.prazoPagamentoDias} dias após a entrega` : "Na entrega"}</dd>
          </div>
        </dl>
      </section>

      <p className="eggs-entra flex items-center gap-1.5 px-1 text-xs text-casca-700" style={atraso(1)}>
        <Handshake className="size-4 shrink-0" />
        Pagamento: {cliente.formaPagamento ?? "a combinar"}. O pedido entra aqui assim que você faz; o prazo conta a partir da entrega.
      </p>

      {/* Filtro */}
      <nav className="eggs-entra flex gap-2" style={atraso(2)} aria-label="Filtrar extrato">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <Link
            key={f}
            href={f === "todos" ? "/eggs/financeiro" : `/eggs/financeiro?ver=${f}`}
            aria-current={filtro === f ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${filtro === f ? "bg-casca-900 text-gema-50" : "bg-white text-casca-700 ring-1 ring-casca-100"}`}
          >
            {FILTROS[f]}
          </Link>
        ))}
      </nav>

      {/* Extrato por mês */}
      {[...meses.entries()].map(([mes, linhas], n) => {
        const total = linhas.reduce((t, l) => t + l.valor, 0);
        const pago = linhas.filter((l) => l.pagoEm).reduce((t, l) => t + l.valor, 0);
        return (
          <section key={mes} className="eggs-entra cartao-eggs p-0" style={atraso(3 + Math.min(n, 4))}>
            <header className="flex items-center justify-between gap-3 border-b border-casca-100 px-5 py-3">
              <h2 className="font-eggs text-lg font-extrabold">
                <span className="capitalize">{formatarDia(`${mes}-01`, { month: "long" })}</span>{" "}
                <span className="text-sm font-semibold text-casca-500">{mes.slice(0, 4)}</span>
              </h2>
              <p className="tabular text-right text-xs leading-tight text-casca-500">
                <span className="block text-sm font-bold text-casca-900">{reais(total)}</span>
                pago {reais(pago)}
              </p>
            </header>
            <ul className="divide-y divide-casca-100">
              {linhas.map((l) => (
                <li key={l.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{l.pedidoId ? `Pedido #${l.pedidoId}` : "Cobrança"}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-casca-500">
                          entrega {curto(l.entrega)}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SELO[l.situacao]}`}>{selo(l)}</span>
                        </span>
                      </span>
                      <span className={`tabular font-bold ${l.situacao === "PAGA" ? "text-casca-500" : ""}`}>{reais(l.valor)}</span>
                      <ChevronDown className="size-4 shrink-0 text-casca-500 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 bg-gema-50 px-5 py-3 text-sm">
                      {l.pedido && (
                        <ul className="space-y-1 text-[13px]">
                          {l.pedido.itens.map((i) => (
                            <li key={i.id} className="flex justify-between gap-3">
                              <span>
                                <span className="tabular font-semibold">{quantidade(i.quantidade, i.produto.unidade)}</span> {nomeProduto(i.produto)} × {reais(i.precoUnit)}
                              </span>
                              <span className="tabular">{reais(i.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <dl className="grid grid-cols-3 gap-2 border-t border-dashed border-casca-200 pt-2 text-xs">
                        <div>
                          <dt className="text-casca-500">Entrega</dt>
                          <dd className="font-bold">{curto(l.entrega)}</dd>
                        </div>
                        <div>
                          <dt className="text-casca-500">Vencimento</dt>
                          <dd className="font-bold">{curto(l.vencimento)}</dd>
                        </div>
                        <div>
                          <dt className="text-casca-500">Pagamento</dt>
                          <dd className="font-bold">{l.pagoEm ? curto(diaISO(l.pagoEm)) : "em aberto"}</dd>
                        </div>
                      </dl>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {visiveis.length === 0 && (
        <p className="cartao-eggs text-center text-casca-700">
          {filtro === "aberto" ? "Nenhuma conta em aberto. Tudo em dia!" : filtro === "pago" ? "Nenhum pagamento registrado ainda." : "Nenhum pedido ainda."}
        </p>
      )}
    </div>
  );
}
