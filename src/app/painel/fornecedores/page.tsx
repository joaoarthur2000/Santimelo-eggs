import Link from "next/link";
import { Cabecalho, Vazio } from "@/components/ui";
import { ehOvo } from "@/lib/constantes";
import { diaISO, formatarDataCurta, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, pct, reais } from "@/lib/formato";
import { alternarFornecedor } from "./actions";
import { FormFornecedor } from "./form";

export const metadata = { title: "Fornecedores" };

export default async function Fornecedores() {
  const hoje = diaISO();
  const inicio30 = inicioDoDia(somarDias(hoje, -29));
  const fornecedores = await db.fornecedor.findMany({
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }],
    include: { compras: { include: { item: true }, orderBy: { data: "desc" } } },
  });

  const linhas = fornecedores.map((f) => {
    const doMes = f.compras.filter((c) => c.data >= inicio30);
    const ovos30 = doMes.filter((c) => ehOvo(c.item.unidadeEstoque));
    const caixas30 = ovos30.reduce((t, c) => t + c.quantidade, 0);
    const valor30 = doMes.reduce((t, c) => t + c.quantidade * (c.custoUnit ?? 0), 0);
    const ultima = f.compras[0];
    return {
      f,
      valor30,
      caixas30,
      custoMedio: caixas30 > 0 ? ovos30.reduce((t, c) => t + c.quantidade * (c.custoUnit ?? 0), 0) / caixas30 : null,
      ultima,
      total: f.compras.reduce((t, c) => t + c.quantidade * (c.custoUnit ?? 0), 0),
    };
  });
  const total30 = linhas.reduce((t, l) => t + l.valor30, 0);
  // Mais barato nos últimos 30 dias (custo médio da caixa de ovo)
  const comCusto = linhas.filter((l) => l.custoMedio !== null);
  const maisBarato = comCusto.length > 1 ? comCusto.reduce((a, b) => (a.custoMedio! <= b.custoMedio! ? a : b)) : null;

  return (
    <>
      <Cabecalho titulo="Fornecedores" subtitulo="De quem a Santimelo compra, quanto e a que preço. Toda compra lançada no Estoque entra aqui." />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <section className="grid content-start gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {linhas.length === 0 && <Vazio>Nenhum fornecedor cadastrado.</Vazio>}
          {linhas.map(({ f, valor30, caixas30, custoMedio, ultima, total }) => (
            <article key={f.id} className={`cartao relative overflow-hidden p-5 ${f.ativo ? "" : "opacity-60"}`}>
              <span className="absolute inset-x-0 top-0 h-1 bg-gema-400" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-eggs text-xl font-extrabold text-marca-950">{f.nome}</h2>
                  <p className="text-xs text-stone-500">{[f.produtos, f.contato].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
                </div>
                {maisBarato?.f.id === f.id && <span className="etiqueta shrink-0 bg-green-100 text-green-800">Melhor custo</span>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-stone-500">Últimos 30 dias</dt>
                  <dd className="tabular text-lg font-bold">{reais(valor30)}</dd>
                  <dd className="tabular text-xs text-stone-500">{num(caixas30)} cx · {total30 ? pct(valor30 / total30) : "—"} das compras</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Custo médio da caixa</dt>
                  <dd className="tabular text-lg font-bold">{custoMedio !== null ? reais(custoMedio) : "—"}</dd>
                  <dd className="text-xs text-stone-500">{ultima ? `última compra ${formatarDataCurta(ultima.data)}` : "nenhuma compra ainda"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
                <span>Total comprado: <span className="tabular font-semibold text-marca-950">{reais(total)}</span></span>
                <form action={alternarFornecedor.bind(null, f.id)}>
                  <button className="text-marca-700 hover:underline">{f.ativo ? "Desativar" : "Reativar"}</button>
                </form>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold text-marca-950">Novo fornecedor</h2>
            <FormFornecedor />
          </section>
          <section className="cartao p-5 text-sm text-stone-600">
            <h2 className="font-semibold text-marca-950">Como lançar uma compra</h2>
            <p className="mt-2">Em <Link href="/painel/estoque" className="text-marca-700 hover:underline">Estoque</Link>, aba Compra: escolha o produto, a quantidade, o custo e o fornecedor. O custo médio de cada produto e os relatórios se atualizam sozinhos.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
