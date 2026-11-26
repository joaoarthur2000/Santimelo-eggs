import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus, Pencil, Plus } from "lucide-react";
import { BotaoConfirma } from "@/components/botao-enviar";
import { SituacaoPagamento } from "@/components/situacao-pagamento";
import { Cabecalho, Etiqueta, Indicador, SeletorDia } from "@/components/ui";
import { ehOvo, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaDaSemana, diaISO, diaValido, fimDoDia, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, pct, quantidade, reais } from "@/lib/formato";
import { relatorioVendas } from "@/lib/relatorio";
import { exigirPapel } from "@/lib/sessao";
import { marcarPago } from "../actions";
import { ExcluirLancamento } from "../estoque/editar";
import { JanelaCompra } from "../fornecedores/janela-compra";
import { porDataDeEntrega } from "../pedidos/chegaram";
import { ExcluirPedido } from "../pedidos/excluir-pedido";

export const metadata: Metadata = { title: "Dia a dia" };

// Um dia por vez: tudo que foi vendido (pela data de entrega) e comprado nele, com edição e lançamento retroativo.

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;

export default async function DiaADia({ searchParams }: PageProps<"/painel/dia">) {
  await exigirPapel("DIRETOR");
  const dia = diaValido((await searchParams).dia);
  const hoje = diaISO();
  const segunda = somarDias(dia, -((diaDaSemana(dia) + 6) % 7));
  const domingo = somarDias(segunda, 6);
  const noDia = { gte: inicioDoDia(dia), lt: fimDoDia(dia) };
  const naSemana = { gte: inicioDoDia(segunda), lt: fimDoDia(domingo) };

  const [r, todos, compras, pedidosSemana, comprasSemana, fornecedores, itens, comMarca] = await Promise.all([
    relatorioVendas("dia", dia),
    db.pedido.findMany({
      where: { dataEntrega: noDia },
      include: { cliente: true, janela: true, cobranca: true, itens: { include: { fornecedor: true, produto: { include: { item: true } } } } },
    }),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: noDia }, include: { item: true, fornecedorCad: true }, orderBy: { data: "asc" } }),
    db.pedido.findMany({ where: { dataEntrega: naSemana, status: { not: "CANCELADO" } }, select: { dataEntrega: true, total: true } }),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: naSemana }, select: { data: true } }),
    db.fornecedor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    db.item.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", marca: { not: null } }, distinct: ["marca"], select: { marca: true }, orderBy: { marca: "asc" } }),
  ]);

  const pedidos = todos.filter((p) => p.status !== "CANCELADO").sort(porDataDeEntrega);
  const cancelados = todos.length - pedidos.length;
  const abertas = pedidos.filter((p) => p.cobranca && !p.cobranca.pagoEm);
  const emAberto = abertas.reduce((s, p) => s + p.cobranca!.valor, 0);
  const valorCompras = compras.reduce((s, c) => s + c.quantidade * (c.custoUnit ?? 0), 0);
  const caixasCompras = compras.filter((c) => ehOvo(c.item.unidadeEstoque)).reduce((s, c) => s + c.quantidade, 0);
  const marcas = comMarca.flatMap((m) => m.marca ?? []);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = somarDias(segunda, i);
    const doDia = pedidosSemana.filter((p) => diaISO(p.dataEntrega) === d);
    return { d, vendas: doDia.length, total: doDia.reduce((s, p) => s + p.total, 0), compras: comprasSemana.filter((c) => diaISO(c.data) === d).length };
  });
  const formCompra = { dia, hoje, fornecedores, itens, marcas };
  const lucro = r.total.lucro;

  return (
    <>
      <Cabecalho titulo="Dia a dia" subtitulo={formatarDia(dia)}>
        <div className="flex items-stretch gap-2 max-lg:w-full">
          <SeletorDia dia={dia} rota="/painel/dia" />
          {dia !== hoje && (
            <Link href="/painel/dia" className="botao-secundario max-lg:px-3">
              Hoje
            </Link>
          )}
        </div>
      </Cabecalho>

      {/* A semana: onde teve venda e compra, e onde ficou vazio */}
      <nav className="mb-5 grid grid-cols-7 gap-1 lg:mb-6 lg:gap-2" aria-label="Dias da semana">
        {semana.map((s) => {
          const ativo = s.d === dia;
          const nome = formatarDia(s.d, { weekday: "short" }).replace(".", "");
          return (
            <Link
              key={s.d}
              href={`/painel/dia?dia=${s.d}`}
              aria-current={ativo ? "date" : undefined}
              aria-label={`${formatarDia(s.d)}: ${s.vendas} vendas, ${s.compras} compras`}
              className={`min-w-0 rounded-xl px-1 py-2 text-center transition-colors duration-150 lg:px-3 lg:text-left ${ativo ? "bg-marca-900 text-white" : "bg-white ring-1 ring-stone-200 hover:ring-stone-300 active:bg-stone-100"} ${s.d === hoje && !ativo ? "ring-2 ring-ouro" : ""}`}
            >
              <span className={`block text-xs first-letter:uppercase ${ativo ? "text-white/75" : "text-stone-500"}`}>{nome}</span>
              <span className="tabular block text-lg leading-tight font-bold">{s.d.slice(8, 10)}</span>
              <span className={`tabular block text-xs ${s.vendas ? (ativo ? "font-semibold text-ouro" : "font-semibold text-folha") : ativo ? "text-white/60" : "text-stone-500"}`}>
                <span className="lg:hidden">{s.vendas || "–"}</span>
                <span className="max-lg:hidden">{s.vendas ? `${s.vendas} ${s.vendas === 1 ? "venda" : "vendas"} · ${reais(s.total)}` : "sem vendas"}</span>
              </span>
              <span className={`block text-xs max-lg:hidden ${ativo ? "text-white/60" : "text-stone-500"}`}>{s.compras ? `${s.compras} ${s.compras === 1 ? "compra" : "compras"}` : "sem compras"}</span>
            </Link>
          );
        })}
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Vendas" valor={reais(r.total.faturamento)} detalhe={`${num(pedidos.length)} ${pedidos.length === 1 ? "entrega" : "entregas"} · ${cx(r.total.caixas)}`} />
        <Indicador rotulo="Compras" valor={reais(valorCompras)} detalhe={compras.length ? `${num(compras.length)} ${compras.length === 1 ? "compra" : "compras"} · ${cx(caixasCompras)}` : "nenhuma compra"} />
        <Indicador rotulo={lucro < 0 ? "Prejuízo nas vendas" : "Lucro nas vendas"} valor={reais(lucro)} detalhe={r.total.margem !== null ? `margem ${pct(r.total.margem)}` : "sem vendas com custo"} />
        <Indicador rotulo="Em aberto" valor={reais(emAberto)} detalhe={abertas.length ? `${num(abertas.length)} de ${num(pedidos.length)} por receber` : pedidos.length ? "tudo recebido" : "nada a receber"} />
      </section>

      <div className="mt-5 grid gap-5 lg:mt-6 lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_420px] [&>*]:min-w-0">
        <section className="cartao h-fit overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-4">
            <h2 className="text-lg font-semibold text-marca-950">Vendas e entregas</h2>
            <Link href={`/painel/pedidos/novo?dia=${dia}&voltar=dia`} className="botao-primario">
              <Plus className="size-4" /> <span className="lg:hidden">Entrega</span>
              <span className="max-lg:hidden">Adicionar entrega</span>
            </Link>
          </div>
          {pedidos.length === 0 ? (
            <p className="border-t border-stone-100 px-5 py-8 text-center text-stone-500">Nenhuma entrega lançada nesse dia.</p>
          ) : (
            <table className="lista-cel w-full border-t border-stone-100 text-sm">
              <thead className="border-b border-stone-200 text-left text-xs tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-3 py-3">Itens</th>
                  <th className="px-3 py-3">Pagamento</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="w-px px-5 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td data-c="t" className="px-5 py-3 align-top">
                      <Link href={`/painel/pedidos/${p.id}`} className="font-medium text-marca-950 hover:underline">
                        {p.cliente.nomeFantasia}
                      </Link>
                      <span className="block text-xs font-normal text-stone-500">
                        #{p.id}
                        {p.janela && ` · ${p.janela.inicio}–${p.janela.fim}`}
                        {p.observacao && ` · ${p.observacao}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top max-lg:text-[15px]">
                      {p.itens.map((i) => (
                        <span key={i.id} className="block text-stone-700">
                          {quantidade(i.quantidade, i.produto.unidade)} {i.produto.item.nome} <span className="tabular text-stone-500">× {reais(i.precoUnit)}</span>
                          <span className={i.fornecedor || !i.produto.fatorEstoque ? "text-stone-500" : "font-medium text-amber-800"}> · {i.fornecedor?.nome ?? (i.produto.fatorEstoque ? "falta o fornecedor" : "")}</span>
                        </span>
                      ))}
                    </td>
                    <td data-c="s" className="px-3 py-3 align-top">
                      <SituacaoPagamento pedido={p} />
                    </td>
                    <td data-c="l" className="px-3 py-3 align-top">
                      <Etiqueta status={p.status}>{STATUS_PEDIDO[p.status as StatusPedido]}</Etiqueta>
                    </td>
                    <td data-c="v" className="tabular px-3 py-3 text-right align-top font-semibold">
                      {reais(p.total)}
                    </td>
                    <td data-c="a" className="px-5 py-3 align-top">
                      <span className="flex items-center justify-end gap-2 max-lg:justify-start">
                        {p.cobranca && !p.cobranca.pagoEm && (
                          <form action={marcarPago.bind(null, p.cobranca.id)} className="max-lg:flex-1">
                            <BotaoConfirma className="botao-secundario px-3 py-1.5 whitespace-nowrap max-lg:w-full" confirmar="Confirmar" enviando="…">
                              Recebi
                            </BotaoConfirma>
                          </form>
                        )}
                        <Link href={`/painel/pedidos/${p.id}/editar?voltar=dia`} className="botao-secundario px-3 py-1.5 max-lg:flex-1">
                          <Pencil className="size-4" /> Editar
                        </Link>
                        <span className="max-lg:hidden">
                          <ExcluirPedido id={p.id} />
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cancelados > 0 && (
            <p className="border-t border-stone-100 px-5 py-3 text-sm text-stone-500">
              <Link href={`/painel/pedidos?dia=${dia}&status=CANCELADO`} className="toque hover:underline">
                {cancelados === 1 ? "1 pedido cancelado" : `${cancelados} pedidos cancelados`} nesse dia
              </Link>
            </p>
          )}
        </section>

        <section className="cartao h-fit overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-4">
            <h2 className="text-lg font-semibold text-marca-950">Compras</h2>
            {dia <= hoje && (
              <JanelaCompra {...formCompra} titulo="Adicionar compra" className="botao-secundario">
                <PackagePlus className="size-4" /> <span className="lg:hidden">Compra</span>
                <span className="max-lg:hidden">Adicionar compra</span>
              </JanelaCompra>
            )}
          </div>
          {compras.length === 0 ? (
            <p className="border-t border-stone-100 px-5 py-8 text-center text-stone-500">Nenhuma compra lançada nesse dia.</p>
          ) : (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {compras.map((c) => (
                <li key={c.id} className="px-4 py-3 lg:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm">
                      <b className="font-semibold text-marca-950 max-lg:text-base">{c.fornecedorCad?.nome ?? c.fornecedor ?? "Sem fornecedor"}</b>
                      <span className="block text-stone-600">
                        {quantidade(c.quantidade, c.item.unidadeEstoque)} {c.item.nome}
                        {c.custoUnit !== null && <span className="tabular text-stone-500"> × {reais(c.custoUnit)}</span>}
                      </span>
                      {(c.marca || c.observacao) && <span className="block text-xs text-stone-500">{[c.marca && `Marca ${c.marca}`, c.observacao].filter(Boolean).join(" · ")}</span>}
                    </p>
                    <b className="tabular shrink-0 text-sm font-semibold text-marca-950 max-lg:text-base">{reais(c.quantidade * (c.custoUnit ?? 0))}</b>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <JanelaCompra
                      {...formCompra}
                      titulo="Editar compra"
                      className="botao-secundario px-3 py-1.5"
                      compra={{ id: c.id, fornecedorId: c.fornecedorId, fornecedor: c.fornecedor, itemId: c.itemId, item: c.item.nome, marca: c.marca, quantidade: c.quantidade, custoUnit: c.custoUnit }}
                    >
                      <Pencil className="size-4" /> Editar
                    </JanelaCompra>
                    <ExcluirLancamento id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-5 text-sm">
        <Link href={`/painel/relatorios?periodo=dia&dia=${dia}`} className="toque text-marca-700 hover:underline">
          Ver o fechamento completo desse dia em Relatórios
        </Link>
      </p>
    </>
  );
}
