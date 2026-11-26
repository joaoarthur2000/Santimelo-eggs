import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Cabecalho, Indicador, Vazio } from "@/components/ui";
import { CATEGORIAS_DESPESA } from "@/lib/constantes";
import { COR_CUSTO } from "@/lib/cores";
import { diaISO, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { pct, reais } from "@/lib/formato";
import { excluirDespesa } from "./actions";
import { FormDespesa } from "./form";

export const metadata = { title: "Despesas" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesMais = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function Despesas({ searchParams }: PageProps<"/painel/despesas">) {
  const { mes: mesParam } = await searchParams;
  const hoje = diaISO();
  const mes = typeof mesParam === "string" && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoje.slice(0, 7);
  const inicio = `${mes}-01`;
  const fim = somarDias(`${mesMais(mes, 1)}-01`, -1);
  const antes = mesMais(mes, -1);

  const [despesas, anteriores] = await Promise.all([
    db.despesa.findMany({ where: { dia: { gte: inicio, lte: fim } }, orderBy: [{ dia: "desc" }, { criadoEm: "desc" }] }),
    db.despesa.aggregate({ where: { dia: { gte: `${antes}-01`, lt: inicio } }, _sum: { valor: true } }),
  ]);
  const total = despesas.reduce((t, d) => t + d.valor, 0);
  const anterior = anteriores._sum.valor ?? 0;
  const porCategoria = CATEGORIAS_DESPESA.map((c) => ({ c, valor: despesas.filter((d) => d.categoria === c).reduce((t, d) => t + d.valor, 0) })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const [ano, m] = mes.split("-").map(Number);

  return (
    <>
      <Cabecalho titulo="Despesas" explica subtitulo="Gastos da operação fora a compra de mercadoria. O combustível entra sozinho pelas Rotas.">
        <div className="flex items-center justify-between gap-2 max-lg:w-full">
        <Link href={`/painel/despesas?mes=${antes}`} className="botao-secundario px-2" aria-label="Mês anterior"><ChevronLeft className="size-4" /></Link>
        <span className="min-w-36 text-center font-semibold text-marca-950"><span className="capitalize">{MESES[m - 1]}</span> de {ano}</span>
        <Link href={`/painel/despesas?mes=${mesMais(mes, 1)}`} className="botao-secundario px-2" aria-label="Próximo mês"><ChevronRight className="size-4" /></Link>
        </div>
      </Cabecalho>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Total do mês" valor={reais(total)} detalhe={`${despesas.length} lançamentos`} />
        <Indicador rotulo="Mês anterior" valor={reais(anterior)} detalhe={anterior ? `${total >= anterior ? "+" : "−"}${pct(Math.abs(total - anterior) / anterior)}` : "sem lançamentos"} />
        <Indicador rotulo="Maior categoria" valor={porCategoria[0]?.c ?? "—"} detalhe={porCategoria[0] ? reais(porCategoria[0].valor) : ""} />
        <Indicador rotulo="Média por dia" valor={reais(total / Number(fim.slice(8, 10)))} detalhe="no mês" />
      </section>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[2fr_1fr] lg:gap-6 [&>*]:min-w-0">
        <section className="cartao overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold text-marca-950">Lançamentos</h2>
          {despesas.length === 0 ? (
            <div className="p-5"><Vazio>Nenhuma despesa lançada neste mês.</Vazio></div>
          ) : (
            <table className="lista-cel mt-3 w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Despesa</th><th className="px-4 py-2">Categoria</th><th className="px-4 py-2 text-right">Valor</th><th className="px-2 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {despesas.map((d) => (
                  <tr key={d.id}>
                    <td data-c="s" className="tabular order-2 whitespace-nowrap px-4 py-2.5 text-stone-600">{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</td>
                    <td data-c="t" className="px-4 py-2.5">
                      <span className="font-medium">{d.descricao}</span>
                      <span className="block text-xs font-normal text-stone-500">{[d.formaPagamento, d.autor].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td data-c="x" className="px-4 py-2.5 text-stone-600">{d.categoria}</td>
                    <td data-c="v" className="tabular px-4 py-2.5 text-right font-semibold">{reais(d.valor)}</td>
                    <td data-c="l" className="px-2 py-2.5 text-right">
                      <form action={excluirDespesa.bind(null, d.id)}>
                        <button className="toque rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Apagar ${d.descricao}`}><Trash2 className="size-4" /></button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="space-y-4 max-lg:contents lg:space-y-6">
          <section id="lancar" className="cartao scroll-mt-24 p-5 max-lg:order-first">
            <h2 className="mb-3 font-semibold text-marca-950">Lançar despesa</h2>
            <FormDespesa hoje={hoje} />
          </section>
          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Por categoria</h2>
            {porCategoria.length ? (
              <ul className="mt-3 space-y-2.5 text-sm">
                {porCategoria.map(({ c, valor }) => (
                  <li key={c}>
                    <span className="flex justify-between gap-2"><span>{c}</span><span className="tabular font-medium">{reais(valor)}</span></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${(valor / total) * 100}%`, background: COR_CUSTO }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-stone-500">Aparece aqui quando houver lançamentos.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
