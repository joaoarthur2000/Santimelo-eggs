import type { Metadata } from "next";
import { Cabecalho } from "@/components/ui";
import { diaISO, formatarDataCurta, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { aplicarPrecosAgendados } from "@/lib/eggs";
import { custosMedios } from "@/lib/estoque";
import { nomeProduto, pct, reais } from "@/lib/formato";
import { cancelarAgendado } from "../actions";
import { FormAgendarPreco } from "../forms";
import { FormLiberarProduto } from "./liberar";

export const metadata: Metadata = { title: "Preços" };

export default async function PrecosOvos() {
  await aplicarPrecosAgendados();
  const [produtos, agendados, custo, esperando] = await Promise.all([
    db.produto.findMany({
      where: { ativo: true },
      include: { item: true, _count: { select: { precosCliente: true } }, precos: { orderBy: { em: "desc" }, take: 4 } },
      orderBy: [{ item: { ordem: "asc" } }, { preco: "desc" }],
    }),
    db.precoAgendado.findMany({ where: { aplicadoEm: null }, include: { produto: { include: { item: true } } }, orderBy: { aPartirDe: "asc" } }),
    custosMedios(new Date()),
    // produto de um tipo ativo que ainda não tem preço (ex: camarão recém-cadastrado)
    db.produto.findMany({ where: { ativo: false, preco: 0, item: { ativo: true } }, include: { item: true } }),
  ]);

  return (
    <>
      <Cabecalho titulo="Preços" subtitulo="Preço de venda já com a margem. Agende mudanças com antecedência: o cliente vê no app antes de valer." />
      {esperando.length > 0 && (
        <section className="mb-6 rounded-2xl border border-ouro bg-ouro/10 p-5">
          <h2 className="font-semibold text-terra">Esperando preço</h2>
          <p className="mb-4 text-sm text-noz">Produto cadastrado e fora do app até ganhar preço. Lance também a primeira compra no Estoque, pra ter custo e margem.</p>
          <div className="space-y-4">
            {esperando.map((p) => <FormLiberarProduto key={p.id} produtoId={p.id} nome={nomeProduto(p)} />)}
          </div>
        </section>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <section className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Venda</th>
                <th className="px-4 py-3 text-right">Custo médio</th>
                <th className="px-4 py-3 text-right">Margem</th>
                <th className="px-4 py-3">Histórico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {produtos.map((p) => {
                const c = custo.has(p.itemId) && p.fatorEstoque ? custo.get(p.itemId)! * p.fatorEstoque : null;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      {nomeProduto(p)}
                      {p._count.precosCliente > 0 && <span className="block text-xs text-stone-500">{p._count.precosCliente} clientes com preço combinado</span>}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{reais(p.preco)}</td>
                    <td className="tabular px-4 py-3 text-right">{c !== null ? reais(c) : "—"}</td>
                    <td className="tabular px-4 py-3 text-right">{c !== null && p.preco > 0 ? pct((p.preco - c) / p.preco) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{p.precos.map((h) => `${reais(h.preco)} (${formatarDataCurta(h.em)})`).join(" ← ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold text-marca-950">Agendar mudança de preço</h2>
            <FormAgendarPreco produtos={produtos.map((p) => ({ id: p.id, nome: nomeProduto(p), preco: p.preco }))} amanha={somarDias(diaISO(), 1)} />
          </section>
          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold text-marca-950">Agendados</h2>
            <ul className="divide-y divide-stone-100 text-sm">
              {agendados.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {nomeProduto(a.produto)}
                    <span className="block text-xs text-stone-500">
                      {reais(a.produto.preco)} → <b>{reais(a.preco)}</b> em {formatarDataCurta(new Date(`${a.aPartirDe}T12:00:00-03:00`))} · {a.autor}
                    </span>
                  </span>
                  <form action={cancelarAgendado.bind(null, a.id)}>
                    <button className="text-xs text-stone-400 hover:text-red-600">cancelar</button>
                  </form>
                </li>
              ))}
              {agendados.length === 0 && <li className="py-2 text-stone-500">Nenhuma mudança agendada.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
