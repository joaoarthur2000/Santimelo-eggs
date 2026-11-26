import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, Package, TriangleAlert } from "lucide-react";
import { DicaInstalarPainel } from "./dica-instalar";
import { PedidosQueChegaram } from "./pedidos/chegaram";
import { GraficoBarras, GraficoLinhas } from "@/components/graficos";
import { AtualizaSozinho } from "@/components/atualiza-sozinho";
import { DIAS_ENTREGA, DIAS_SEMANA, HORARIO_ENTREGA, TIPOS_MOVIMENTO, UNIDADES, categoriaDoItem, ehOvo, type TipoMovimento } from "@/lib/constantes";
import { pedidosNoPeriodo } from "@/lib/consultas";
import { COR_CUSTO, COR_LUCRO, COR_VENDA } from "@/lib/cores";
import { diaDaSemana, diaISO, fimDoDia, formatarDataCurta, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { custosMedios, saldos } from "@/lib/estoque";
import { num, pct, reais } from "@/lib/formato";
import { relatorioVendas } from "@/lib/relatorio";
import { exigirPapel } from "@/lib/sessao";
import { FormMovimento } from "./estoque/forms";

// Início do painel: o dashboard da Santimelo. Dinheiro do mês em cima, próxima entrega ao lado,
// depois cada produto (custo, preço, markup, margem), fornecedores, despesas e clientes.

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;
const curto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const horaAgora = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
const variacao = (atual: number, antes: number) => (antes ? (atual - antes) / Math.abs(antes) : null);

export default async function Inicio() {
  const usuario = await exigirPapel("DIRETOR");
  const hoje = diaISO();
  const hora = Number(horaAgora.format(new Date()));
  const inicio30 = somarDias(hoje, -29);
  const dias30 = Array.from({ length: 30 }, (_, i) => somarDias(inicio30, i));
  const fimMesPassado = somarDias(`${hoje.slice(0, 7)}-01`, -1);

  const [itens, movimentos, pedidos, proximos, saldo, custo, abertas, mes, mesPassado, fornecedores] = await Promise.all([
    db.item.findMany({ include: { produtos: { include: { precos: { orderBy: { em: "asc" } } }, orderBy: { preco: "desc" } } }, orderBy: { ordem: "asc" } }),
    db.movimentoEstoque.findMany({ where: { data: { gte: inicioDoDia(inicio30), lt: fimDoDia(hoje) } }, include: { item: true }, orderBy: { data: "desc" } }),
    pedidosNoPeriodo(inicio30, hoje),
    pedidosNoPeriodo(hoje, somarDias(hoje, 9)),
    saldos(new Date()),
    custosMedios(new Date()),
    db.cobranca.findMany({ where: { pagoEm: null } }),
    relatorioVendas("mes", hoje),
    relatorioVendas("mes", fimMesPassado),
    db.fornecedor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  const caixasDoPedido = (p: (typeof proximos)[number]) => p.itens.reduce((s, i) => s + (ehOvo(i.produto.item.unidadeEstoque) ? i.quantidade * (i.produto.fatorEstoque ?? 0) : 0), 0);

  // Próximas entregas: dias de DIAS_ENTREGA, 05h às 11h. Hoje conta enquanto a janela não acabou
  const diasEntrega: string[] = [];
  for (let d = 0; d < 9 && diasEntrega.length < 2; d++) {
    const dia = somarDias(hoje, d);
    if ((DIAS_ENTREGA as readonly number[]).includes(diaDaSemana(dia)) && (d > 0 || hora < 11)) diasEntrega.push(dia);
  }
  const entrega = (dia: string) => {
    const lista = proximos.filter((p) => diaISO(p.dataEntrega) === dia && p.status !== "CANCELADO");
    return { dia, pedidos: lista.length, clientes: new Set(lista.map((p) => p.clienteId)).size, caixas: lista.reduce((s, p) => s + caixasDoPedido(p), 0), pendentes: lista.filter((p) => p.status === "NOVO").length };
  };
  const [proxima, seguinte] = diasEntrega.map(entrega);

  // Dinheiro do mês
  const f = mes.fechamento;
  const t = mes.total;
  const dLiquido = variacao(f.lucroLiquido, mesPassado.fechamento.lucroLiquido);
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const aReceber = abertas.reduce((s, c) => s + c.valor, 0);
  const estoqueOvos = itens.filter((i) => ehOvo(i.unidadeEstoque)).reduce((s, i) => s + (saldo.get(i.id) ?? 0), 0);
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  // Produtos: um cartão por tipo, com o produto principal (caixa no ovo branco, bandeja no caipira, pacote no camarão)
  const vendidoNoMes = new Map<string, { faturamento: number; lucro: number }>();
  for (const p of mes.porProduto) {
    const item = itens.find((i) => i.produtos.some((x) => `${i.nome} · ${x.embalagem}` === p.nome));
    if (!item) continue;
    const v = vendidoNoMes.get(item.id) ?? { faturamento: 0, lucro: 0 };
    v.faturamento += p.faturamento;
    v.lucro += p.lucro;
    vendidoNoMes.set(item.id, v);
  }
  const produtos = itens
    .filter((i) => i.ativo)
    .map((i) => {
      const ativos = i.produtos.filter((p) => p.ativo);
      const principal = [...(ativos.length ? ativos : i.produtos)].sort((a, b) => (b.fatorEstoque ?? 0) - (a.fatorEstoque ?? 0))[0];
      const custoEstoque = custo.get(i.id) ?? null;
      const custoUnit = custoEstoque !== null && principal?.fatorEstoque ? custoEstoque * principal.fatorEstoque : null;
      const preco = principal?.preco ?? 0;
      return {
        item: i,
        principal,
        liberado: ativos.length > 0 && preco > 0,
        preco,
        custoUnit,
        markup: custoUnit && preco ? (preco - custoUnit) / custoUnit : null,
        margem: custoUnit !== null && preco ? (preco - custoUnit) / preco : null,
        saldo: saldo.get(i.id) ?? 0,
        mes: vendidoNoMes.get(i.id),
      };
    });

  // Gráficos dos últimos 30 dias
  const compras = movimentos.filter((m) => m.tipo === "COMPRA");
  const graficoCaixas = dias30.map((d) => ({
    faixa: curto(d),
    entrou: Math.round(compras.filter((m) => diaISO(m.data) === d && ehOvo(m.item.unidadeEstoque)).reduce((s, m) => s + m.quantidade, 0) * 10) / 10,
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

  const recibo: [string, number][] = [
    ["Vendas", t.faturamento],
    ["Mercadoria", -(t.custo + t.semCusto)],
    ["Veículo", -f.veiculo],
    ["Despesas", -f.despesas],
  ];

  return (
    <>
      {/* Faixa principal: o mês em dinheiro + próxima entrega */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-terra text-concha lg:mb-6">
        <span className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-ouro/15 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-pimenta/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:gap-8 [&>*]:min-w-0">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-concha/70">{saudacao}, {usuario.nome.split(" ")[0]} · <span className="first-letter:uppercase">{formatarDia(hoje)}</span></p>
              <span className="max-lg:hidden print:hidden"><AtualizaSozinho segundos={30} /></span>
            </div>
            <h1 className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-ouro">{f.lucroLiquido < 0 ? "Prejuízo" : "Lucro líquido"} · {mes.titulo}</h1>
            <p className={`tabular mt-1 font-eggs text-5xl font-extrabold tracking-tight sm:text-6xl ${f.lucroLiquido < 0 ? "text-red-300" : "text-concha"}`}>{reais(f.lucroLiquido)}</p>
            <p className="mt-2 text-sm text-concha/70">
              {dLiquido !== null ? <><span className={dLiquido >= 0 ? "text-ouro" : "text-red-300"}>{dLiquido >= 0 ? "▲" : "▼"} {pct(Math.abs(dLiquido))}</span> em relação a {mesPassado.titulo}</> : "Primeiro mês com números pra comparar"}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-concha/15 pt-5 sm:grid-cols-4">
              {recibo.map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt className="text-xs text-concha/60">{rotulo}</dt>
                  <dd className={`tabular font-semibold ${valor < 0 ? "text-concha/85" : "text-concha"}`}>{valor < 0 ? "− " : ""}{reais(Math.abs(valor))}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid content-start gap-3">
            {proxima ? (
              <Link href={`/painel/pedidos?dia=${proxima.dia}`} className="group block rounded-2xl bg-concha p-5 text-terra transition hover:-translate-y-0.5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-noz"><CalendarClock className="size-4" /> {proxima.dia === hoje ? "Entrega de hoje" : "Próxima entrega"}</p>
                <p className="mt-1 font-eggs text-2xl font-extrabold first-letter:uppercase">{formatarDia(proxima.dia)}</p>
                <p className="text-sm text-noz">{HORARIO_ENTREGA}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[["Pedidos", num(proxima.pedidos)], ["Clientes", num(proxima.clientes)], ["Caixas", num(Math.round(proxima.caixas * 10) / 10)]].map(([r, v]) => (
                    <div key={r} className="rounded-xl bg-ouro/25 px-2 py-2.5">
                      <dd className="tabular font-eggs text-2xl font-extrabold">{v}</dd>
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-noz">{r}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 flex items-center justify-between text-sm font-semibold">
                  {proxima.pendentes ? <span className="text-pimenta">{proxima.pendentes} pedido(s) ainda não separados</span> : <span className="text-folha">{proxima.pedidos ? "Tudo em andamento" : "Nenhum pedido ainda"}</span>}
                  <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </Link>
            ) : null}
            {seguinte && (
              <Link href={`/painel/pedidos?dia=${seguinte.dia}`} className="flex items-center justify-between gap-3 rounded-2xl bg-concha/10 px-5 py-3.5 text-sm transition hover:bg-concha/15">
                <span><span className="text-concha/60">Depois:</span> <span className="font-semibold">{DIAS_SEMANA[diaDaSemana(seguinte.dia)]}, {curto(seguinte.dia)}</span></span>
                <span className="tabular shrink-0 text-concha/80">{num(seguinte.pedidos)} pedidos<span className="max-lg:hidden"> · {cx(seguinte.caixas)}</span></span>
              </Link>
            )}
            <p className="px-1 text-xs text-concha/50 max-lg:hidden">Entregas: {DIAS_ENTREGA.map((d) => DIAS_SEMANA[d].toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1")}, {HORARIO_ENTREGA}. Caixa = 12 bandejas de 30 (360 ovos).</p>
          </div>
        </div>
      </section>

      <DicaInstalarPainel />
      <PedidosQueChegaram />

      {/* Indicadores do mês */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*]:min-w-0">
        {[
          { r: "Faturamento", v: reais(t.faturamento), d: variacao(t.faturamento, mes.antes.faturamento), sub: `${num(t.pedidos)} pedidos · ${num(t.clientes)} clientes`, href: "/painel/relatorios?periodo=mes" },
          { r: "Margem", v: t.margem !== null ? pct(t.margem) : "—", sub: "lucro ÷ venda", href: "/painel/relatorios?periodo=mes" },
          { r: "Markup", v: t.markup !== null ? pct(t.markup) : "—", sub: "lucro ÷ custo", href: "/painel/relatorios?periodo=mes" },
          { r: "Caixas vendidas", v: cx(t.caixas), sub: `${cx(estoqueOvos)} em estoque`, href: "/painel/estoque" },
          { r: "A receber", v: reais(aReceber), sub: vencidas.length ? `${vencidas.length} vencidas · ${reais(vencidas.reduce((s, c) => s + c.valor, 0))}` : "nada vencido", alerta: vencidas.length > 0, href: "/painel/cobrancas" },
        ].map((k) => (
          <Link key={k.r} href={k.href} className={`cartao block p-4 transition hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] ${k.r === "A receber" ? "max-lg:order-first max-lg:col-span-2" : ""} ${k.alerta ? "ring-2 ring-pimenta/40" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{k.r}</p>
            <p className="tabular mt-1 font-eggs text-2xl font-extrabold text-terra">{k.v}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              {k.d !== undefined && k.d !== null && <span className={`mr-1 font-semibold ${k.d >= 0 ? "text-folha" : "text-pimenta"}`}>{k.d >= 0 ? "▲" : "▼"} {pct(Math.abs(k.d))}</span>}
              {k.sub}
            </p>
          </Link>
        ))}
      </section>

      {/* Produtos */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-eggs text-xl font-extrabold text-terra">Produtos</h2>
          <Link href="/painel/precos" className="toque text-sm text-marca-700 hover:underline">Ajustar preços →</Link>
        </div>
        <div className="trilho gap-4 lg:grid lg:grid-cols-3 [&>*]:min-w-0">
          {produtos.map((p) => {
            const un = p.principal ? (UNIDADES[p.principal.unidade] ?? p.principal.unidade) : "";
            return (
              <article key={p.item.id} className="cartao relative overflow-hidden p-5">
                <span className={`absolute inset-x-0 top-0 h-1 ${categoriaDoItem(p.item.unidadeEstoque) === "Ovos" ? "bg-ouro" : "bg-[#7C9DD2]"}`} aria-hidden />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-eggs text-lg font-extrabold text-terra">{p.item.nome}</h3>
                    <p className="text-xs text-stone-500">{p.principal?.embalagem}</p>
                  </div>
                  <Package className="size-5 shrink-0 text-noz/50" aria-hidden />
                </div>
                {p.liberado ? (
                  <>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <div><dt className="text-xs text-stone-500">Custo</dt><dd className="tabular text-lg font-bold">{p.custoUnit !== null ? reais(p.custoUnit) : "—"}<span className="text-xs font-normal text-stone-500">/{un}</span></dd></div>
                      <div><dt className="text-xs text-stone-500">Venda</dt><dd className="tabular text-lg font-bold">{reais(p.preco)}<span className="text-xs font-normal text-stone-500">/{un}</span></dd></div>
                    </dl>
                    <div className="mt-4 space-y-2">
                      {[["Markup", p.markup, 1], ["Margem", p.margem, 0.5]].map(([rotulo, valor, escala]) => (
                        <div key={rotulo as string}>
                          <p className="flex justify-between text-xs"><span className="text-stone-500">{rotulo as string}</span><span className="tabular font-semibold text-terra">{valor !== null ? pct(valor as number) : "sem custo lançado"}</span></p>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                            <span className="block h-full rounded-full bg-folha" style={{ width: `${Math.max(0, Math.min(1, ((valor as number) ?? 0) / (escala as number))) * 100}%` }} />
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 flex justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                      <span>No mês: <span className="tabular font-semibold text-terra">{reais(p.mes?.faturamento ?? 0)}</span></span>
                      <span>Estoque: <span className="tabular font-semibold text-terra">{num(Math.round(p.saldo * 10) / 10)} {UNIDADES[p.item.unidadeEstoque] ?? p.item.unidadeEstoque}</span></span>
                    </p>
                  </>
                ) : (
                  <div className="mt-4 rounded-xl bg-ouro/15 p-4 text-sm text-noz">
                    <p className="flex items-center gap-2 font-semibold text-terra"><TriangleAlert className="size-4" /> Falta o preço</p>
                    <p className="mt-1">Defina o preço de venda e lance a primeira compra pra ele aparecer no app e nos relatórios.</p>
                    <Link href="/painel/precos" className="mt-3 inline-flex items-center gap-1 font-semibold text-terra hover:underline">Definir preço <ArrowRight className="size-4" /></Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Fornecedores, despesas e clientes */}
      <section className="mt-8 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="cartao p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold text-terra">Fornecedores no mês</h2><Link href="/painel/fornecedores" className="toque text-xs text-marca-700 hover:underline">ver todos</Link></div>
          {mes.fornecedores.length ? (
            <ul className="mt-4 space-y-3 text-sm">
              {mes.fornecedores.slice(0, 5).map((fo) => (
                <li key={fo.nome}>
                  <p className="flex justify-between gap-2"><span className="truncate font-medium">{fo.nome}</span><span className="tabular">{reais(fo.valor)}</span></p>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden><span className="block h-full rounded-full bg-noz" style={{ width: `${fo.participacao * 100}%` }} /></span>
                  <p className="mt-0.5 text-xs text-stone-500">{cx(fo.caixas)}{fo.custoMedioCaixa !== null ? ` · ${reais(fo.custoMedioCaixa)}/cx` : ""}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-stone-500">Nenhuma compra lançada neste mês. Lance em Estoque → Compra.</p>}
        </div>
        <div className="cartao p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold text-terra">Despesas no mês</h2><Link href="/painel/despesas#lancar" className="toque text-xs text-marca-700 hover:underline">lançar</Link></div>
          <p className="tabular mt-3 font-eggs text-3xl font-extrabold text-terra">{reais(f.despesas)}</p>
          <p className="text-xs text-stone-500">+ {reais(f.veiculo)} da Fiorino (combustível, manutenção e fixos) · <Link href="/painel/veiculos" className="toque text-marca-700 hover:underline">ver</Link></p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {mes.despesas.porCategoria.slice(0, 4).map((c) => (
              <li key={c.categoria} className="flex justify-between gap-2"><span className="text-stone-600">{c.categoria}</span><span className="tabular font-medium">{reais(c.valor)}</span></li>
            ))}
          </ul>
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold text-terra">Quem compra</h2>
          <p className="text-xs text-stone-500">Faturamento do mês por tipo de cliente e por forma de pagamento</p>
          {[mes.porTipo, mes.porPagamento].map((grupos, n) => (
            <div key={n} className="mt-4">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                {grupos.map((g, i) => <span key={g.nome} style={{ width: `${(g.faturamento / (t.faturamento || 1)) * 100}%`, background: [COR_LUCRO, "#516029", "#FFBD52", "#673C33", "#7C9DD2", "#D14C19"][i % 6] }} />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
                {grupos.map((g, i) => (
                  <li key={g.nome} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ background: [COR_LUCRO, "#516029", "#FFBD52", "#673C33", "#7C9DD2", "#D14C19"][i % 6] }} aria-hidden />
                    {g.nome} {t.faturamento ? pct(g.faturamento / t.faturamento) : ""}
                  </li>
                ))}
                {grupos.length === 0 && <li>Nenhuma venda no mês.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos */}
      <section className="mt-8 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <div className="cartao p-5">
          <h2 className="font-semibold text-terra">Caixas: entrada × saída <span className="max-lg:hidden">(30 dias)</span></h2>
          <p className="mb-4 text-xs text-stone-500"><span className="lg:hidden">Últimos 14 dias. </span>Entrada = compras dos fornecedores. Saída = vendidas, em caixas equivalentes (bandeja de 30 = 1/12 cx)</p>
          <GraficoBarras dados={graficoCaixas} categoria="faixa" series={[{ chave: "entrou", rotulo: "Entrou (compras)", cor: COR_CUSTO }, { chave: "saiu", rotulo: "Saiu (vendas)", cor: COR_VENDA }]} />
        </div>
        <div className="cartao p-5">
          <h2 className="font-semibold text-terra">Valor da caixa (30 dias)</h2>
          <p className="mb-4 text-xs text-stone-500">Ovo branco: quanto custou cada caixa comprada × preço de venda da caixa</p>
          <GraficoLinhas dados={graficoPrecos} categoria="faixa" series={[{ chave: "venda", rotulo: "Venda (caixa branco)", cor: COR_VENDA }, { chave: "custo", rotulo: "Custo de compra (branco)", cor: COR_CUSTO }]} />
        </div>
      </section>

      {/* Operação rápida */}
      <section className="mt-8 grid gap-6 xl:grid-cols-[2fr_3fr] [&>*]:min-w-0">
        {/* no celular o lançamento fica no "+" da barra e em Estoque */}
        <div className="cartao p-5 max-lg:hidden">
          <h2 className="mb-3 font-semibold text-terra">Registrar compra, perda ou contagem</h2>
          <FormMovimento hoje={hoje} fornecedores={fornecedores} itens={itens.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidade: i.unidadeEstoque, categoria: categoriaDoItem(i.unidadeEstoque) }))} />
        </div>
        <div className="cartao p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-terra">Últimos movimentos do estoque</h2>
            <Link href="/painel/estoque" className="toque shrink-0 text-sm text-marca-700 hover:underline">Ver estoque</Link>
          </div>
          <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto text-sm max-lg:max-h-none max-lg:[&>li:nth-child(n+7)]:hidden">
            {movimentos.slice(0, 30).map((m) => (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{TIPOS_MOVIMENTO[m.tipo as TipoMovimento] ?? m.tipo}</span>
                  <span className="text-stone-500">
                    {" "}· {m.item.nome} · {formatarDataCurta(m.data)}
                    {m.fornecedor && ` · ${m.fornecedor}`}
                    {m.custoUnit !== null && ` · ${reais(m.custoUnit)}/${UNIDADES[m.item.unidadeEstoque] ?? m.item.unidadeEstoque}`}
                    {m.observacao && ` · ${m.observacao}`}
                  </span>
                </span>
                <span className="tabular shrink-0 font-semibold">{m.quantidade > 0 ? "+" : "−"}{num(Math.abs(Math.round(m.quantidade * 10) / 10))} {UNIDADES[m.item.unidadeEstoque] ?? ""}</span>
              </li>
            ))}
            {movimentos.length === 0 && <li className="py-6 text-center text-stone-500">Nada lançado nos últimos 30 dias.</li>}
          </ul>
        </div>
      </section>
    </>
  );
}
