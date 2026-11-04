import Link from "next/link";
import { PedidosQueChegaram } from "./pedidos/chegaram";
import { AtualizaSozinho } from "@/components/atualiza-sozinho";
import { ArrowRight } from "lucide-react";
import { GraficoBarras } from "@/components/grafico-barras";
import { GraficoLinhas } from "@/components/grafico-linhas";
import { Cabecalho, Codigo, Indicador } from "@/components/ui";
import { ORIGENS_COMPRA, TIPOS_MOVIMENTO, type TipoMovimento } from "@/lib/constantes";
import { pedidosNoPeriodo } from "@/lib/consultas";
import { COR_CUSTO, COR_VENDA } from "@/lib/cores";
import { diaISO, fimDoDia, formatarDataCurta, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { custosMedios, saldos } from "@/lib/estoque";
import { nomeProduto, num, pct, reais } from "@/lib/formato";
import { relatorioVendas } from "@/lib/relatorio";
import { FormMovimento } from "./estoque/forms";

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;
const curto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export default async function Inicio() {
  const hoje = diaISO();
  const amanha = somarDias(hoje, 1);
  const inicio30 = somarDias(hoje, -29);
  const dias30 = Array.from({ length: 30 }, (_, i) => somarDias(inicio30, i));

  const [itens, movimentos, pedidos, proximos, saldo, custo, abertas, mes] = await Promise.all([
    db.item.findMany({ include: { produtos: { include: { precos: { orderBy: { em: "asc" } } }, orderBy: { preco: "desc" } } }, orderBy: { ordem: "asc" } }),
    db.movimentoEstoque.findMany({ where: { data: { gte: inicioDoDia(inicio30), lt: fimDoDia(hoje) } }, include: { item: true }, orderBy: { data: "desc" } }),
    pedidosNoPeriodo(inicio30, hoje),
    pedidosNoPeriodo(hoje, amanha),
    saldos(new Date()),
    custosMedios(new Date()),
    db.cobranca.findMany({ where: { pagoEm: null } }),
    relatorioVendas("mes", hoje),
  ]);

  const caixasDoPedido = (p: (typeof proximos)[number]) => p.itens.reduce((s, i) => s + i.quantidade * (i.produto.fatorEstoque ?? 0), 0);
  const doDia = (d: string) => proximos.filter((p) => diaISO(p.dataEntrega) === d);
  const [deHoje, deAmanha] = [doDia(hoje), doDia(amanha)];
  const aEntregarHoje = deHoje.filter((p) => p.status !== "ENTREGUE");

  const estoque = itens.reduce((s, i) => s + (saldo.get(i.id) ?? 0), 0);
  const vendidas30 = pedidos.reduce((s, p) => s + caixasDoPedido(p), 0);
  const duraDias = vendidas30 > 0 ? estoque / (vendidas30 / 30) : null;
  const vencidas = abertas.filter((c) => c.vencimento < hoje);

  // Últimos 30 dias: caixas que entraram × saíram; custo de compra × preço de venda da caixa de ovo branco
  const compras = movimentos.filter((m) => m.tipo === "COMPRA");
  const graficoCaixas = dias30.map((d) => ({
    faixa: curto(d),
    entrou: Math.round(compras.filter((m) => diaISO(m.data) === d).reduce((s, m) => s + m.quantidade, 0) * 10) / 10,
    saiu: Math.round(pedidos.filter((p) => diaISO(p.dataEntrega) === d).reduce((s, p) => s + caixasDoPedido(p), 0) * 10) / 10,
  }));
  const branco = itens.find((i) => i.nome === "Ovo branco");
  const caixaBranco = branco?.produtos.find((p) => p.unidade === "caixa");
  const precoEm = (d: string) => [...(caixaBranco?.precos ?? [])].reverse().find((h) => diaISO(h.em) <= d)?.preco ?? null;
  const graficoPrecos = dias30.map((d) => {
    const doDia = compras.filter((m) => m.itemId === branco?.id && diaISO(m.data) === d);
    const caixas = doDia.reduce((s, m) => s + m.quantidade, 0);
    return { faixa: curto(d), custo: caixas ? Math.round(doDia.reduce((s, m) => s + m.quantidade * (m.custoUnit ?? 0), 0) / caixas) : null, venda: precoEm(d) };
  });
  const porOrigem = Object.entries(ORIGENS_COMPRA)
    .map(([chave, rotulo]) => {
      const lista = compras.filter((m) => m.origem === chave);
      const caixas = lista.reduce((s, m) => s + m.quantidade, 0);
      return { rotulo, caixas, custoMedio: caixas ? lista.reduce((s, m) => s + m.quantidade * (m.custoUnit ?? 0), 0) / caixas : null };
    })
    .filter((o) => o.caixas > 0);

  return (
    <>
      <Cabecalho titulo="Início" subtitulo={`${formatarDia(hoje)} · caixa = 12 bandejas de 30 (360 ovos)`}>
        <AtualizaSozinho segundos={30} />
        <Link href="/painel/relatorios" className="botao-primario">
          Relatórios de vendas <ArrowRight className="size-4" />
        </Link>
      </Cabecalho>

      <PedidosQueChegaram />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 [&>*]:min-w-0">
        <Link href={`/painel/pedidos?dia=${hoje}`} className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="Entregas hoje" valor={num(deHoje.length)} detalhe={`${cx(deHoje.reduce((s, p) => s + caixasDoPedido(p), 0))} · ${aEntregarHoje.length} a entregar`} />
        </Link>
        <Link href={`/painel/pedidos?dia=${amanha}`} className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="Entregas amanhã" valor={num(deAmanha.length)} detalhe={cx(deAmanha.reduce((s, p) => s + caixasDoPedido(p), 0))} />
        </Link>
        <Link href="/painel/estoque" className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="Em estoque" valor={cx(estoque)} detalhe={estoque < 0 ? "negativo: falta lançar compra" : duraDias !== null ? `dá pra uns ${num(Math.floor(duraDias))} dias` : undefined} />
        </Link>
        <Link href="/painel/cobrancas" className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="A receber" valor={reais(abertas.reduce((s, c) => s + c.valor, 0))} detalhe={vencidas.length ? `${vencidas.length} vencidas · ${reais(vencidas.reduce((s, c) => s + c.valor, 0))}` : "nada vencido"} />
        </Link>
        <Link href="/painel/relatorios?periodo=mes" className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="Faturamento do mês" valor={reais(mes.total.faturamento)} detalhe={`${cx(mes.total.caixas)} vendidas`} />
        </Link>
        <Link href="/painel/relatorios?periodo=mes" className="block transition hover:-translate-y-0.5">
          <Indicador rotulo="Lucro do mês" valor={reais(mes.total.lucro)} detalhe={mes.total.margem !== null ? `margem ${pct(mes.total.margem)}` : undefined} />
        </Link>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Caixas: entrada × saída (30 dias)</h2>
          <p className="mb-4 text-xs text-stone-500">Entrada = compras (granja, CEASA). Saída = vendidas, em caixas equivalentes (bandeja de 30 = 1/12 cx)</p>
          <GraficoBarras
            dados={graficoCaixas}
            categoria="faixa"
            series={[
              { chave: "entrou", rotulo: "Entrou (compras)", cor: COR_CUSTO },
              { chave: "saiu", rotulo: "Saiu (vendas)", cor: COR_VENDA },
            ]}
          />
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Valor da caixa (30 dias)</h2>
          <p className="mb-4 text-xs text-stone-500">Ovo branco: quanto custou cada caixa comprada × preço de venda da caixa</p>
          <GraficoLinhas
            dados={graficoPrecos}
            categoria="faixa"
            series={[
              { chave: "venda", rotulo: "Venda (caixa branco)", cor: COR_VENDA },
              { chave: "custo", rotulo: "Custo de compra (branco)", cor: COR_CUSTO },
            ]}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <h2 className="px-4 pt-4 font-semibold text-marca-950">Produtos: preço, custo e margem de hoje</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2 text-right">Venda</th>
                <th className="px-4 py-2 text-right">Custo</th>
                <th className="px-4 py-2 text-right">Margem</th>
                <th className="px-4 py-2 text-right">Estoque do tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {itens.flatMap((i) =>
                i.produtos
                  .filter((p) => p.ativo)
                  .map((p) => {
                    const c = custo.has(i.id) && p.fatorEstoque ? custo.get(i.id)! * p.fatorEstoque : null;
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2">
                          <Link href="/painel/precos" className="flex items-center gap-2 hover:underline">
                            <Codigo codigo={i.codigo} /> {nomeProduto({ ...p, item: i })}
                          </Link>
                        </td>
                        <td className="tabular px-4 py-2 text-right font-semibold">{reais(p.preco)}</td>
                        <td className="tabular px-4 py-2 text-right">{c !== null ? reais(c) : "—"}</td>
                        <td className="tabular px-4 py-2 text-right">{c !== null && p.preco > 0 ? pct((p.preco - c) / p.preco) : "—"}</td>
                        <td className="tabular px-4 py-2 text-right text-stone-600">{cx(saldo.get(i.id) ?? 0)}</td>
                      </tr>
                    );
                  }),
              )}
            </tbody>
          </table>
        </div>
        <div className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Registrar compra, perda ou contagem</h2>
          <FormMovimento itens={itens.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidade: i.unidadeEstoque, categoria: "Ovos" }))} />
          <h3 className="mb-2 mt-6 text-sm font-semibold text-marca-950">De onde vieram (30 dias)</h3>
          {porOrigem.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhuma compra nos últimos 30 dias.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100">
                {porOrigem.map((o) => (
                  <tr key={o.rotulo}>
                    <td className="py-2 font-medium">{o.rotulo}</td>
                    <td className="tabular py-2 text-right">{cx(o.caixas)}</td>
                    <td className="tabular py-2 text-right text-stone-600">{o.custoMedio !== null ? `${reais(o.custoMedio)}/cx` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6 cartao p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-marca-950">Últimos movimentos do estoque</h2>
          <Link href="/painel/estoque" className="text-sm text-marca-700 hover:underline">Ver estoque</Link>
        </div>
        <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto text-sm">
          {movimentos.slice(0, 40).map((m) => (
            <li key={m.id} className="flex justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{TIPOS_MOVIMENTO[m.tipo as TipoMovimento] ?? m.tipo}</span>
                <span className="text-stone-500">
                  {" "}· {m.item.nome} · {formatarDataCurta(m.data)}
                  {m.origem && ` · ${ORIGENS_COMPRA[m.origem as keyof typeof ORIGENS_COMPRA]}`}
                  {m.custoUnit !== null && ` · ${reais(m.custoUnit)}/cx`}
                  {m.observacao && ` · ${m.observacao}`}
                </span>
              </span>
              <span className="tabular shrink-0 font-semibold">
                {m.quantidade > 0 ? "+" : "−"}
                {cx(Math.abs(m.quantidade))}
              </span>
            </li>
          ))}
          {movimentos.length === 0 && <li className="py-6 text-center text-stone-500">Nada lançado nos últimos 30 dias.</li>}
        </ul>
      </section>
    </>
  );
}
