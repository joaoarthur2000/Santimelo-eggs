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
  const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { include: { produto: true } } } });
  await db.movimentoEstoque.deleteMany({ where: { pedidoId, tipo: "VENDA" } });
  if (!STATUS_QUE_BAIXA.includes(pedido.status)) return;
  const porItem = new Map<string, number>();
  for (const i of pedido.itens) {
    if (!i.produto.fatorEstoque) continue;
    porItem.set(i.produto.itemId, (porItem.get(i.produto.itemId) ?? 0) + i.quantidade * i.produto.fatorEstoque);
  }
  await db.movimentoEstoque.createMany({
    data: [...porItem].map(([itemId, qtd]) => ({ itemId, tipo: "VENDA", quantidade: -qtd, pedidoId, autor, data: pedido.dataEntrega, observacao: `Pedido #${pedidoId}` })),
  });
}
