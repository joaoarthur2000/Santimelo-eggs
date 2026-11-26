import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { Recolhe } from "@/components/recolhe";
import { Cabecalho, Vazio } from "@/components/ui";
import { ehOvo, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaISO, formatarDataCurta, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { STATUS_QUE_BAIXA } from "@/lib/estoque";
import { num, pct, quantidade, reais } from "@/lib/formato";
import { excluirMovimento } from "../estoque/actions";
import { alternarFornecedor, excluirPagamento } from "./actions";
import { FormCompra, FormPagamento } from "./compra";
import { FormFornecedor } from "./form";

export const metadata = { title: "Fornecedores" };

const dataDoDia = (dia: string) => formatarDataCurta(new Date(inicioDoDia(dia).getTime() + 12 * 3600 * 1000));

export default async function Fornecedores() {
  const hoje = diaISO();
  const inicio30 = inicioDoDia(somarDias(hoje, -29));
  const [fornecedores, itensOvo, vendidos, semFornecedor] = await Promise.all([
    db.fornecedor.findMany({
      orderBy: [{ ativo: "desc" }, { ordem: "asc" }],
      include: {
        compras: { include: { item: true }, orderBy: { data: "desc" } }, // todo o extrato dele: compras (+) e vendas (−)
        pagamentos: { orderBy: [{ dia: "desc" }, { criadoEm: "desc" }] },
      },
    }),
    db.item.findMany({ where: { ativo: true, unidadeEstoque: "caixa" }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    // rastreio: cada item vendido com o fornecedor de onde saiu
    db.pedidoItem.findMany({
      where: { fornecedorId: { not: null }, pedido: { status: { not: "CANCELADO" } } },
      include: { pedido: { include: { cliente: true } }, produto: { include: { item: true } }, fornecedor: true },
      orderBy: { pedido: { dataEntrega: "desc" } },
    }),
    db.pedidoItem.count({ where: { fornecedorId: null, produto: { fatorEstoque: { not: null } }, pedido: { status: { in: STATUS_QUE_BAIXA } } } }),
  ]);

  const compras = fornecedores
    .flatMap((f) => f.compras.filter((c) => c.tipo === "COMPRA"))
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const marcas = [...new Set(compras.map((c) => c.marca).filter((m): m is string => !!m))].sort();

  const linhas = fornecedores.map((f) => {
    const deCompra = f.compras.filter((c) => c.tipo === "COMPRA");
    const caixasCompradas = deCompra.filter((c) => ehOvo(c.item.unidadeEstoque)).reduce((t, c) => t + c.quantidade, 0);
    const valorComprado = deCompra.reduce((t, c) => t + c.quantidade * (c.custoUnit ?? 0), 0);
    // em estoque = tudo que entrou dele menos o que saiu (vendas com ele de fornecedor)
    const emEstoque = f.compras.filter((c) => ehOvo(c.item.unidadeEstoque)).reduce((t, c) => t + c.quantidade, 0);
    // custo médio da caixa por tipo de ovo, pra calcular o lucro do que foi vendido
    const custo = new Map<string, number>();
    for (const itemId of new Set(deCompra.map((c) => c.itemId))) {
      const doItem = deCompra.filter((c) => c.itemId === itemId && c.custoUnit !== null);
      const q = doItem.reduce((t, c) => t + c.quantidade, 0);
      if (q > 0) custo.set(itemId, doItem.reduce((t, c) => t + c.quantidade * c.custoUnit!, 0) / q);
    }
    const saiu = vendidos.filter((v) => v.fornecedorId === f.id && STATUS_QUE_BAIXA.includes(v.pedido.status));
    const caixasVendidas = saiu.reduce((t, v) => t + v.quantidade * (v.produto.fatorEstoque ?? 0), 0);
    const valorVendido = saiu.reduce((t, v) => t + v.subtotal, 0);
    const custoVendido = saiu.reduce((t, v) => t + v.quantidade * (v.produto.fatorEstoque ?? 0) * (custo.get(v.produto.itemId) ?? 0), 0);
    const semCusto = saiu.some((v) => v.produto.fatorEstoque && !custo.has(v.produto.itemId));
    const pago = f.pagamentos.reduce((t, p) => t + p.valor, 0);
    const doMes = deCompra.filter((c) => c.data >= inicio30 && ehOvo(c.item.unidadeEstoque));
    const caixas30 = doMes.reduce((t, c) => t + c.quantidade, 0);
    return {
      f,
      caixasCompradas,
      valorComprado,
      emEstoque,
      caixasVendidas,
      valorVendido,
      lucro: valorVendido - custoVendido,
      semCusto,
      pago,
      aPagar: valorComprado - pago,
      custoMedio30: caixas30 > 0 ? doMes.reduce((t, c) => t + c.quantidade * (c.custoUnit ?? 0), 0) / caixas30 : null,
    };
  });
  // Mais barato nos últimos 30 dias (custo médio da caixa de ovo)
  const comCusto = linhas.filter((l) => l.custoMedio30 !== null);
  const maisBarato = comCusto.length > 1 ? comCusto.reduce((a, b) => (a.custoMedio30! <= b.custoMedio30! ? a : b)) : null;
  const totalAPagar = linhas.reduce((t, l) => t + Math.max(0, l.aPagar), 0);

  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        explica
        subtitulo={`Quanto entrou de cada um, quanto saiu pra quais clientes e quanto falta pagar.${totalAPagar > 0 ? ` A pagar no total: ${reais(totalAPagar)}.` : ""}`}
      />

      {totalAPagar > 0 && <p className="-mt-3 mb-4 text-base text-stone-600 lg:hidden">A pagar no total: <b className="tabular text-red-700">{reais(totalAPagar)}</b></p>}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-6 [&>*]:min-w-0">
        <section className="grid content-start gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {linhas.length === 0 && <Vazio>Nenhum fornecedor cadastrado.</Vazio>}
          {linhas.map((l) => (
            <article key={l.f.id} className={`cartao relative overflow-hidden p-5 max-lg:pb-2 ${l.f.ativo ? "" : "opacity-60"}`}>
              <span className="absolute inset-x-0 top-0 h-1 bg-gema-400 max-lg:hidden" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-eggs text-xl font-extrabold text-marca-950">{l.f.nome}</h2>
                  <p className="text-xs text-stone-500">{[l.f.produtos, l.f.contato].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
                </div>
                {maisBarato?.f.id === l.f.id && <span className="etiqueta shrink-0 bg-green-100 text-green-800">Melhor custo</span>}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-stone-50 p-3">
                  <dt className="text-xs text-stone-500">Em estoque</dt>
                  <dd className={`tabular text-lg leading-tight font-extrabold tracking-tight ${l.emEstoque < 0 ? "text-red-700" : "text-marca-950"}`}>{num(l.emEstoque)} cx</dd>
                </div>
                <div className={`min-w-0 rounded-xl p-3 ${l.aPagar > 0.005 ? "bg-red-50" : "bg-green-50"}`}>
                  <dt className="text-xs text-stone-500">A pagar</dt>
                  <dd className={`tabular text-lg leading-tight font-extrabold tracking-tight whitespace-nowrap ${l.aPagar > 0.005 ? "text-red-700" : "text-green-800"}`}>{l.aPagar > 0.005 ? reais(l.aPagar) : "Em dia"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Comprado</dt>
                  <dd className="tabular font-bold">{reais(l.valorComprado)}</dd>
                  <dd className="tabular text-xs text-stone-500">{num(l.caixasCompradas)} cx · pago {reais(l.pago)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Vendido</dt>
                  <dd className="tabular font-bold">{reais(l.valorVendido)}</dd>
                  <dd className="tabular text-xs text-stone-500">{num(l.caixasVendidas)} cx entregues</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Lucro no que vendeu</dt>
                  <dd className={`tabular font-bold ${l.lucro < 0 ? "text-red-700" : "text-green-800"}`}>{reais(l.lucro)}</dd>
                  <dd className="tabular text-xs text-stone-500">{l.valorVendido > 0 ? `margem ${pct(l.lucro / l.valorVendido)}` : "—"}{l.semCusto ? " · falta custo" : ""}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Custo médio da caixa (30 dias)</dt>
                  <dd className="tabular font-bold">{l.custoMedio30 !== null ? reais(l.custoMedio30) : "—"}</dd>
                </div>
              </dl>

              <Recolhe rotulo="Pagamento" className="mt-4 border-t border-stone-100 pt-3 max-lg:pt-0">
                <FormPagamento fornecedorId={l.f.id} hoje={hoje} />
                {l.f.pagamentos.length > 0 && (
                  <details className="mt-2 text-xs text-stone-600">
                    <summary className="cursor-pointer text-marca-700 max-lg:py-3 max-lg:text-sm">
                      Pagamentos ({l.f.pagamentos.length}) · último {dataDoDia(l.f.pagamentos[0].dia)}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {l.f.pagamentos.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span>
                            {dataDoDia(p.dia)} · <span className="tabular font-semibold">{reais(p.valor)}</span>
                            {p.forma && <span className="etiqueta ml-1.5 bg-stone-100 px-1.5 text-[11px] text-stone-600">{p.forma}</span>}
                            {p.observacao ? ` · ${p.observacao}` : ""}
                          </span>
                          <form action={excluirPagamento.bind(null, p.id)}>
                            <button className="toque text-stone-500 hover:text-red-600">Excluir</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Recolhe>
              <div className="mt-3 flex justify-end text-xs max-lg:hidden">
                <form action={alternarFornecedor.bind(null, l.f.id)}>
                  <button className="text-marca-700 hover:underline">{l.f.ativo ? "Desativar" : "Reativar"}</button>
                </form>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4 max-lg:order-first lg:space-y-6">
          <section className="cartao border-2 border-gema-400/60 p-5 max-lg:px-5 max-lg:py-2">
            <Recolhe id="lancar" rotulo="Lançar compra" icone={<PackagePlus className="size-5 text-noz" aria-hidden />}>
            <h2 className="mb-3 font-eggs text-lg font-extrabold text-marca-950 max-lg:hidden">Lançar compra</h2>
            <FormCompra fornecedores={fornecedores.filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome }))} itens={itensOvo} marcas={marcas} hoje={hoje} />
            </Recolhe>
          </section>
          <section className="cartao p-5 max-lg:hidden">
            <h2 className="mb-3 font-semibold text-marca-950">Novo fornecedor</h2>
            <FormFornecedor />
          </section>
        </aside>
      </div>

      <section className="cartao mt-6 overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 px-5 py-4 max-lg:border-0 max-lg:pb-0">
          <h2 className="font-eggs text-lg font-extrabold text-marca-950">Pra onde foram os ovos</h2>
          {semFornecedor > 0 && (
            <p className="text-xs font-semibold text-amber-700">
              {semFornecedor} {semFornecedor === 1 ? "item entregue está" : "itens entregues estão"} sem fornecedor: abra o pedido e escolha.
            </p>
          )}
        </div>
        {vendidos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-500">Nenhuma venda com fornecedor ainda. No pedido, escolha de qual fornecedor saíram as caixas.</p>
        ) : (
          <Recolhe rotulo={`Ver ${Math.min(vendidos.length, 150)} entregas`} className="lg:overflow-x-auto max-lg:[&>button]:px-5">
            <table className="lista-cel w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Entrega</th>
                  <th className="px-3 py-2.5 font-medium">Pedido</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-3 py-2.5 font-medium">Produto</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qtd</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor un.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {vendidos.slice(0, 150).map((v) => (
                  <tr key={v.id}>
                    <td data-c="s" className="order-2 px-5 py-2.5 whitespace-nowrap">{formatarDataCurta(v.pedido.dataEntrega)} <span className="lg:hidden">· de {v.fornecedor?.nome}</span></td>
                    <td data-c="x" className="px-3 py-2.5">
                      <Link href={`/painel/pedidos/${v.pedidoId}`} className="text-marca-700 hover:underline">#{v.pedidoId}</Link>
                    </td>
                    <td data-c="t" className="px-3 py-2.5"><Link href={`/painel/pedidos/${v.pedidoId}`} className="linha-toque">{v.pedido.cliente.nomeFantasia}</Link></td>
                    <td data-c="x" className="px-3 py-2.5 font-medium">{v.fornecedor?.nome}</td>
                    <td data-c="x" className="px-3 py-2.5 text-stone-500">{v.produto.item.nome} · {v.produto.embalagem}</td>
                    <td data-c="l" className="tabular order-3 px-3 py-2.5 text-right">{quantidade(v.quantidade, v.produto.unidade)}</td>
                    <td data-c="x" className="tabular px-3 py-2.5 text-right">{reais(v.precoUnit)}</td>
                    <td data-c="v" className="tabular px-3 py-2.5 text-right font-semibold text-marca-950">{reais(v.subtotal)}</td>
                    <td data-c="x" className="px-5 py-2.5 text-xs text-stone-500">{STATUS_PEDIDO[v.pedido.status as StatusPedido] ?? v.pedido.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Recolhe>
        )}
      </section>

      <section className="cartao mt-6 overflow-hidden">
        <h2 className="border-b border-stone-100 px-5 py-4 font-eggs text-lg font-extrabold text-marca-950 max-lg:border-0 max-lg:pb-0">Compras lançadas</h2>
        {compras.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-500">Nenhuma compra ainda. Use &quot;Lançar compra&quot; pra registrar o que já foi pego.</p>
        ) : (
          <Recolhe rotulo={`Ver ${Math.min(compras.length, 150)} compras`} className="lg:overflow-x-auto max-lg:[&>button]:px-5">
            <table className="lista-cel w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Data</th>
                  <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-3 py-2.5 font-medium">Marca</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Caixas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor da caixa</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {compras.slice(0, 150).map((c) => (
                  <tr key={c.id}>
                    <td data-c="s" className="order-2 px-5 py-2.5 whitespace-nowrap">{formatarDataCurta(c.data)} <span className="lg:hidden">· {num(c.quantidade)} cx{c.custoUnit !== null ? ` a ${reais(c.custoUnit)}` : ""}</span></td>
                    <td data-c="t" className="px-3 py-2.5">{c.fornecedor ?? "—"}</td>
                    <td data-c="x" className="px-3 py-2.5">{c.marca ?? "—"}</td>
                    <td data-c="x" className="px-3 py-2.5 text-stone-500">{c.item.nome}</td>
                    <td data-c="x" className="tabular px-3 py-2.5 text-right">{num(c.quantidade)}</td>
                    <td data-c="x" className="tabular px-3 py-2.5 text-right">{c.custoUnit !== null ? reais(c.custoUnit) : "—"}</td>
                    <td data-c="v" className="tabular px-3 py-2.5 text-right font-semibold text-marca-950">{reais(c.quantidade * (c.custoUnit ?? 0))}</td>
                    <td data-c="x" className="px-5 py-2.5 text-right">
                      <form action={excluirMovimento.bind(null, c.id)}>
                        <button className="text-xs text-stone-400 hover:text-red-600">Excluir</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Recolhe>
        )}
      </section>
    </>
  );
}
