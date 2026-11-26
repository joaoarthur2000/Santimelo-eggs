import "server-only";
import { db } from "@/lib/db";
import { estoquePorFornecedor } from "@/lib/estoque";

/** O que o formulário do pedido precisa (novo e editar). `incluir`: produtos, cliente e fornecedores já usados no pedido, mesmo desativados */
export async function dadosDoFormPedido(incluir: { produtos?: string[]; cliente?: string; fornecedores?: string[] } = {}) {
  const [produtos, clientes, fornecedores, porFornecedor] = await Promise.all([
    db.produto.findMany({
      where: { OR: [{ ativo: true, item: { ativo: true } }, { id: { in: incluir.produtos ?? [] } }] },
      include: { item: true },
      orderBy: [{ item: { ordem: "asc" } }, { preco: "desc" }],
    }),
    db.cliente.findMany({
      where: { OR: [{ ativo: true }, { id: incluir.cliente ?? "" }] },
      orderBy: { nomeFantasia: "asc" },
      include: { precosEspeciais: true, pedidos: { where: { status: { not: "CANCELADO" } }, orderBy: { dataEntrega: "desc" }, take: 1, include: { itens: true } } },
    }),
    db.fornecedor.findMany({ where: { OR: [{ ativo: true }, { id: { in: incluir.fornecedores ?? [] } }] }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    estoquePorFornecedor(),
  ]);
  return {
    produtos: produtos.map((p) => ({ id: p.id, itemId: p.itemId, item: p.item.nome, codigo: p.item.codigo, embalagem: p.embalagem, unidade: p.unidade, preco: p.preco, fator: p.fatorEstoque })),
    fornecedores,
    porFornecedor: Object.fromEntries(porFornecedor),
    clientes: clientes.map((c) => ({
      id: c.id,
      nome: c.nomeFantasia,
      forma: c.formaPagamento,
      prazo: c.prazoPagamentoDias,
      precos: Object.fromEntries(c.precosEspeciais.map((e) => [e.produtoId, e.preco])),
      ultimoPedido: c.pedidos[0]?.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) ?? [],
    })),
  };
}
