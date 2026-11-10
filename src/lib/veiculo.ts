import "server-only";
import { ehOvo } from "./constantes";
import { pedidosNoPeriodo } from "./consultas";
import { diaISO, somarDias } from "./datas";
import { db } from "./db";
import { custoDaRota } from "./rota";

// Custo do veículo de entrega num período, por dia de entrega e por cliente.
// - Combustível: km do dia (rota calculada ou hodômetro) ÷ consumo × preço do litro (o mesmo das Rotas).
// - Manutenção e pneus: provisão por km rodado (valores no cadastro do veículo).
// - Fixos (IPVA, seguro, licenciamento...): valor anual ÷ 365, só pelos dias do período que já passaram.
// - Por cliente: o custo de cada dia de entrega é dividido igualmente entre as paradas do dia;
//   os fixos do período são espalhados pelas paradas na mesma proporção.
// Os gastos lançados (abastecimento, oficina, IPVA...) são o que saiu do caixa: aparecem ao lado da provisão
// pra comparar, mas não somam de novo no custo (senão o combustível contaria duas vezes).

const contarDias = (inicio: string, fim: string) => {
  let n = 0;
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) n++;
  return n;
};

export async function custoVeiculo(inicio: string, fim: string) {
  const hoje = diaISO();
  const ultimoDia = fim < hoje ? fim : hoje;
  const [veiculos, rotas, pedidos, gastos] = await Promise.all([
    db.veiculo.findMany({ where: { ativo: true }, orderBy: { criadoEm: "asc" } }),
    db.rotaDia.findMany({ where: { dia: { gte: inicio, lte: fim } }, orderBy: { dia: "asc" } }),
    pedidosNoPeriodo(inicio, fim),
    db.gastoVeiculo.findMany({ where: { dia: { gte: inicio, lte: fim } }, orderBy: [{ dia: "desc" }, { criadoEm: "desc" }] }),
  ]);
  const v = veiculos[0] ?? null;
  const porKmManutencao = v ? v.manutencaoPorKm + v.pneusPorKm : 0;
  const fixoAnual = veiculos.reduce((t, x) => t + x.ipvaAnual + x.seguroAnual + x.licenciamentoAnual + x.outrosFixosAnual, 0);
  const diasCorridos = ultimoDia >= inicio ? contarDias(inicio, ultimoDia) : 0;
  const fixos = (fixoAnual / 365) * diasCorridos;

  // Paradas: um cliente por dia (junta os pedidos dele)
  type Parada = { dia: string; clienteId: string; nome: string; tipo: string; caixas: number; venda: number };
  const paradas = new Map<string, Parada>();
  for (const p of pedidos) {
    const dia = diaISO(p.dataEntrega);
    const chave = `${dia}|${p.clienteId}`;
    const x = paradas.get(chave) ?? { dia, clienteId: p.clienteId, nome: p.cliente.nomeFantasia, tipo: p.cliente.tipoNegocio, caixas: 0, venda: 0 };
    x.caixas += p.itens.reduce((t, i) => t + (ehOvo(i.produto.item.unidadeEstoque) ? i.quantidade * (i.produto.fatorEstoque ?? 0) : 0), 0);
    x.venda += p.total;
    paradas.set(chave, x);
  }

  // Dias: com rota (km conhecido) ou só com entregas (sem km: avisa)
  type Dia = { dia: string; km: number; litros: number; combustivel: number; manutencao: number; fixos: number; total: number; paradas: number; caixas: number; temRota: boolean; kmReal: boolean };
  const dias = new Map<string, Dia>();
  for (const r of rotas) {
    const c = custoDaRota(r);
    dias.set(r.dia, { dia: r.dia, km: c.km, litros: c.litros, combustivel: c.custo, manutencao: c.km * porKmManutencao, fixos: 0, total: 0, paradas: 0, caixas: 0, temRota: true, kmReal: c.real });
  }
  for (const p of paradas.values()) {
    const d = dias.get(p.dia) ?? { dia: p.dia, km: 0, litros: 0, combustivel: 0, manutencao: 0, fixos: 0, total: 0, paradas: 0, caixas: 0, temRota: false, kmReal: false };
    d.paradas += 1;
    d.caixas += p.caixas;
    dias.set(p.dia, d);
  }
  const totalParadas = paradas.size;
  for (const d of dias.values()) {
    d.fixos = totalParadas ? fixos * (d.paradas / totalParadas) : 0;
    d.total = d.combustivel + d.manutencao + d.fixos;
  }

  // Por cliente: parte de cada dia de entrega
  const porCliente = new Map<string, { clienteId: string; nome: string; tipo: string; entregas: number; caixas: number; venda: number; custo: number }>();
  for (const p of paradas.values()) {
    const d = dias.get(p.dia)!;
    const parte = d.paradas ? d.total / d.paradas : 0;
    const c = porCliente.get(p.clienteId) ?? { clienteId: p.clienteId, nome: p.nome, tipo: p.tipo, entregas: 0, caixas: 0, venda: 0, custo: 0 };
    c.entregas += 1;
    c.caixas += p.caixas;
    c.venda += p.venda;
    c.custo += parte;
    porCliente.set(p.clienteId, c);
  }

  const lista = [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  const km = lista.reduce((t, d) => t + d.km, 0);
  const combustivel = lista.reduce((t, d) => t + d.combustivel, 0);
  const manutencao = lista.reduce((t, d) => t + d.manutencao, 0);
  const caixas = lista.reduce((t, d) => t + d.caixas, 0);
  const total = combustivel + manutencao + fixos;

  const porTipo = new Map<string, number>();
  for (const g of gastos) porTipo.set(g.tipo, (porTipo.get(g.tipo) ?? 0) + g.valor);

  return {
    veiculo: v,
    km,
    litros: lista.reduce((t, d) => t + d.litros, 0),
    combustivel,
    manutencao,
    fixos,
    total,
    entregas: totalParadas,
    caixas,
    diasCorridos,
    diasSemRota: lista.filter((d) => d.paradas > 0 && !d.temRota).length,
    custoPorEntrega: totalParadas ? total / totalParadas : null,
    custoPorCaixa: caixas ? total / caixas : null,
    custoPorKm: km ? total / km : null,
    // custo de 1 km rodado, pelos parâmetros do veículo (vale mesmo sem rota no período)
    kmParametro: v ? v.precoLitro / v.consumoKmL + porKmManutencao : null,
    fixoMensal: fixoAnual / 12,
    fixoDiario: fixoAnual / 365,
    porDia: lista,
    porCliente: [...porCliente.values()].map((c) => ({ ...c, porCaixa: c.caixas ? c.custo / c.caixas : null, pesoNaVenda: c.venda ? c.custo / c.venda : null })).sort((a, b) => b.custo - a.custo),
    gastos: { total: gastos.reduce((t, g) => t + g.valor, 0), porTipo: [...porTipo].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor), lista: gastos },
  };
}

export type CustoVeiculo = Awaited<ReturnType<typeof custoVeiculo>>;
