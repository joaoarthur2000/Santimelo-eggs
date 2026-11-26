import { GraficoBarras } from "@/components/graficos";
import Link from "next/link";
import { Codigo, Indicador, Vazio } from "@/components/ui";
import { diaISO, fimDoDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { estoquePorFornecedor, saldos } from "@/lib/estoque";
import { num, pct, reais } from "@/lib/formato";
import { qtd, redondo } from "./util";

const PERIODOS = { "7": "7 dias", "30": "30 dias", "90": "90 dias", mes: "Este mês", anterior: "Mês passado" } as const;
type Periodo = keyof typeof PERIODOS;

function intervalo(p: Periodo, hoje: string): [string, Date, Date] {
  const [a, m] = hoje.split("-").map(Number);
  const primeiro = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`;
  if (p === "mes") return [primeiro(a, m), inicioDoDia(primeiro(a, m)), fimDoDia(hoje)];
  if (p === "anterior") {
    const [ap, mp] = m === 1 ? [a - 1, 12] : [a, m - 1];
    return [primeiro(ap, mp), inicioDoDia(primeiro(ap, mp)), inicioDoDia(primeiro(a, m))];
  }
  const ini = somarDias(hoje, -(Number(p) - 1));
  return [ini, inicioDoDia(ini), fimDoDia(hoje)];
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export async function AbaRelatorio({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const periodo: Periodo = typeof sp.periodo === "string" && sp.periodo in PERIODOS ? (sp.periodo as Periodo) : "30";
  const hoje = diaISO();
  const [diaIni, ini, fim] = intervalo(periodo, hoje);

  const [itens, inicial, movimentos, fornecedores, porFornecedor] = await Promise.all([
    db.item.findMany({ orderBy: { ordem: "asc" } }),
    saldos(ini),
    db.movimentoEstoque.findMany({ where: { data: { gte: ini, lt: fim } }, select: { itemId: true, tipo: true, quantidade: true, custoUnit: true, fornecedorId: true, data: true } }),
    db.fornecedor.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true, ativo: true } }),
    estoquePorFornecedor(),
  ]);

  // por tipo de ovo: início → compras − vendas − perdas ± ajustes → fim
  const porItem = itens
    .map((i) => {
      const ms = movimentos.filter((m) => m.itemId === i.id);
      const soma = (tipo: string) => ms.filter((m) => m.tipo === tipo).reduce((t, m) => t + m.quantidade, 0);
      const comprado = ms.filter((m) => m.tipo === "COMPRA" && m.custoUnit !== null).reduce((t, m) => t + m.quantidade * m.custoUnit!, 0);
      const compras = soma("COMPRA");
      const comeco = inicial.get(i.id) ?? 0;
      const linha = { item: i, inicio: comeco, compras, vendas: -soma("VENDA"), perdas: -soma("PERDA"), ajustes: soma("AJUSTE"), comprado, fim: 0 };
      linha.fim = comeco + compras - linha.vendas - linha.perdas + linha.ajustes;
      return linha;
    })
    .filter((l) => l.item.ativo || [l.inicio, l.compras, l.vendas, l.perdas, l.ajustes].some((v) => Math.abs(v) > 0.001));
  const ovos = porItem.filter((l) => l.item.unidadeEstoque === "caixa");
  const total = (k: "inicio" | "compras" | "vendas" | "perdas" | "ajustes" | "fim" | "comprado") => ovos.reduce((t, l) => t + l[k], 0);

  // gráfico: por dia (até 31 dias) ou por semana
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86400000);
  const passo = dias > 31 ? 7 : 1;
  const grafico: { faixa: string; entrou: number; saiu: number }[] = [];
  for (let d = diaIni; inicioDoDia(d) < fim; d = somarDias(d, passo)) {
    const a = inicioDoDia(d);
    const b = inicioDoDia(somarDias(d, passo));
    const ms = movimentos.filter((m) => m.data >= a && m.data < b);
    grafico.push({
      faixa: passo === 1 ? ddmm(d) : `sem ${ddmm(d)}`,
      entrou: redondo(ms.filter((m) => m.tipo === "COMPRA").reduce((t, m) => t + m.quantidade, 0)),
      saiu: redondo(-ms.filter((m) => m.tipo === "VENDA" || m.tipo === "PERDA").reduce((t, m) => t + m.quantidade, 0)),
    });
  }

  // por fornecedor no período + o que ainda tem dele hoje
  const linhasFornecedor = fornecedores
    .map((f) => {
      const ms = movimentos.filter((m) => m.fornecedorId === f.id);
      const compras = ms.filter((m) => m.tipo === "COMPRA");
      const caixas = compras.reduce((t, m) => t + m.quantidade, 0);
      const valor = compras.reduce((t, m) => t + m.quantidade * (m.custoUnit ?? 0), 0);
      const estoque = [...porFornecedor].filter(([k]) => k.startsWith(`${f.id}|`)).reduce((t, [, v]) => t + v.saldo, 0);
      return {
        f,
        caixas,
        valor,
        custo: caixas > 0 ? valor / caixas : null,
        vendidas: -ms.filter((m) => m.tipo === "VENDA").reduce((t, m) => t + m.quantidade, 0),
        perdas: -ms.filter((m) => m.tipo === "PERDA").reduce((t, m) => t + m.quantidade, 0),
        estoque,
      };
    })
    .filter((l) => l.f.ativo || l.caixas || l.vendidas || Math.abs(l.estoque) > 0.001);
  const melhorCusto = Math.min(...linhasFornecedor.filter((l) => l.custo !== null).map((l) => l.custo!));

  const perdasPct = total("compras") > 0 ? total("perdas") / total("compras") : null;
  const th = "px-4 py-3 text-right";
  const td = "tabular px-4 py-3 text-right";

  return (
    <>
      <nav className="sem-rolagem flex gap-1.5 overflow-x-auto">
        {(Object.entries(PERIODOS) as [Periodo, string][]).map(([k, r]) => (
          <Link
            key={k}
            href={`/painel/estoque?aba=relatorio&periodo=${k}`}
            className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ring-1 max-lg:py-3 ring-inset transition-colors duration-150 ${
              periodo === k ? "bg-marca-900 font-medium text-white ring-marca-900" : "bg-white text-stone-600 ring-stone-200 hover:text-marca-950 hover:ring-stone-300"
            }`}
          >
            {r}
          </Link>
        ))}
      </nav>

      <section className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Entrou" valor={`${num(redondo(total("compras")))} cx`} detalhe={`${reais(total("comprado"))} em compras`} />
        <Indicador rotulo="Vendido" valor={`${num(redondo(total("vendas")))} cx`} detalhe="pedidos entregues" />
        <Indicador rotulo="Perdas e saídas" valor={`${num(redondo(total("perdas")))} cx`} detalhe={perdasPct === null ? "nenhuma compra no período" : `${pct(perdasPct)} do que entrou`} />
        <Indicador rotulo="Estoque" valor={`${num(redondo(total("inicio")))} → ${num(redondo(total("fim")))} cx`} detalhe="no começo → no fim do período" />
      </section>

      <section className="cartao mt-6 p-5">
        <h2 className="font-semibold text-marca-950">Entradas × saídas</h2>
        <p className="mb-4 text-xs text-stone-500">Caixas que entraram (compras) e saíram (vendas e perdas){passo === 7 ? ", por semana" : ", por dia"}.</p>
        {movimentos.length === 0 ? (
          <Vazio>Nada lançado nesse período.</Vazio>
        ) : (
          <GraficoBarras dados={grafico} categoria="faixa" series={[{ chave: "entrou", rotulo: "Entrou", cor: "#516029" }, { chave: "saiu", rotulo: "Saiu", cor: "#d14c19" }]} />
        )}
      </section>

      <section className="cartao mt-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-semibold text-marca-950">Por tipo de ovo</h2>
        <table className="lista-cel mt-3 w-full text-sm">
          <thead className="border-y border-stone-200 text-left text-[11px] text-stone-500 uppercase">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className={th}>Início</th>
              <th className={th}>+ Compras</th>
              <th className={th}>− Vendas</th>
              <th className={th}>− Perdas</th>
              <th className={th}>± Ajustes</th>
              <th className={th}>Fim</th>
              <th className={th}>Comprado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {porItem.map((l) => (
              <tr key={l.item.id}>
                <td data-c="t" className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <Codigo codigo={l.item.codigo} /> {l.item.nome}
                  </span>
                </td>
                <td data-c="p" data-r="Início" className={`${td} text-stone-500`}>{qtd(l.inicio, l.item.unidadeEstoque)}</td>
                <td data-c="p" data-r="Compras" className={`${td} text-emerald-700`}>{l.compras ? `+${num(redondo(l.compras))}` : "—"}</td>
                <td data-c="p" data-r="Vendas" className={td}>{l.vendas ? `−${num(redondo(l.vendas))}` : "—"}</td>
                <td data-c="p" data-r="Perdas" className={`${td} text-red-700`}>{l.perdas ? `−${num(redondo(l.perdas))}` : "—"}</td>
                <td data-c="p" data-r="Ajustes" className={`${td} text-stone-500`}>{Math.abs(l.ajustes) > 0.001 ? `${l.ajustes > 0 ? "+" : "−"}${num(redondo(Math.abs(l.ajustes)))}` : "—"}</td>
                <td data-c="v" className={`${td} font-semibold ${l.fim < -0.001 ? "text-red-700" : "text-marca-950"}`}>{qtd(l.fim, l.item.unidadeEstoque)}</td>
                <td data-c="p" data-r="Comprado" className={td}>{l.comprado ? reais(l.comprado) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao mt-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-semibold text-marca-950">Por fornecedor</h2>
        {linhasFornecedor.length === 0 ? (
          <div className="p-5">
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          </div>
        ) : (
          <table className="lista-cel mt-3 w-full text-sm">
            <thead className="border-y border-stone-200 text-left text-[11px] text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-3">Fornecedor</th>
                <th className={th}>Comprou</th>
                <th className={th}>Valor</th>
                <th className={th}>Custo médio</th>
                <th className={th}>Vendido</th>
                <th className={th}>Perdas</th>
                <th className={th}>Tem hoje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {linhasFornecedor.map((l) => (
                <tr key={l.f.id}>
                  <td data-c="t" className="px-4 py-3 font-medium whitespace-nowrap text-marca-950">
                    <Link href="/painel/fornecedores" className="hover:underline">{l.f.nome}</Link>
                  </td>
                  <td data-c="p" data-r="Comprou" className={td}>{l.caixas ? `${num(redondo(l.caixas))} cx` : "—"}</td>
                  <td data-c="p" data-r="Valor" className={td}>{l.valor ? reais(l.valor) : "—"}</td>
                  <td data-c="p" data-r="Custo médio" className={td}>
                    {l.custo !== null ? (
                      <span className="inline-flex items-center gap-1.5">
                        {l.custo === melhorCusto && linhasFornecedor.filter((x) => x.custo !== null).length > 1 && (
                          <span className="etiqueta bg-emerald-50 text-[10px] text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">menor</span>
                        )}
                        {reais(l.custo)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-c="p" data-r="Vendido" className={td}>{l.vendidas ? `${num(redondo(l.vendidas))} cx` : "—"}</td>
                  <td data-c="p" data-r="Perdas" className={`${td} text-red-700`}>{l.perdas ? `${num(redondo(l.perdas))} cx` : "—"}</td>
                  <td data-c="v" className={`${td} font-semibold`}>{`${num(redondo(l.estoque))} cx`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
