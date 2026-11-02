import "server-only";
import { db } from "./db";
import { fimDoDia, inicioDoDia } from "./datas";

/** Pedidos não cancelados com entrega no período, com cliente e itens */
export async function pedidosNoPeriodo(inicio: string, fim: string) {
  return db.pedido.findMany({
    where: { dataEntrega: { gte: inicioDoDia(inicio), lt: fimDoDia(fim) }, status: { not: "CANCELADO" } },
    include: { cliente: true, itens: { include: { produto: { include: { item: true } } } } },
    orderBy: { dataEntrega: "asc" },
  });
}

/** Soma por produto dos pedidos (não cancelados): o que separar */
export function listaDeSeparacao(pedidos: { status: string; itens: { produtoId: string; quantidade: number; produto: { unidade: string; embalagem: string; item: { nome: string; codigo: string | null; ordem: number } } }[] }[]) {
  const linhas = new Map<string, { nome: string; codigo: string | null; ordem: number; unidade: string; qtd: number }>();
  for (const p of pedidos) {
    if (p.status === "CANCELADO") continue;
    for (const i of p.itens) {
      const atual = linhas.get(i.produtoId) ?? { nome: `${i.produto.item.nome} · ${i.produto.embalagem}`, codigo: i.produto.item.codigo, ordem: i.produto.item.ordem, unidade: i.produto.unidade, qtd: 0 };
      atual.qtd += i.quantidade;
      linhas.set(i.produtoId, atual);
    }
  }
  return [...linhas.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}
