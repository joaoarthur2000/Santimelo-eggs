import "server-only";
import { DIAS_SEMANA, type Periodo } from "./constantes";
import { pedidosNoPeriodo } from "./consultas";
import { diaDaSemana, diaISO, fimDoDia, formatarDia, inicioDoDia, somarDias } from "./datas";
import { db } from "./db";
import { custosMedios } from "./estoque";
import { nomeProduto } from "./formato";

// Relatório de vendas de ovos (pela data de entrega, pedidos não cancelados).
// Custo de um item vendido = caixas equivalentes × custo médio das compras até o fim do período.
// Venda de ovo sem nenhuma compra registrada fica em "sem custo": não entra no lucro, pra não inflar a margem.

type Faixa = { chave: string; rotulo: string; inicio: string; fim: string };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const curto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const diasEntre = (inicio: string, fim: string): Faixa[] => {
  const faixas: Faixa[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) faixas.push({ chave: d, rotulo: curto(d), inicio: d, fim: d });
  return faixas;
};

/** Início, fim, título, vizinhos e as faixas do gráfico do período que contém `dia` */
export function intervalo(periodo: Periodo, dia: string) {
  if (periodo === "semana") {
    const inicio = somarDias(dia, -((diaDaSemana(dia) + 6) % 7)); // segunda
    const fim = somarDias(inicio, 6);
    return { inicio, fim, titulo: `Semana de ${curto(inicio)} a ${curto(fim)}`, anterior: somarDias(inicio, -7), proximo: somarDias(inicio, 7), faixas: diasEntre(inicio, fim) };
  }
  if (periodo === "mes") {
    const ano = Number(dia.slice(0, 4));
    const mes = Number(dia.slice(5, 7));
    const inicio = `${dia.slice(0, 7)}-01`;
    const fim = somarDias(mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`, -1);
    return { inicio, fim, titulo: `${MESES[mes - 1]} de ${ano}`, anterior: somarDias(inicio, -1), proximo: somarDias(fim, 1), faixas: diasEntre(inicio, fim) };
  }
  // Dia: o gráfico mostra os 14 dias até ele, pra ter contexto
  return { inicio: dia, fim: dia, titulo: formatarDia(dia), anterior: somarDias(dia, -1), proximo: somarDias(dia, 1), faixas: diasEntre(somarDias(dia, -13), dia) };
}

/**
 * Período de comparação, do mesmo tamanho. O dia compara com o mesmo dia da semana passada
 * (segunda com segunda): a entrega depende do dia da semana, então "ontem" quase nunca é comparável.
 */
function periodoAnterior(periodo: Periodo, inicio: string) {
  if (periodo === "mes") {
    const fim = somarDias(inicio, -1);
    return { inicio: `${fim.slice(0, 7)}-01`, fim, rotulo: "mês passado" };
  }
  if (periodo === "semana") return { inicio: somarDias(inicio, -7), fim: somarDias(inicio, -1), rotulo: "semana passada" };
  const dia = somarDias(inicio, -7);
  const nome = DIAS_SEMANA[diaDaSemana(dia)].toLowerCase();
  return { inicio: dia, fim: dia, rotulo: `${nome} passad${nome === "sábado" || nome === "domingo" ? "o" : "a"} (${curto(dia)})` };
}

type Soma = { faturamento: number; custo: number; semCusto: number; caixas: number };
const zero = (): Soma => ({ faturamento: 0, custo: 0, semCusto: 0, caixas: 0 });
const lucroDe = (s: Soma) => s.faturamento - s.custo - s.semCusto;

export async function relatorioVendas(periodo: Periodo, dia: string) {
  const faixa = intervalo(periodo, dia);
  const ant = periodoAnterior(periodo, faixa.inicio);
  const comeco = [faixa.inicio, faixa.faixas[0].inicio, ant.inicio].sort()[0];
  const [pedidos, custo, custoAnterior, compras] = await Promise.all([
    pedidosNoPeriodo(comeco, faixa.fim),
    custosMedios(fimDoDia(faixa.fim)),
    custosMedios(fimDoDia(ant.fim)),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: { gte: inicioDoDia(faixa.inicio), lt: fimDoDia(faixa.fim) } } }),
  ]);

  const total = zero();
  const anterior = zero();
  const porFaixa = new Map(faixa.faixas.map((f) => [f.chave, zero()]));
  const porProduto = new Map<string, Soma & { nome: string; codigo: string | null; ordem: number; unidade: string; quantidade: number; custoUnit: number | null }>();
  const porCliente = new Map<string, Soma & { nome: string; pedidos: number }>();
  const idsPeriodo = new Set<number>();
  const idsAnterior = new Set<number>();

  for (const p of pedidos) {
    const d = diaISO(p.dataEntrega);
    const f = faixa.faixas.find((x) => d >= x.inicio && d <= x.fim);
    const noPeriodo = d >= faixa.inicio && d <= faixa.fim;
    const noAnterior = d >= ant.inicio && d <= ant.fim;
    if (noPeriodo) idsPeriodo.add(p.id);
    if (noAnterior) idsAnterior.add(p.id);

    for (const i of p.itens) {
      const caixas = i.quantidade * (i.produto.fatorEstoque ?? 0);
      const somar = (s: Soma, tabela: Map<string, number>) => {
        const c = tabela.get(i.produto.itemId);
        s.faturamento += i.subtotal;
        s.caixas += caixas;
        if (c === undefined || !i.produto.fatorEstoque) s.semCusto += i.subtotal;
        else s.custo += caixas * c;
      };
      if (f) somar(porFaixa.get(f.chave)!, custo);
      if (noAnterior) somar(anterior, custoAnterior);
      if (!noPeriodo) continue;
      somar(total, custo);

      const c = custo.get(i.produto.itemId);
      const prod = porProduto.get(i.produtoId) ?? {
        ...zero(),
        nome: nomeProduto(i.produto),
        codigo: i.produto.item.codigo,
        ordem: i.produto.item.ordem,
        unidade: i.produto.unidade,
        quantidade: 0,
        custoUnit: c !== undefined && i.produto.fatorEstoque ? c * i.produto.fatorEstoque : null,
      };
      prod.quantidade += i.quantidade;
      somar(prod, custo);
      porProduto.set(i.produtoId, prod);

      const cli = porCliente.get(p.clienteId) ?? { ...zero(), nome: p.cliente.nomeFantasia, pedidos: 0 };
      somar(cli, custo);
      porCliente.set(p.clienteId, cli);
    }
    const cli = porCliente.get(p.clienteId);
    if (noPeriodo && cli) cli.pedidos += 1;
  }

  const comLucro = <T extends Soma>(s: T) => ({ ...s, lucro: lucroDe(s), margem: s.faturamento - s.semCusto > 0 ? lucroDe(s) / (s.faturamento - s.semCusto) : null });
  const caixasCompradas = compras.reduce((s, m) => s + m.quantidade, 0);

  return {
    ...faixa,
    anteriorRotulo: ant.rotulo,
    total: { ...comLucro(total), pedidos: idsPeriodo.size, clientes: porCliente.size },
    antes: { ...comLucro(anterior), pedidos: idsAnterior.size },
    compras: { caixas: caixasCompradas, valor: compras.reduce((s, m) => s + m.quantidade * (m.custoUnit ?? 0), 0) },
    porFaixa: faixa.faixas.map((f) => {
      const s = porFaixa.get(f.chave)!;
      return { faixa: f.rotulo, faturamento: Math.round(s.faturamento), custo: Math.round(s.custo), lucro: Math.round(lucroDe(s)), semCusto: Math.round(s.semCusto) };
    }),
    porProduto: [...porProduto.values()].map(comLucro).sort((a, b) => a.ordem - b.ordem || b.faturamento - a.faturamento),
    porCliente: [...porCliente.values()].map(comLucro).sort((a, b) => b.faturamento - a.faturamento),
  };
}

export type RelatorioVendas = Awaited<ReturnType<typeof relatorioVendas>>;
