import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { GraficoVendas } from "@/components/grafico-vendas";
import { Cabecalho, Codigo, Vazio } from "@/components/ui";
import { PERIODOS, type Periodo } from "@/lib/constantes";
import { COR_CUSTO, COR_LUCRO } from "@/lib/cores";
import { diaISO, diaValido } from "@/lib/datas";
import { num, pct, quantidade, reais } from "@/lib/formato";
import { relatorioVendas } from "@/lib/relatorio";
import { BotaoImprimir } from "./botao-imprimir";

export const metadata: Metadata = { title: "Relatórios" };

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;

/** Seta e % em relação ao período anterior. Cor só reforça: o texto diz se subiu ou caiu */
function Variacao({ atual, antes, rotulo, inverter = false }: { atual: number; antes: number; rotulo: string; inverter?: boolean }) {
  if (!antes) return <p className="mt-1 text-xs text-stone-500">sem vendas {rotulo}</p>;
  const v = (atual - antes) / Math.abs(antes);
  const igual = Math.abs(v) < 0.005;
  const bom = inverter ? v < 0 : v > 0;
  const Icone = igual ? Minus : v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="mt-1 text-xs text-stone-500">
      <span className={`whitespace-nowrap font-semibold ${igual ? "" : bom ? "text-green-700" : "text-red-700"}`}>
        <Icone className="-mt-0.5 inline size-3.5" aria-hidden /> {igual ? "igual" : `${v > 0 ? "subiu" : "caiu"} ${pct(Math.abs(v))}`}
      </span>{" "}
      vs {rotulo}
    </p>
  );
}

function Bloco({ rotulo, valor, children, destaque = false }: { rotulo: string; valor: string; children?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`cartao p-4 ${destaque ? "ring-2 ring-[#2a78d6]/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-bold text-marca-950">{valor}</p>
      {children}
    </div>
  );
}

export default async function Relatorios({ searchParams }: PageProps<"/painel/relatorios">) {
  const params = await searchParams;
  const periodo: Periodo = typeof params.periodo === "string" && params.periodo in PERIODOS ? (params.periodo as Periodo) : "dia";
  const dia = diaValido(params.dia);
  const r = await relatorioVendas(periodo, dia);
  const link = (p: Periodo, d: string) => `/painel/relatorios?periodo=${p}&dia=${d}`;
  const t = r.total;
  const a = r.antes;

  // Destaques em uma frase: o melhor dia e o produto que mais deu lucro
  const dias = r.porFaixa.filter((f) => f.faturamento > 0);
  const melhorDia = periodo !== "dia" && dias.length > 1 ? dias.reduce((m, f) => (f.lucro > m.lucro ? f : m)) : null;
  const melhorProduto = r.porProduto.length > 1 ? r.porProduto.reduce((m, p) => (p.lucro > m.lucro ? p : m)) : null;
  const semCusto = t.semCusto > 0;
  const temAgendado = r.fim >= diaISO();
  const grafico = r.porFaixa.map((f) => ({ rotulo: f.faixa, faturamento: f.faturamento, custo: f.custo, lucro: f.lucro, semCusto: f.semCusto }));

  return (
    <>
      <Cabecalho titulo="Relatório de vendas" subtitulo={`${PERIODOS[periodo]} · ${r.titulo}`}>
        <nav className="flex rounded-lg bg-white p-1 ring-1 ring-stone-200 print:hidden" aria-label="Período">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <Link key={p} href={link(p, dia)} aria-current={p === periodo ? "page" : undefined} className={`rounded-md px-4 py-1.5 text-sm font-medium ${p === periodo ? "bg-marca-800 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {p === "dia" ? "Diário" : p === "semana" ? "Semanal" : "Mensal"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 print:hidden">
          <Link href={link(periodo, r.anterior)} className="botao-secundario px-2" aria-label="Período anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <form action="/painel/relatorios" className="contents">
            <input type="hidden" name="periodo" value={periodo} />
            <input type="date" name="dia" defaultValue={dia} className="campo w-auto" aria-label="Escolher data" />
            <button className="botao-secundario">Ir</button>
          </form>
          <Link href={link(periodo, r.proximo)} className="botao-secundario px-2" aria-label="Próximo período">
            <ChevronRight className="size-4" />
          </Link>
          {dia !== diaISO() && (
            <Link href={link(periodo, diaISO())} className="botao-secundario">
              Hoje
            </Link>
          )}
          <BotaoImprimir />
        </div>
      </Cabecalho>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 [&>*]:min-w-0">
        <Bloco rotulo="Faturamento" valor={reais(t.faturamento)}>
          <Variacao atual={t.faturamento} antes={a.faturamento} rotulo={r.anteriorRotulo} />
        </Bloco>
        <Bloco rotulo="Custo dos ovos" valor={reais(t.custo)}>
          <Variacao atual={t.custo} antes={a.custo} rotulo={r.anteriorRotulo} inverter />
        </Bloco>
        <Bloco rotulo={t.lucro < 0 ? "Prejuízo" : "Lucro"} valor={reais(t.lucro)} destaque>
          <Variacao atual={t.lucro} antes={a.lucro} rotulo={r.anteriorRotulo} />
        </Bloco>
        <Bloco rotulo="Margem" valor={t.margem !== null ? pct(t.margem) : "—"}>
          <p className="mt-1 text-xs text-stone-500">{a.margem !== null ? `era ${pct(a.margem)} ${r.anteriorRotulo}` : "de cada R$ 100 vendidos"}</p>
        </Bloco>
        <Bloco rotulo="Caixas vendidas" valor={cx(t.caixas)}>
          <p className="mt-1 text-xs text-stone-500">{t.caixas > 0 ? `lucro de ${reais(t.lucro / t.caixas)} por caixa` : "caixa = 360 ovos"}</p>
        </Bloco>
        <Bloco rotulo="Pedidos" valor={num(t.pedidos)}>
          <p className="mt-1 text-xs text-stone-500">{t.pedidos > 0 ? `${num(t.clientes)} clientes · ticket ${reais(t.faturamento / t.pedidos)}` : `${num(a.pedidos)} ${r.anteriorRotulo}`}</p>
        </Bloco>
      </section>

      {(melhorDia || melhorProduto || semCusto) && (
        <ul className="mt-4 space-y-1 rounded-xl bg-gema-50 px-4 py-3 text-sm text-casca-900 ring-1 ring-gema-200">
          {melhorDia && (
            <li>
              <b>Melhor dia:</b> {melhorDia.faixa}, com {reais(melhorDia.lucro)} de lucro em {reais(melhorDia.faturamento)} vendidos.
            </li>
          )}
          {melhorProduto && (
            <li>
              <b>Produto que mais deu lucro:</b> {melhorProduto.nome}: {reais(melhorProduto.lucro)}
              {melhorProduto.margem !== null && ` (margem de ${pct(melhorProduto.margem)})`}.
            </li>
          )}
          {semCusto && (
            <li className="text-amber-800">
              <b>Atenção:</b> {reais(t.semCusto)} em vendas de ovo sem nenhuma compra lançada no estoque. Esse valor fica fora do lucro até você lançar a compra.
            </li>
          )}
        </ul>
      )}

      <section className="mt-6 cartao p-5">
        <h2 className="font-semibold text-marca-950">{periodo === "dia" ? "Faturamento, custo e lucro: últimos 14 dias" : "Faturamento, custo e lucro dia a dia"}</h2>
        <p className="mb-4 text-xs text-stone-500">
          Pela data de entrega dos pedidos. Custo = caixas vendidas × custo médio de compra da caixa.{periodo === "dia" && " O dia escolhido é a barra forte."}
          {temAgendado && " Inclui pedidos agendados que ainda vão ser entregues."}
        </p>
        <GraficoVendas dados={grafico} destaque={periodo === "dia" ? grafico.length - 1 : undefined} />
        <details className="mt-3 text-sm print:hidden">
          <summary className="cursor-pointer text-marca-700 hover:underline">Ver os números dia a dia</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2 pr-4">Dia</th>
                  <th className="py-2 pr-4 text-right">Faturamento</th>
                  <th className="py-2 pr-4 text-right">Custo</th>
                  <th className="py-2 text-right">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {r.porFaixa.map((f) => (
                  <tr key={f.faixa}>
                    <td className="py-1.5 pr-4">{f.faixa}</td>
                    <td className="tabular py-1.5 pr-4 text-right">{reais(f.faturamento)}</td>
                    <td className="tabular py-1.5 pr-4 text-right">{reais(f.custo)}</td>
                    <td className="tabular py-1.5 text-right font-semibold">{reais(f.lucro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-6 grid gap-6 2xl:grid-cols-[2fr_3fr] [&>*]:min-w-0">
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Lucro por produto</h2>
          <p className="mb-4 text-xs text-stone-500">Quanto cada produto vendeu e quanto sobrou depois do custo</p>
          {r.porProduto.length === 0 ? (
            <Vazio>Nenhuma venda no período.</Vazio>
          ) : (
            <GraficoVendas
              horizontal
              altura={Math.max(140, r.porProduto.length * 52)}
              dados={r.porProduto.map((p) => ({ rotulo: `${p.nome.split(" · ")[0]} · ${p.unidade === "caixa" ? "caixa" : "bandeja"}`, faturamento: p.faturamento, custo: p.custo, lucro: p.lucro, semCusto: p.semCusto }))}
            />
          )}
        </div>

        <div className="cartao overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold text-marca-950">Custo, faturamento e lucro de cada produto</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="min-w-52 px-4 py-2">Produto</th>
                <th className="px-4 py-2 text-right">Vendido</th>
                <th className="px-4 py-2 text-right">Custo unit.</th>
                <th className="px-4 py-2 text-right">Faturamento</th>
                <th className="px-4 py-2 text-right">Custo</th>
                <th className="px-4 py-2 text-right">Lucro</th>
                <th className="w-32 px-4 py-2">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.porProduto.map((p) => (
                <tr key={p.nome}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <Codigo codigo={p.codigo} />
                      <span>
                        <span className="font-medium">{p.nome.split(" · ")[0]}</span>
                        <span className="block text-xs text-stone-500">{p.nome.split(" · ")[1]}</span>
                      </span>
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">{quantidade(p.quantidade, p.unidade)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-stone-600">{p.custoUnit !== null ? reais(p.custoUnit) : "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right">{reais(p.faturamento)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{reais(p.custo)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold">{reais(p.lucro)}</td>
                  <td className="px-4 py-2.5">
                    {p.margem !== null ? (
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: `${COR_CUSTO}33` }} aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, p.margem)) * 100}%`, background: COR_LUCRO }} />
                        </span>
                        <span className="tabular w-10 text-right text-xs font-semibold">{pct(p.margem)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-stone-500">sem custo</span>
                    )}
                  </td>
                </tr>
              ))}
              {r.porProduto.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-500">Nenhuma venda no período.</td>
                </tr>
              )}
            </tbody>
            {r.porProduto.length > 0 && (
              <tfoot className="border-t border-stone-200 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="tabular px-4 py-3 text-right">{cx(t.caixas)}</td>
                  <td />
                  <td className="tabular px-4 py-3 text-right">{reais(t.faturamento)}</td>
                  <td className="tabular px-4 py-3 text-right">{reais(t.custo)}</td>
                  <td className="tabular px-4 py-3 text-right">{reais(t.lucro)}</td>
                  <td className="tabular px-4 py-3 text-xs">{t.margem !== null ? pct(t.margem) : ""}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold text-marca-950">Quem mais comprou</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Pedidos</th>
                <th className="px-4 py-2 text-right">Caixas</th>
                <th className="px-4 py-2 text-right">Faturamento</th>
                <th className="px-4 py-2 text-right">Lucro</th>
                <th className="px-4 py-2 text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.porCliente.map((c) => (
                <tr key={c.nome}>
                  <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                  <td className="tabular px-4 py-2.5 text-right">{num(c.pedidos)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{cx(c.caixas)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{reais(c.faturamento)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold">{reais(c.lucro)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{c.margem !== null ? pct(c.margem) : "—"}</td>
                </tr>
              ))}
              {r.porCliente.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhuma venda no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Compras de ovos no período</h2>
          <p className="mt-1 text-xs text-stone-500">O que entrou no estoque (granja, CEASA). Base do custo médio.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-stone-500">Caixas compradas</dt>
              <dd className="tabular text-xl font-bold">{cx(r.compras.caixas)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Valor pago</dt>
              <dd className="tabular text-xl font-bold">{reais(r.compras.valor)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Custo médio da caixa</dt>
              <dd className="tabular text-xl font-bold">{r.compras.caixas > 0 ? reais(r.compras.valor / r.compras.caixas) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Vendidas − compradas</dt>
              <dd className="tabular text-xl font-bold">{cx(t.caixas - r.compras.caixas)}</dd>
            </div>
          </dl>
          <Link href="/painel/estoque" className="mt-4 inline-block text-sm text-marca-700 hover:underline print:hidden">
            Lançar compra no estoque →
          </Link>
        </div>
      </section>
    </>
  );
}
