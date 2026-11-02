import type { Metadata } from "next";
import { Cabecalho } from "@/components/ui";
import { db } from "@/lib/db";
import { diaISO, diaValido, somarDias } from "@/lib/datas";
import { FormPedido } from "./form-pedido";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NovoPedido({ searchParams }: PageProps<"/painel/pedidos/novo">) {
  const { dia: diaParam } = await searchParams;
  const dia = diaParam ? diaValido(diaParam) : somarDias(diaISO(), 1);

  const [produtos, clientes] = await Promise.all([
    db.produto.findMany({ where: { ativo: true, item: { ativo: true } }, include: { item: true }, orderBy: [{ item: { ordem: "asc" } }, { preco: "desc" }] }),
    db.cliente.findMany({
      where: { ativo: true },
      orderBy: { nomeFantasia: "asc" },
      include: { precosEspeciais: true, pedidos: { where: { status: { not: "CANCELADO" } }, orderBy: { dataEntrega: "desc" }, take: 1, include: { itens: true } } },
    }),
  ]);

  return (
    <>
      <Cabecalho titulo="Novo pedido" subtitulo="Lançamento manual (ex: pedido que chegou pelo WhatsApp). Os pedidos do app entram sozinhos." />
      <FormPedido
        diaInicial={dia}
        produtos={produtos.map((p) => ({ id: p.id, item: p.item.nome, codigo: p.item.codigo, embalagem: p.embalagem, unidade: p.unidade, preco: p.preco }))}
        clientes={clientes.map((c) => ({
          id: c.id,
          nome: c.nomeFantasia,
          precos: Object.fromEntries(c.precosEspeciais.map((e) => [e.produtoId, e.preco])),
          ultimoPedido: c.pedidos[0]?.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) ?? [],
        }))}
      />
    </>
  );
}
