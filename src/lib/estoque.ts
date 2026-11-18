import "server-only";
import { db } from "./db";

// Estoque = soma do extrato (MovimentoEstoque) por tipo de ovo, em caixas.
// Entradas: COMPRA e AJUSTE positivo. Saídas: VENDA (pedido saiu pra entrega), PERDA e AJUSTE negativo.

/** Pedido nesses status já saiu do estoque */
export const STATUS_QUE_BAIXA = ["ENTREGA", "ENTREGUE"];

/** Saldo de cada item até a data (inclusive) */
export async function saldos(ate: Date) {
  const grupos = await db.movimentoEstoque.groupBy({ by: ["itemId"], where: { data: { lt: ate } }, _sum: { quantidade: true } });
  return new Map(grupos.map((g) => [g.itemId, g._sum.quantidade ?? 0]));
}

/** Custo médio ponderado de cada tipo de ovo (R$ por caixa), com as compras até a data */
export async function custosMedios(ate: Date) {
  const compras = await db.movimentoEstoque.findMany({ where: { tipo: "COMPRA", data: { lt: ate }, custoUnit: { not: null } }, select: { itemId: true, quantidade: true, custoUnit: true } });
  const soma = new Map<string, { qtd: number; valor: number }>();
  for (const c of compras) {
    const s = soma.get(c.itemId) ?? { qtd: 0, valor: 0 };
    s.qtd += c.quantidade;
    s.valor += c.quantidade * c.custoUnit!;
    soma.set(c.itemId, s);
  }
  return new Map([...soma].filter(([, s]) => s.qtd > 0).map(([id, s]) => [id, s.valor / s.qtd]));
}

/**
 * Deixa o extrato do pedido de acordo com o status: saiu pra entrega → baixa as caixas;
 * voltou, foi cancelado ou ainda não saiu → desfaz a baixa. Pode chamar quantas vezes quiser.
 */
export async function sincronizarBaixaDoPedido(pedidoId: number, autor: string) {
  const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { include: { produto: true, fornecedor: true } } } });
  await db.movimentoEstoque.deleteMany({ where: { pedidoId, tipo: "VENDA" } });
  if (!STATUS_QUE_BAIXA.includes(pedido.status)) return;
  // Entregou antes do dia marcado (ex.: pedido pra amanhã entregue hoje)? A caixa saiu agora.
  // Pedido antigo lançado depois: vale o dia da entrega. Nunca fica com data no futuro.
  const agora = new Date();
  const quando = pedido.dataEntrega > agora ? agora : pedido.dataEntrega;
  // a baixa sai do fornecedor de cada item: estoque e rastreio por fornecedor
  const grupos = new Map<string, { itemId: string; fornecedorId: string | null; fornecedor: string | null; qtd: number }>();
  for (const i of pedido.itens) {
    if (!i.produto.fatorEstoque) continue;
    const chave = `${i.produto.itemId}|${i.fornecedorId ?? ""}`;
    const g = grupos.get(chave) ?? { itemId: i.produto.itemId, fornecedorId: i.fornecedorId, fornecedor: i.fornecedor?.nome ?? null, qtd: 0 };
    g.qtd += i.quantidade * i.produto.fatorEstoque;
    grupos.set(chave, g);
  }
  await db.movimentoEstoque.createMany({
    data: [...grupos.values()].map((g) => ({
      itemId: g.itemId,
      fornecedorId: g.fornecedorId,
      fornecedor: g.fornecedor,
      tipo: "VENDA",
      quantidade: -g.qtd,
      pedidoId,
      autor,
      data: quando,
      observacao: `Pedido #${pedidoId}`,
    })),
  });
}

/**
 * Por fornecedor e tipo de ovo (chave "fornecedorId|itemId"): caixas em estoque (comprado − vendido)
 * e custo médio da caixa nas compras dele.
 */
export async function estoquePorFornecedor() {
  const movimentos = await db.movimentoEstoque.findMany({
    where: { fornecedorId: { not: null } },
    select: { fornecedorId: true, itemId: true, tipo: true, quantidade: true, custoUnit: true },
  });
  const soma = new Map<string, { saldo: number; comprado: number; valor: number }>();
  for (const m of movimentos) {
    const chave = `${m.fornecedorId}|${m.itemId}`;
    const s = soma.get(chave) ?? { saldo: 0, comprado: 0, valor: 0 };
    s.saldo += m.quantidade;
    if (m.tipo === "COMPRA" && m.custoUnit !== null) {
      s.comprado += m.quantidade;
      s.valor += m.quantidade * m.custoUnit;
    }
    soma.set(chave, s);
  }
  return new Map([...soma].map(([chave, s]) => [chave, { saldo: s.saldo, custo: s.comprado > 0 ? s.valor / s.comprado : null }]));
}
