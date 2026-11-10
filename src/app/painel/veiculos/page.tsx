import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Fuel, Trash2, TriangleAlert, Wrench, CalendarRange } from "lucide-react";
import { Cabecalho, Vazio } from "@/components/ui";
import { PERIODOS, TIPOS_GASTO_VEICULO, type Periodo, type TipoGastoVeiculo } from "@/lib/constantes";
import { COR_CUSTO } from "@/lib/cores";
import { diaISO, diaValido } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, pct, reais } from "@/lib/formato";
import { intervalo } from "@/lib/relatorio";
import { custoVeiculo } from "@/lib/veiculo";
import { excluirGasto } from "./actions";
import { FormGasto, FormVeiculo } from "./forms";

export const metadata: Metadata = { title: "Veículos" };

const km = (v: number) => `${num(Math.round(v * 10) / 10)} km`;
const curto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export default async function Veiculos({ searchParams }: PageProps<"/painel/veiculos">) {
  const params = await searchParams;
  const periodo: Periodo = typeof params.periodo === "string" && params.periodo in PERIODOS ? (params.periodo as Periodo) : "semana";
  const dia = diaValido(params.dia);
  const faixa = intervalo(periodo, dia);
  const hoje = diaISO();
  const [c, veiculo] = await Promise.all([custoVeiculo(faixa.inicio, faixa.fim), db.veiculo.findFirst({ where: { ativo: true }, orderBy: { criadoEm: "asc" } })]);
  const link = (p: Periodo, d: string) => `/painel/veiculos?periodo=${p}&dia=${d}`;

  if (!veiculo) return <><Cabecalho titulo="Veículos" /><Vazio>Nenhum veículo cadastrado.</Vazio></>;

  const composicao = [
    { rotulo: "Combustível", valor: c.combustivel, cor: COR_CUSTO, icone: Fuel, sub: `${km(c.km)} · ${num(Math.round(c.litros * 10) / 10)} L` },
    { rotulo: "Manutenção e pneus", valor: c.manutencao, cor: "#673C33", icone: Wrench, sub: `${reais(veiculo.manutencaoPorKm + veiculo.pneusPorKm)} por km` },
    { rotulo: "Fixos (IPVA, seguro…)", valor: c.fixos, cor: "#FFBD52", icone: CalendarRange, sub: `${reais(c.fixoDiario)} por dia · ${num(c.diasCorridos)} ${c.diasCorridos === 1 ? "dia" : "dias"}` },
  ];
  // Projeção: mês com 2 entregas por semana (≈ 8,7 dias de entrega), km médio dos dias com rota
  const diasComRota = c.porDia.filter((d) => d.temRota);
  const kmMedioDia = diasComRota.length ? diasComRota.reduce((t, d) => t + d.km, 0) / diasComRota.length : null;
  const projecaoMes = kmMedioDia !== null && c.kmParametro !== null ? c.fixoMensal + kmMedioDia * 8.7 * c.kmParametro : null;

  return (
    <>
      <Cabecalho titulo="Veículos" subtitulo={`Quanto custa entregar: ${PERIODOS[periodo].toLowerCase()} · ${faixa.titulo}`}>
        <nav className="flex rounded-lg bg-white p-1 ring-1 ring-stone-200" aria-label="Período">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <Link key={p} href={link(p, dia)} aria-current={p === periodo ? "page" : undefined} className={`rounded-md px-4 py-1.5 text-sm font-medium ${p === periodo ? "bg-marca-800 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </nav>
        <Link href={link(periodo, faixa.anterior)} className="botao-secundario px-2" aria-label="Período anterior"><ChevronLeft className="size-4" /></Link>
        <Link href={link(periodo, faixa.proximo)} className="botao-secundario px-2" aria-label="Próximo período"><ChevronRight className="size-4" /></Link>
        {dia !== hoje && <Link href={link(periodo, hoje)} className="botao-secundario">Hoje</Link>}
      </Cabecalho>

      {/* Veículo + custo do período */}
      <section className="mb-6 grid gap-4 overflow-hidden rounded-3xl bg-terra p-6 text-concha sm:p-8 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-ouro">{veiculo.apelido}</p>
          <h2 className="mt-1 font-eggs text-2xl font-extrabold">{veiculo.modelo}</h2>
          <p className="text-sm text-concha/70">{veiculo.ano} · {veiculo.combustivel} · {num(veiculo.consumoKmL)} km/l · {reais(veiculo.precoLitro)}/L{veiculo.kmAtual ? ` · ${num(veiculo.kmAtual)} km rodados` : ""}</p>
          {/* placa padrão Mercosul */}
          <div className="mt-5 inline-block overflow-hidden rounded-md border-2 border-stone-800 bg-white text-stone-900 shadow-lg">
            <p className="bg-[#1d4fa0] px-3 py-0.5 text-center text-[9px] font-bold tracking-[.3em] text-white">BRASIL</p>
            <p className="px-4 py-1 font-mono text-3xl font-bold tracking-[.12em]">{veiculo.placa.slice(0, 3)}{veiculo.placa.slice(3)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Custo no período", reais(c.total), `${num(c.entregas)} entregas · ${km(c.km)}`],
            ["Por entrega", c.custoPorEntrega !== null ? reais(c.custoPorEntrega) : "—", "cada cliente atendido"],
            ["Por caixa", c.custoPorCaixa !== null ? reais(c.custoPorCaixa) : "—", `${num(Math.round(c.caixas * 10) / 10)} cx entregues`],
            ["Por km", c.custoPorKm !== null ? reais(c.custoPorKm) : c.kmParametro !== null ? reais(c.kmParametro) : "—", c.custoPorKm !== null ? "tudo incluído" : "combustível + desgaste"],
            ["Fixo por mês", reais(c.fixoMensal), "IPVA, seguro, licenciamento"],
            ["Projeção do mês", projecaoMes !== null ? reais(projecaoMes) : "—", projecaoMes !== null ? `2 entregas/semana · ${km(kmMedioDia!)} por dia` : "aparece com a 1ª rota"],
          ].map(([r, v, s]) => (
            <div key={r} className="rounded-2xl bg-concha/10 p-4">
              <p className="text-[11px] uppercase tracking-wide text-concha/60">{r}</p>
              <p className="tabular mt-1 font-eggs text-xl font-extrabold">{v}</p>
              <p className="text-xs text-concha/60">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {c.diasSemRota > 0 && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-ouro/15 px-4 py-3 text-sm text-noz">
          <TriangleAlert className="size-4 shrink-0" /> {c.diasSemRota} dia(s) com entrega sem rota gerada: o km desses dias ficou zerado. Gere a rota em <Link href="/painel/rotas" className="font-semibold underline">Rotas</Link> ou anote o hodômetro.
        </p>
      )}

      {/* Composição */}
      <section className="cartao mb-6 p-5">
        <h2 className="font-semibold text-terra">De onde vem o custo</h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-stone-100" aria-hidden>
          {composicao.map((x) => <span key={x.rotulo} style={{ width: `${c.total ? (x.valor / c.total) * 100 : 0}%`, background: x.cor }} />)}
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {composicao.map((x) => (
            <div key={x.rotulo} className="flex gap-3">
              <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: x.cor }} aria-hidden />
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-stone-600"><x.icone className="size-4" /> {x.rotulo}</dt>
                <dd className="tabular text-xl font-bold text-terra">{reais(x.valor)} <span className="text-xs font-normal text-stone-500">{c.total ? pct(x.valor / c.total) : ""}</span></dd>
                <dd className="text-xs text-stone-500">{x.sub}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="space-y-6 [&>*]:min-w-0">
          {/* Por cliente */}
          <section className="cartao overflow-x-auto">
            <h2 className="px-5 pt-5 font-semibold text-terra">Custo de entrega por cliente</h2>
            <p className="px-5 text-xs text-stone-500">O custo de cada dia de entrega é dividido entre os clientes atendidos naquele dia.</p>
            <table className="mt-3 w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Entregas</th><th className="px-4 py-2 text-right">Custo</th><th className="px-4 py-2 text-right">Por caixa</th><th className="px-4 py-2 text-right" title="Custo da entrega ÷ venda pra esse cliente">Peso na venda</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {c.porCliente.map((x) => (
                  <tr key={x.clienteId}>
                    <td className="px-4 py-2.5"><Link href={`/painel/clientes/${x.clienteId}`} className="font-medium hover:underline">{x.nome}</Link><span className="block text-xs text-stone-500">{x.tipo}</span></td>
                    <td className="tabular px-4 py-2.5 text-right">{num(x.entregas)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-semibold">{reais(x.custo)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{x.porCaixa !== null ? reais(x.porCaixa) : "—"}</td>
                    <td className={`tabular px-4 py-2.5 text-right ${x.pesoNaVenda !== null && x.pesoNaVenda > 0.1 ? "font-semibold text-pimenta" : ""}`}>{x.pesoNaVenda !== null ? pct(x.pesoNaVenda) : "—"}</td>
                  </tr>
                ))}
                {c.porCliente.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Nenhuma entrega no período.</td></tr>}
              </tbody>
            </table>
          </section>

          {/* Por dia */}
          <section className="cartao overflow-x-auto">
            <h2 className="px-5 pt-5 font-semibold text-terra">Dias de entrega</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2">Dia</th><th className="px-4 py-2 text-right">Entregas</th><th className="px-4 py-2 text-right">Km</th><th className="px-4 py-2 text-right">Combustível</th><th className="px-4 py-2 text-right">Manutenção</th><th className="px-4 py-2 text-right">Fixos</th><th className="px-4 py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {c.porDia.map((d) => (
                  <tr key={d.dia}>
                    <td className="px-4 py-2.5">{curto(d.dia)}{!d.temRota && d.paradas > 0 && <span className="ml-2 text-xs text-pimenta">sem rota</span>}{d.kmReal && <span className="ml-2 text-xs text-stone-500">km real</span>}</td>
                    <td className="tabular px-4 py-2.5 text-right">{num(d.paradas)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{km(d.km)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{reais(d.combustivel)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{reais(d.manutencao)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{reais(d.fixos)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-semibold">{reais(d.total)}</td>
                  </tr>
                ))}
                {c.porDia.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Nenhuma entrega nem rota no período. O fixo do período ({reais(c.fixos)}) entra no fechamento mesmo assim.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="cartao p-5">
            <h2 className="mb-1 font-semibold text-terra">Dados e custos da {veiculo.apelido}</h2>
            <p className="mb-4 text-xs text-stone-500">Valores iniciais são estimativa: troque pelos do boleto do IPVA, da apólice do seguro e da oficina.</p>
            <FormVeiculo v={veiculo} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="mb-1 font-semibold text-terra">Lançar gasto</h2>
            <p className="mb-3 text-xs text-stone-500">O que saiu do caixa com o carro. Abastecimento com litros atualiza o preço do litro das Rotas.</p>
            <FormGasto veiculoId={veiculo.id} hoje={hoje} />
          </section>
          <section className="cartao p-5">
            <h2 className="font-semibold text-terra">Gastos lançados no período</h2>
            <p className="tabular mt-2 font-eggs text-2xl font-extrabold text-terra">{reais(c.gastos.total)}</p>
            <p className="text-xs text-stone-500">Calculado pela operação: {reais(c.total)}. Os dois tendem a se encontrar ao longo dos meses.</p>
            {c.gastos.porTipo.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {c.gastos.porTipo.map((g) => <li key={g.tipo} className="flex justify-between"><span className="text-stone-600">{TIPOS_GASTO_VEICULO[g.tipo as TipoGastoVeiculo] ?? g.tipo}</span><span className="tabular font-medium">{reais(g.valor)}</span></li>)}
              </ul>
            )}
            <ul className="mt-4 divide-y divide-stone-100 text-sm">
              {c.gastos.lista.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{TIPOS_GASTO_VEICULO[g.tipo as TipoGastoVeiculo] ?? g.tipo}</span> <span className="tabular">{reais(g.valor)}</span>
                    <span className="block text-xs text-stone-500">{curto(g.dia)}{g.litros ? ` · ${num(g.litros)} L (${reais(g.valor / g.litros)}/L)` : ""}{g.km ? ` · ${num(g.km)} km` : ""}{g.descricao ? ` · ${g.descricao}` : ""}</span>
                  </span>
                  <form action={excluirGasto.bind(null, g.id)}><button className="rounded p-1 text-stone-400 hover:text-red-600" aria-label="Apagar gasto"><Trash2 className="size-4" /></button></form>
                </li>
              ))}
              {c.gastos.lista.length === 0 && <li className="py-3 text-stone-500">Nenhum gasto lançado no período.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
