import type { Metadata } from "next";
import { db } from "@/lib/db";
import { agendaDaRegiao, produtosDoCliente } from "@/lib/eggs";
import { exigirCliente } from "@/lib/sessao";
import { FormPedido } from "./form-pedido";
import { TituloEggs } from "../../guinho";

export const metadata: Metadata = { title: "Fazer pedido" };

export default async function Pedir({ searchParams }: PageProps<"/eggs/pedir">) {
  const { cliente } = await exigirCliente();
  const { repetir } = await searchParams;
  const [produtos, agenda, anterior] = await Promise.all([
    produtosDoCliente(cliente.id),
    agendaDaRegiao(cliente.regiaoId),
    // "Repetir": o pedido escolhido, ou o último
    db.pedido.findFirst({
      where: { clienteId: cliente.id, status: { not: "CANCELADO" }, ...(typeof repetir === "string" && /^\d+$/.test(repetir) ? { id: Number(repetir) } : {}) },
      include: { itens: true },
      orderBy: { dataEntrega: "desc" },
    }),
  ]);

  return (
    <>
      <TituloEggs pose="joinha">Fazer pedido</TituloEggs>
      <p className="mt-1 text-sm text-casca-700">
        Preços já com tudo incluso{cliente.regiao ? ` · entrega na região ${cliente.regiao.nome}` : ""}.
      </p>
      {!cliente.regiaoId ? (
        <p className="cartao-eggs mt-5 text-casca-700">Sua região de entrega ainda não foi definida. Fale com a Santimelo pra liberar os pedidos pelo app.</p>
      ) : (
        <FormPedido
          produtos={produtos.map((p) => ({ id: p.id, item: p.item, codigo: p.codigo, embalagem: p.embalagem, unidade: p.unidade, preco: p.preco, negociado: p.negociado }))}
          agenda={agenda}
          anterior={anterior?.itens.filter((i) => produtos.some((p) => p.id === i.produtoId)).map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) ?? []}
          repetindo={typeof repetir === "string"}
        />
      )}
    </>
  );
}
