import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Codigo, Indicador } from "@/components/ui";
import { TIPOS_MOVIMENTO, ORIGENS_COMPRA, type TipoMovimento } from "@/lib/constantes";
import { diaISO, formatarDataCurta, formatarHora, inicioDoDia, somarDias, fimDoDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { custosMedios, saldos } from "@/lib/estoque";
import { num, reais } from "@/lib/formato";
import { excluirMovimento } from "./actions";
import { FormMovimento } from "./forms";

export const metadata: Metadata = { title: "Estoque" };

const qtd = (v: number, unidade: string) => `${num(Math.round(v * 100) / 100)} ${unidade === "caixa" ? "cx" : unidade}`;

export default async function Estoque({ searchParams }: PageProps<"/painel/estoque">) {
  const { item: itemFiltro, q } = await searchParams;
  const hoje = diaISO();
  const agora = fimDoDia(hoje);
  const inicio7 = inicioDoDia(somarDias(hoje, -6));

  const [itens, saldo, custo, mov7, extrato] = await Promise.all([
    db.item.findMany({ orderBy: { ordem: "asc" } }),
    saldos(agora),
    custosMedios(agora),
    db.movimentoEstoque.groupBy({ by: ["itemId"], where: { data: { gte: inicio7, lt: agora }, quantidade: { lt: 0 } }, _sum: { quantidade: true } }),
    db.movimentoEstoque.findMany({
      where: typeof itemFiltro === "string" ? { itemId: itemFiltro } : {},
      include: { item: true },
      orderBy: { data: "desc" },
      take: 60,
    }),
  ]);
  const saida7 = new Map(mov7.map((m) => [m.itemId, -(m._sum.quantidade ?? 0)]));

  const termo = typeof q === "string" ? q.trim().toLowerCase() : "";
  const linhas = itens
    .filter((i) => saldo.has(i.id) || saida7.has(i.id))
    .filter((i) => !termo || i.nome.toLowerCase().includes(termo) || i.codigo === termo)
    .map((i) => {
      const s = saldo.get(i.id) ?? 0;
      const media = (saida7.get(i.id) ?? 0) / 7;
      return { item: i, saldo: s, custo: custo.get(i.id) ?? null, valor: s > 0 && custo.has(i.id) ? s * custo.get(i.id)! : 0, cobertura: media > 0 ? s / media : null };
    });

  const valorTotal = linhas.reduce((t, l) => t + l.valor, 0);
  const negativos = linhas.filter((l) => l.saldo < -0.001).length;
  const semCusto = linhas.filter((l) => l.custo === null && l.saldo > 0).length;
  const filtroItem = typeof itemFiltro === "string" ? itens.find((i) => i.id === itemFiltro) : undefined;

  return (
    <>
      <Cabecalho titulo="Estoque" subtitulo="Tudo que entra e sai, em caixas de 360 ovos. A venda baixa quando o pedido sai pra entrega." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Valor em estoque" valor={reais(valorTotal)} detalhe="saldo × custo médio de compra" />
        <Indicador rotulo="Caixas em estoque" valor={qtd(linhas.reduce((t, l) => t + Math.max(0, l.saldo), 0), "caixa")} />
        <Indicador rotulo="Saldo negativo" valor={num(negativos)} detalhe="saiu mais do que entrou: falta lançar compra ou contar" />
        <Indicador rotulo="Sem custo" valor={num(semCusto)} detalhe="tipos de ovo com saldo e nenhuma compra com custo" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px] [&>*]:min-w-0">
        <section className="cartao overflow-x-auto">
          <form className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-4">
            <input name="q" defaultValue={termo} placeholder="Buscar tipo de ovo ou código" className="campo w-56" />
            <button className="botao-secundario">Filtrar</button>
          </form>
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Tipo de ovo</th>
                <th className="px-4 py-2 text-right">Saldo</th>
                <th className="px-4 py-2 text-right">Custo médio</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-right">Saída/dia (7 d)</th>
                <th className="px-4 py-2 text-right">Dura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {linhas.map((l) => (
                <tr key={l.item.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <Link href={`/painel/estoque?item=${l.item.id}`} className="flex items-center gap-2 hover:underline">
                      <Codigo codigo={l.item.codigo} /> {l.item.nome}
                    </Link>
                  </td>
                  <td className={`tabular px-4 py-2 text-right font-semibold ${l.saldo < -0.001 ? "text-red-700" : ""}`}>{qtd(l.saldo, l.item.unidadeEstoque)}</td>
                  <td className="tabular px-4 py-2 text-right">{l.custo !== null ? reais(l.custo) : "—"}</td>
                  <td className="tabular px-4 py-2 text-right">{l.valor ? reais(l.valor) : "—"}</td>
                  <td className="tabular px-4 py-2 text-right text-stone-600">{saida7.has(l.item.id) ? qtd(saida7.get(l.item.id)! / 7, l.item.unidadeEstoque) : "—"}</td>
                  <td className="tabular px-4 py-2 text-right text-stone-600">{l.cobertura !== null ? (l.cobertura <= 0 ? "acabou" : `${num(l.cobertura)} dias`) : "—"}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhum movimento ainda. Registre a primeira compra ao lado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold text-marca-950">Registrar</h2>
            <FormMovimento
              itemInicial={filtroItem?.id}
              itens={itens.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidade: i.unidadeEstoque, categoria: "Ovos" }))}
            />
          </section>

          <section className="cartao p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-marca-950">Extrato{filtroItem ? `: ${filtroItem.nome}` : ""}</h2>
              {filtroItem && <Link href="/painel/estoque" className="text-sm text-marca-700 hover:underline">ver todos</Link>}
            </div>
            <ul className="max-h-[70vh] divide-y divide-stone-100 overflow-y-auto text-sm">
              {extrato.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{TIPOS_MOVIMENTO[m.tipo as TipoMovimento] ?? m.tipo}</span>
                    <span className="text-stone-500"> · {m.item.codigo} {m.item.nome}</span>
                    <span className="block text-xs text-stone-500">
                      {formatarDataCurta(m.data)} {formatarHora(m.data)} · {m.autor}
                      {m.origem && ` · ${ORIGENS_COMPRA[m.origem as keyof typeof ORIGENS_COMPRA] ?? m.origem}`}
                      {m.fornecedor && ` (${m.fornecedor})`}
                      {m.custoUnit !== null && ` · ${reais(m.custoUnit)}/cx`}
                      {m.observacao && ` · ${m.observacao}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={`tabular font-semibold ${m.quantidade < 0 ? "text-stone-700" : "text-marca-700"}`}>
                      {m.quantidade > 0 ? "+" : "−"}
                      {qtd(Math.abs(m.quantidade), m.item.unidadeEstoque)}
                    </span>
                    {["COMPRA", "PERDA", "AJUSTE"].includes(m.tipo) && (
                      <form action={excluirMovimento.bind(null, m.id)}>
                        <button className="rounded px-1.5 text-xs text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir lançamento">×</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
              {extrato.length === 0 && <li className="py-6 text-center text-stone-500">Nada lançado ainda.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
