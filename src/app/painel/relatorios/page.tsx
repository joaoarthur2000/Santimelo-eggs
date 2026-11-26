import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { GraficoVendas } from "@/components/graficos";
import { Recolhe } from "@/components/recolhe";
import { Cabecalho, Codigo, SeletorDia, Vazio } from "@/components/ui";
import { PERIODOS, type Periodo } from "@/lib/constantes";
import { COR_CUSTO, COR_LUCRO } from "@/lib/cores";
import { diaISO, diaValido, formatarDia } from "@/lib/datas";
import { num, pct, quantidade, reais } from "@/lib/formato";
import { relatorioVendas } from "@/lib/relatorio";
import { BotaoImprimir } from "./botao-imprimir";

export const metadata: Metadata = { title: "Relatórios" };

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;
const km = (v: number) => `${num(Math.round(v * 10) / 10)} km`;
const litros = (v: number) => `${num(Math.round(v * 10) / 10)} L`;

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
  const f = r.fechamento;
  const grafico = r.porFaixa.map((f) => ({ rotulo: f.faixa, faturamento: f.faturamento, custo: f.custo, lucro: f.lucro, semCusto: f.semCusto }));

  return (
    <>
      <Cabecalho titulo="Relatórios e fechamento" subtitulo={`${PERIODOS[periodo]} · ${r.titulo}`}>
        <nav className="flex rounded-lg bg-white p-1 ring-1 ring-stone-200 max-lg:w-full max-lg:rounded-xl print:hidden" aria-label="Período">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <Link key={p} href={link(p, dia)} aria-current={p === periodo ? "page" : undefined} className={`rounded-md px-4 py-1.5 text-center text-sm font-medium max-lg:flex-1 max-lg:rounded-lg max-lg:py-2.5 ${p === periodo ? "bg-marca-800 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {p === "dia" ? "Diário" : p === "semana" ? "Semanal" : "Mensal"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 max-lg:w-full max-lg:gap-2 print:hidden">
          <SeletorDia dia={dia} rota="/painel/relatorios" extra={{ periodo }} anterior={r.anterior} proximo={r.proximo} rotulo={periodo === "dia" ? undefined : r.titulo} />
          {dia !== diaISO() && (
            <Link href={link(periodo, diaISO())} className="botao-secundario max-lg:px-3">
              Hoje
            </Link>
          )}
          {periodo === "dia" && <Link href={`/painel/dia?dia=${dia}`} className="botao-secundario max-lg:hidden">Ver e editar o dia</Link>}
          <span className="max-lg:hidden"><BotaoImprimir /></span>
        </div>
      </Cabecalho>

      {periodo === "dia" && <Link href={`/painel/dia?dia=${dia}`} className="botao-secundario mb-4 w-full lg:hidden">Ver e editar vendas e compras do dia</Link>}

      {/* Fechamento: da venda ao lucro que sobra, e o dinheiro que entrou */}
      <section className="mb-6 grid gap-4 rounded-2xl bg-marca-900 p-5 text-white lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-marca-200">Fechamento · {r.titulo}</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt>Faturamento</dt><dd className="tabular font-semibold">{reais(t.faturamento)}</dd></div>
            <div className="flex justify-between gap-3 text-marca-100"><dt>− Custo das mercadorias</dt><dd className="tabular">{reais(t.custo + t.semCusto)}</dd></div>
            <div className="flex justify-between gap-3 text-marca-100">
              <dt>
                − Veículo <Link href="/painel/veiculos" className="text-xs text-marca-200 underline-offset-2 hover:underline print:hidden">detalhes</Link>
                <span className="block text-xs text-marca-200">combustível {reais(f.combustivel)} ({km(f.km)} · {litros(f.litros)}) · manutenção {reais(f.veiculoManutencao)} · fixos {reais(f.veiculoFixos)}</span>
              </dt>
              <dd className="tabular">{reais(f.veiculo)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-marca-100">
              <dt>− Despesas <Link href="/painel/despesas" className="text-xs text-marca-200 underline-offset-2 hover:underline print:hidden">lançar</Link></dt>
              <dd className="tabular">{reais(f.despesas)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-white/20 pt-2">
              <dt className="font-semibold">{f.lucroLiquido < 0 ? "Prejuízo" : "Lucro líquido"}</dt>
              <dd className={`tabular text-3xl font-extrabold ${f.lucroLiquido < 0 ? "text-red-300" : "text-gema-300"}`}>{reais(f.lucroLiquido)}</dd>
            </div>
          </dl>
          {f.diasSemRota > 0 && <p className="mt-2 text-xs text-gema-200">{f.diasSemRota} dia(s) com entrega sem rota gerada: o combustível desses dias não entrou. Gere em Rotas.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Recebido", reais(f.recebido), `${num(f.recebimentos)} pagamentos no período`],
            ["A receber hoje", reais(f.aReceber), f.vencido ? `${reais(f.vencido)} vencido` : "nada vencido"],
            ["Entregas", num(f.entregas), `${cx(t.caixas)} entregues`],
            ["Km rodados", km(f.km), f.km ? `${reais(f.combustivel / f.km)} por km` : "gere as rotas"],
            ["Veículo por caixa", t.caixas && f.veiculo ? reais(f.veiculo / t.caixas) : "—", "Fiorino ÷ caixas entregues"],
            ["Atendimentos", num(f.atendimentos), f.atendimentosAbertos ? `${num(f.atendimentosAbertos)} ainda abertos` : "todos resolvidos"],
          ].map(([rotulo, valor, sub], n) => (
            <div key={rotulo} className={`rounded-xl bg-white/10 p-3 ${n === 1 && f.vencido ? "ring-2 ring-red-300" : ""}`}>
              <p className="text-xs uppercase tracking-wide text-marca-200">{rotulo}</p>
              <p className="tabular text-lg font-bold">{valor}</p>
              <p className="text-xs text-marca-100">{sub}</p>
            </div>
          ))}
        </div>
      </section>

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
          <summary className="cursor-pointer text-marca-700 hover:underline max-lg:py-3">Ver os números dia a dia</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm max-lg:[&_td]:pr-2 max-lg:[&_th]:pr-2">
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
                    <td className="py-1.5 pr-4"><Link href={`/painel/dia?dia=${f.dia}`} className="toque text-marca-700 hover:underline">{f.faixa}</Link></td>
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
          <table className="lista-cel mt-3 w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="min-w-52 px-4 py-2">Produto</th>
                <th className="px-4 py-2 text-right">Vendido</th>
                <th className="px-4 py-2 text-right">Custo unit.</th>
                <th className="px-4 py-2 text-right">Faturamento</th>
                <th className="px-4 py-2 text-right">Custo</th>
                <th className="px-4 py-2 text-right">Lucro</th>
                <th className="px-4 py-2 text-right" title="Lucro ÷ custo: quanto se coloca em cima do custo">Markup</th>
                <th className="w-32 px-4 py-2" title="Lucro ÷ venda: quanto de cada real vendido sobra">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.porProduto.map((p) => (
                <tr key={p.nome}>
                  <td data-c="t" className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <Codigo codigo={p.codigo} />
                      <span>
                        <span className="font-medium">{p.nome.split(" · ")[0]}</span>
                        <span className="block text-xs text-stone-500">{p.nome.split(" · ")[1]}</span>
                      </span>
                    </span>
                  </td>
                  <td data-c="p" data-r="Vendido" className="tabular px-4 py-2.5 text-right">{quantidade(p.quantidade, p.unidade)}</td>
                  <td data-c="p" data-r="Custo unitário" className="tabular px-4 py-2.5 text-right text-stone-600">{p.custoUnit !== null ? reais(p.custoUnit) : "—"}</td>
                  <td data-c="p" data-r="Faturamento" className="tabular px-4 py-2.5 text-right">{reais(p.faturamento)}</td>
                  <td data-c="p" data-r="Custo" className="tabular px-4 py-2.5 text-right">{reais(p.custo)}</td>
                  <td data-c="v" className="tabular px-4 py-2.5 text-right font-semibold"><span className="block text-xs font-normal text-stone-500 lg:hidden">lucro</span>{reais(p.lucro)}</td>
                  <td data-c="p" data-r="Markup" className="tabular px-4 py-2.5 text-right text-stone-600">{p.markup !== null ? pct(p.markup) : "—"}</td>
                  <td data-c="p" data-r="Margem" className="px-4 py-2.5 max-lg:[&>span]:flex-1">
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
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-500">Nenhuma venda no período.</td>
                </tr>
              )}
            </tbody>
            {r.porProduto.length > 0 && (
              <tfoot className="border-t border-stone-200 font-semibold">
                <tr>
                  <td data-c="t" className="px-4 py-3">Total</td>
                  <td data-c="p" data-r="Caixas" className="tabular px-4 py-3 text-right">{cx(t.caixas)}</td>
                  <td data-c="x" />
                  <td data-c="p" data-r="Faturamento" className="tabular px-4 py-3 text-right">{reais(t.faturamento)}</td>
                  <td data-c="p" data-r="Custo" className="tabular px-4 py-3 text-right">{reais(t.custo)}</td>
                  <td data-c="v" className="tabular px-4 py-3 text-right">{reais(t.lucro)}</td>
                  <td data-c="x" className="tabular px-4 py-3 text-right text-xs">{t.markup !== null ? pct(t.markup) : ""}</td>
                  <td data-c="x" className="tabular px-4 py-3 text-xs">{t.margem !== null ? pct(t.margem) : ""}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Vendas por tipo de negócio</h2>
          <p className="mt-1 text-xs text-stone-500">Restaurantes, lancherias, padarias e confeitarias: quem fatura e quem dá lucro.</p>
          {r.porTipo.length ? (
            <GraficoVendas
              horizontal
              altura={Math.max(160, r.porTipo.length * 56)}
              dados={r.porTipo.map((g) => ({ rotulo: g.nome, faturamento: Math.round(g.faturamento), custo: Math.round(g.custo), lucro: Math.round(g.lucro), semCusto: Math.round(g.semCusto) }))}
            />
          ) : (
            <Vazio>Nenhuma venda no período.</Vazio>
          )}
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {r.porTipo.map((g) => (
              <li key={g.nome} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                <span className="font-medium">{g.nome}</span>
                <span className="tabular text-stone-600">
                  {num(g.pedidos)} pedidos · {cx(g.caixas)} · {t.faturamento ? pct(g.faturamento / t.faturamento) : "—"} do faturamento
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-6 [&>*]:min-w-0">
          {[
            { titulo: "Com NF × sem NF", sub: "Pela nota de cada pedido.", grupos: r.porNota },
            { titulo: "À vista × a prazo", sub: "Pela condição de pagamento do cliente.", grupos: r.porCondicao },
            { titulo: "Forma de pagamento", sub: "Dinheiro, Pix e outras, pelo cadastro do cliente.", grupos: r.porPagamento },
          ].map(({ titulo, sub, grupos }) => (
            <div key={titulo} className="cartao p-5">
              <h2 className="font-semibold text-marca-950">{titulo}</h2>
              <p className="mt-1 text-xs text-stone-500">{sub}</p>
              {grupos.length ? (
                <>
                  {/* Barra de participação no faturamento */}
                  <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                    {grupos.map((g, i) => (
                      <span key={g.nome} style={{ width: `${(g.faturamento / (t.faturamento || 1)) * 100}%`, background: i ? "#c9bfb3" : COR_LUCRO }} />
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-4">
                    {grupos.map((g, i) => (
                      <div key={g.nome}>
                        <dt className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                          <span className="size-2.5 rounded-sm" style={{ background: i ? "#c9bfb3" : COR_LUCRO }} aria-hidden />
                          {g.nome} · {t.faturamento ? pct(g.faturamento / t.faturamento) : "—"}
                        </dt>
                        <dd className="tabular text-xl font-bold">{reais(g.faturamento)}</dd>
                        <dd className="tabular text-xs text-stone-500">
                          lucro {reais(g.lucro)} · {num(g.pedidos)} pedidos
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-sm text-stone-500">Nenhuma venda no período.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 cartao overflow-x-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <h2 className="font-semibold text-marca-950">Logística<span className="max-lg:hidden">: km e combustível da Fiorino</span></h2>
          <Link href={`/painel/rotas?dia=${r.inicio}`} className="text-sm text-marca-700 hover:underline print:hidden">Abrir rotas →</Link>
        </div>
        <table className="lista-cel mt-3 w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Dia</th>
              <th className="px-4 py-2 text-right">Entregas</th>
              <th className="px-4 py-2 text-right">Caixas</th>
              <th className="px-4 py-2 text-right">Km</th>
              <th className="px-4 py-2 text-right">Litros</th>
              <th className="px-4 py-2 text-right">Combustível</th>
              <th className="px-4 py-2 text-right">Por caixa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {r.logistica.map((l) => (
              <tr key={l.dia}>
                <td data-c="t" className="px-4 py-2.5 first-letter:uppercase">{formatarDia(l.dia, { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                <td data-c="s" className="tabular px-4 py-2.5 text-right">{num(l.entregas)}<span className="lg:hidden"> entregas · {cx(l.caixas)} · {km(l.km)}</span></td>
                <td data-c="x" className="tabular px-4 py-2.5 text-right">{cx(l.caixas)}</td>
                <td data-c="x" className="tabular px-4 py-2.5 text-right">
                  {km(l.km)}
                  {!l.real && <span className="text-xs text-stone-400"> calc.</span>}
                </td>
                <td data-c="x" className="tabular px-4 py-2.5 text-right">{litros(l.litros)}</td>
                <td data-c="v" className="tabular px-4 py-2.5 text-right font-semibold">{reais(l.custo)}</td>
                <td data-c="x" className="tabular px-4 py-2.5 text-right">{l.caixas ? reais(l.custo / l.caixas) : "—"}</td>
              </tr>
            ))}
            {r.logistica.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-500">Nenhuma rota gerada no período. Em Rotas, gere a rota de cada dia de entrega.</td>
              </tr>
            )}
          </tbody>
          {r.logistica.length > 1 && (
            <tfoot className="border-t border-stone-200 font-semibold">
              <tr>
                <td data-c="t" className="px-4 py-2.5">Total</td>
                <td data-c="p" data-r="Entregas" className="tabular px-4 py-2.5 text-right">{num(r.logistica.reduce((s, l) => s + l.entregas, 0))}</td>
                <td data-c="p" data-r="Caixas" className="tabular px-4 py-2.5 text-right">{cx(r.logistica.reduce((s, l) => s + l.caixas, 0))}</td>
                <td data-c="p" data-r="Km" className="tabular px-4 py-2.5 text-right">{km(f.km)}</td>
                <td data-c="p" data-r="Litros" className="tabular px-4 py-2.5 text-right">{litros(f.litros)}</td>
                <td data-c="v" className="tabular px-4 py-2.5 text-right">{reais(f.combustivel)}</td>
                <td data-c="x" className="px-4 py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold text-marca-950 max-lg:hidden">Quem mais comprou</h2>
          <Recolhe rotulo="Quem mais comprou" className="max-lg:[&>button]:min-h-14 max-lg:[&>button]:px-5">
          <table className="lista-cel mt-3 w-full text-sm">
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
                  <td data-c="t" className="px-4 py-2.5 font-medium">
                    {c.nome}
                    <span className="block text-xs font-normal text-stone-500">{c.tipo} · {c.notaFiscal ? "com NF" : "sem NF"}</span>
                  </td>
                  <td data-c="x" className="tabular px-4 py-2.5 text-right">{num(c.pedidos)}</td>
                  <td data-c="p" data-r={`${num(c.pedidos)} pedidos`} className="tabular px-4 py-2.5 text-right">{cx(c.caixas)}</td>
                  <td data-c="v" className="tabular px-4 py-2.5 text-right">{reais(c.faturamento)}</td>
                  <td data-c="p" data-r="Lucro" className="tabular px-4 py-2.5 text-right font-semibold">{reais(c.lucro)}</td>
                  <td data-c="x" className="tabular px-4 py-2.5 text-right">{c.margem !== null ? pct(c.margem) : "—"}</td>
                </tr>
              ))}
              {r.porCliente.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhuma venda no período.</td>
                </tr>
              )}
            </tbody>
          </table>
          </Recolhe>
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Compras de ovos no período</h2>
          <p className="mt-1 text-xs text-stone-500">O que entrou no estoque, de todos os fornecedores. Base do custo médio.</p>
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

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold text-marca-950">Compras por fornecedor</h2>
          <p className="px-5 text-xs text-stone-500">Quanto saiu pra cada fornecedor e o custo médio da caixa de cada um.</p>
          <table className="lista-cel mt-3 w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Fornecedor</th>
                <th className="px-4 py-2 text-right">Compras</th>
                <th className="px-4 py-2 text-right">Caixas</th>
                <th className="px-4 py-2 text-right">Custo médio/cx</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="w-32 px-4 py-2">Participação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.fornecedores.map((fo) => (
                <tr key={fo.nome}>
                  <td data-c="t" className="px-4 py-2.5 font-medium">{fo.nome}</td>
                  <td data-c="x" className="tabular px-4 py-2.5 text-right">{num(fo.compras)}</td>
                  <td data-c="p" data-r={`${num(fo.compras)} compras`} className="tabular px-4 py-2.5 text-right">{cx(fo.caixas)}{fo.pacotes > 0 && <span className="block text-xs text-stone-500">{num(fo.pacotes)} pct</span>}</td>
                  <td data-c="p" data-r="Custo médio da caixa" className="tabular px-4 py-2.5 text-right">{fo.custoMedioCaixa !== null ? reais(fo.custoMedioCaixa) : "—"}</td>
                  <td data-c="v" className="tabular px-4 py-2.5 text-right font-semibold">{reais(fo.valor)}</td>
                  <td data-c="p" data-r="Participação" className="px-4 py-2.5 max-lg:[&>span]:flex-1">
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                        <span className="block h-full rounded-full bg-marca-600" style={{ width: `${fo.participacao * 100}%` }} />
                      </span>
                      <span className="tabular w-10 text-right text-xs font-semibold">{pct(fo.participacao)}</span>
                    </span>
                  </td>
                </tr>
              ))}
              {r.fornecedores.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhuma compra lançada no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="cartao p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-marca-950">Despesas da operação</h2>
            <Link href="/painel/despesas#lancar" className="toque text-sm text-marca-700 hover:underline print:hidden">Lançar →</Link>
          </div>
          <p className="mt-1 text-xs text-stone-500">Fora mercadoria e combustível (o combustível vem das Rotas).</p>
          <p className="tabular mt-4 text-3xl font-bold text-marca-950">{reais(r.despesas.total)}</p>
          <p className="text-xs text-stone-500">{r.anteriorRotulo}: {reais(r.despesas.anterior)}</p>
          {r.despesas.porCategoria.length ? (
            <ul className="mt-4 space-y-2 text-sm">
              {r.despesas.porCategoria.map((c) => (
                <li key={c.categoria} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate">{c.categoria}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(c.valor / (r.despesas.total || 1)) * 100}%`, background: COR_CUSTO }} />
                  </span>
                  <span className="tabular w-24 text-right font-medium">{reais(c.valor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-stone-500">Nenhuma despesa lançada no período.</p>
          )}
        </div>
      </section>
    </>
  );
}
