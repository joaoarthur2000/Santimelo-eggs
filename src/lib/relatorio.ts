import "server-only";
import { CONDICOES_DO_PEDIDO, pagamentoDoPedido } from "./pagamento";
import { DIAS_SEMANA, ehOvo, type Periodo } from "./constantes";
import { pedidosNoPeriodo } from "./consultas";
import { diaDaSemana, diaISO, fimDoDia, formatarDia, inicioDoDia, somarDias } from "./datas";
import { db } from "./db";
import { custosMedios } from "./estoque";
import { nomeProduto } from "./formato";
import { custoDaRota } from "./rota";
import { custoVeiculo } from "./veiculo";

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
  const [pedidos, custo, custoAnterior, compras, recebidas, emAberto, rotas, atendimentos] = await Promise.all([
    pedidosNoPeriodo(comeco, faixa.fim),
    custosMedios(fimDoDia(faixa.fim)),
    custosMedios(fimDoDia(ant.fim)),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: { gte: inicioDoDia(faixa.inicio), lt: fimDoDia(faixa.fim) } } }),
    // Fechamento: dinheiro que entrou, o que falta receber (hoje), combustível e atendimentos do período
    db.cobranca.findMany({ where: { pagoEm: { gte: inicioDoDia(faixa.inicio), lt: fimDoDia(faixa.fim) } } }),
    db.cobranca.findMany({ where: { pagoEm: null } }),
    db.rotaDia.findMany({ where: { dia: { gte: faixa.inicio, lte: faixa.fim } }, orderBy: { dia: "asc" } }),
    db.atendimento.findMany({ where: { criadoEm: { gte: inicioDoDia(faixa.inicio), lt: fimDoDia(faixa.fim) } }, select: { setor: true, status: true } }),
  ]);
  // Despesas da operação (fora mercadoria e combustível) e compras por fornecedor
  const [despesas, comprasDetalhe, veiculo] = await Promise.all([
    db.despesa.findMany({ where: { dia: { gte: ant.inicio < faixa.inicio ? ant.inicio : faixa.inicio, lte: faixa.fim } }, orderBy: { dia: "desc" } }),
    db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: { gte: inicioDoDia(faixa.inicio), lt: fimDoDia(faixa.fim) } }, include: { fornecedorCad: true, item: true } }),
    // veículo: combustível + manutenção por km + fixos rateados (ver src/lib/veiculo.ts)
    custoVeiculo(faixa.inicio, faixa.fim),
  ]);

  const total = zero();
  const anterior = zero();
  const porFaixa = new Map(faixa.faixas.map((f) => [f.chave, zero()]));
  const porProduto = new Map<string, Soma & { nome: string; codigo: string | null; ordem: number; unidade: string; quantidade: number; custoUnit: number | null }>();
  const porCliente = new Map<string, Soma & { nome: string; tipo: string; notaFiscal: boolean; pedidos: number }>();
  // Recortes: tipo de negócio, com/sem NF, à vista/a prazo
  type Grupo = Soma & { nome: string; pedidos: number };
  const porTipo = new Map<string, Grupo>();
  const porNota = new Map<string, Grupo>();
  const porCondicao = new Map<string, Grupo>();
  const porPagamento = new Map<string, Grupo>();
  const grupo = (mapa: Map<string, Grupo>, nome: string) => {
    const g = mapa.get(nome) ?? { ...zero(), nome, pedidos: 0 };
    mapa.set(nome, g);
    return g;
  };
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
      // unidades de estoque consumidas (caixa de ovo ou pacote de camarão); "caixas" conta só ovo
      const estoque = i.quantidade * (i.produto.fatorEstoque ?? 0);
      const caixas = ehOvo(i.produto.item.unidadeEstoque) ? estoque : 0;
      const somar = (s: Soma, tabela: Map<string, number>) => {
        const c = tabela.get(i.produto.itemId);
        s.faturamento += i.subtotal;
        s.caixas += caixas;
        if (c === undefined || !i.produto.fatorEstoque) s.semCusto += i.subtotal;
        else s.custo += estoque * c;
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

      const cli = porCliente.get(p.clienteId) ?? { ...zero(), nome: p.cliente.nomeFantasia, tipo: p.cliente.tipoNegocio, notaFiscal: p.cliente.notaFiscal, pedidos: 0 };
      somar(cli, custo);
      porCliente.set(p.clienteId, cli);
      somar(grupo(porTipo, p.cliente.tipoNegocio), custo);
      somar(grupo(porNota, p.notaFiscal ? "Com NF" : "Sem NF"), custo);
      somar(grupo(porCondicao, CONDICOES_DO_PEDIDO[pagamentoDoPedido(p, p.cliente).condicao]), custo);
      somar(grupo(porPagamento, pagamentoDoPedido(p, p.cliente).forma ?? "Não informado"), custo);
    }
    const cli = porCliente.get(p.clienteId);
    if (noPeriodo && cli) {
      cli.pedidos += 1;
      grupo(porTipo, p.cliente.tipoNegocio).pedidos += 1;
      grupo(porNota, p.notaFiscal ? "Com NF" : "Sem NF").pedidos += 1;
      grupo(porCondicao, CONDICOES_DO_PEDIDO[pagamentoDoPedido(p, p.cliente).condicao]).pedidos += 1;
      grupo(porPagamento, pagamentoDoPedido(p, p.cliente).forma ?? "Não informado").pedidos += 1;
    }
  }

  // Entregas = paradas (cliente por dia), pedidos não cancelados do período
  const paradas = new Map<string, { dia: string; caixas: number }>();
  for (const p of pedidos) {
    const d = diaISO(p.dataEntrega);
    if (d < faixa.inicio || d > faixa.fim) continue;
    const k = `${d}|${p.clienteId}`;
    const x = paradas.get(k) ?? { dia: d, caixas: 0 };
    x.caixas += p.itens.reduce((t, i) => t + i.quantidade * (i.produto.fatorEstoque ?? 0), 0);
    paradas.set(k, x);
  }
  const logistica = rotas.map((rt) => {
    const c = custoDaRota(rt);
    const doDia = [...paradas.values()].filter((x) => x.dia === rt.dia);
    return { dia: rt.dia, entregas: doDia.length, caixas: doDia.reduce((t, x) => t + x.caixas, 0), ...c };
  });
  const combustivel = logistica.reduce((t, l) => t + l.custo, 0);

  // margem = lucro ÷ venda; markup = lucro ÷ custo (quanto se põe em cima do custo)
  const comLucro = <T extends Soma>(s: T) => ({
    ...s,
    lucro: lucroDe(s),
    margem: s.faturamento - s.semCusto > 0 ? lucroDe(s) / (s.faturamento - s.semCusto) : null,
    markup: s.custo > 0 ? lucroDe(s) / s.custo : null,
  });
  const caixasCompradas = compras.filter((m) => ehOvo(comprasDetalhe.find((d) => d.id === m.id)?.item.unidadeEstoque ?? "caixa")).reduce((s, m) => s + m.quantidade, 0);

  // Despesas: as do período e as do período de comparação
  const despesasPeriodo = despesas.filter((d) => d.dia >= faixa.inicio && d.dia <= faixa.fim);
  const despesasAnterior = despesas.filter((d) => d.dia >= ant.inicio && d.dia <= ant.fim).reduce((t, d) => t + d.valor, 0);
  const totalDespesas = despesasPeriodo.reduce((t, d) => t + d.valor, 0);
  const porCategoria = new Map<string, number>();
  for (const d of despesasPeriodo) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + d.valor);

  // Compras por fornecedor (as antigas, sem cadastro, aparecem pela origem)
  const porFornecedor = new Map<string, { nome: string; valor: number; valorOvos: number; caixas: number; pacotes: number; compras: number }>();
  for (const m of comprasDetalhe) {
    const nome = m.fornecedorCad?.nome ?? m.fornecedor ?? (m.origem === "CEASA" ? "CEASA (antes do cadastro)" : "Granja (antes do cadastro)");
    const f = porFornecedor.get(nome) ?? { nome, valor: 0, valorOvos: 0, caixas: 0, pacotes: 0, compras: 0 };
    const valor = m.quantidade * (m.custoUnit ?? 0);
    f.valor += valor;
    if (ehOvo(m.item.unidadeEstoque)) { f.caixas += m.quantidade; f.valorOvos += valor; } else f.pacotes += m.quantidade;
    f.compras += 1;
    porFornecedor.set(nome, f);
  }
  const valorComprado = [...porFornecedor.values()].reduce((t, f) => t + f.valor, 0);

  return {
    ...faixa,
    anteriorRotulo: ant.rotulo,
    total: { ...comLucro(total), pedidos: idsPeriodo.size, clientes: porCliente.size },
    antes: { ...comLucro(anterior), pedidos: idsAnterior.size },
    compras: { caixas: caixasCompradas, valor: compras.reduce((s, m) => s + m.quantidade * (m.custoUnit ?? 0), 0) },
    porFaixa: faixa.faixas.map((f) => {
      const s = porFaixa.get(f.chave)!;
      return { dia: f.chave, faixa: f.rotulo, faturamento: Math.round(s.faturamento), custo: Math.round(s.custo), lucro: Math.round(lucroDe(s)), semCusto: Math.round(s.semCusto) };
    }),
    porProduto: [...porProduto.values()].map(comLucro).sort((a, b) => a.ordem - b.ordem || b.faturamento - a.faturamento),
    porCliente: [...porCliente.values()].map(comLucro).sort((a, b) => b.faturamento - a.faturamento),
    fechamento: {
      recebido: recebidas.reduce((t, c) => t + c.valor, 0),
      recebimentos: recebidas.length,
      aReceber: emAberto.reduce((t, c) => t + c.valor, 0),
      vencido: emAberto.filter((c) => c.vencimento < diaISO()).reduce((t, c) => t + c.valor, 0),
      entregas: paradas.size,
      diasSemRota: new Set([...paradas.values()].map((x) => x.dia).filter((d) => !rotas.some((rt) => rt.dia === d))).size,
      km: logistica.reduce((t, l) => t + l.km, 0),
      litros: logistica.reduce((t, l) => t + l.litros, 0),
      combustivel,
      despesas: totalDespesas,
      veiculo: veiculo.total,
      veiculoManutencao: veiculo.manutencao,
      veiculoFixos: veiculo.fixos,
      lucroLiquido: lucroDe(total) - veiculo.total - totalDespesas,
      atendimentos: atendimentos.length,
      atendimentosAbertos: atendimentos.filter((x) => x.status !== "RESOLVIDO").length,
    },
    logistica,
    porTipo: [...porTipo.values()].map(comLucro).sort((a, b) => b.faturamento - a.faturamento),
    porNota: [...porNota.values()].map(comLucro).sort((a, b) => a.nome.localeCompare(b.nome)),
    porCondicao: [...porCondicao.values()].map(comLucro).sort((a, b) => b.nome.localeCompare(a.nome)),
    porPagamento: [...porPagamento.values()].map(comLucro).sort((a, b) => b.faturamento - a.faturamento),
    despesas: {
      total: totalDespesas,
      anterior: despesasAnterior,
      porCategoria: [...porCategoria].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
      lista: despesasPeriodo,
    },
    fornecedores: [...porFornecedor.values()]
      .map((f) => ({ ...f, custoMedioCaixa: f.caixas > 0 ? f.valorOvos / f.caixas : null, participacao: valorComprado > 0 ? f.valor / valorComprado : 0 }))
      .sort((a, b) => b.valor - a.valor),
  };
}

export type RelatorioVendas = Awaited<ReturnType<typeof relatorioVendas>>;
