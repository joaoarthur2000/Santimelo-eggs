import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { diaISO, formatarDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { FORMAS_DO_PEDIDO, pagamentoDoPedido } from "@/lib/pagamento";
import { exigirPapel } from "@/lib/sessao";
import { dadosDoFormPedido } from "../../dados-form";
import { FormPedido } from "../../novo/form-pedido";

export async function generateMetadata({ params }: PageProps<"/painel/pedidos/[id]/editar">) {
  return { title: `Editar pedido #${(await params).id}` };
}

export default async function EditarPedido({ params, searchParams }: PageProps<"/painel/pedidos/[id]/editar">) {
  await exigirPapel("DIRETOR");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const doDia = (await searchParams).voltar === "dia";
  const pedido = await db.pedido.findUnique({ where: { id }, include: { cliente: true, cobranca: true, itens: true } });
  if (!pedido) notFound();
  if (pedido.status === "CANCELADO") redirect(`/painel/pedidos/${id}`);

  const dia = diaISO(pedido.dataEntrega);
  const pag = pagamentoDoPedido(pedido, pedido.cliente);
  const produtos = pedido.itens.map((i) => i.produtoId);
  const voltar = doDia ? `/painel/dia?dia=${dia}` : `/painel/pedidos/${id}`;
  // o formulário tem uma linha por produto: com o mesmo produto duas vezes, salvar juntaria as duas
  const repetido = new Set(produtos).size < produtos.length;

  return (
    <>
      <Link data-voltar href={voltar} className="mb-3 hidden items-center gap-1 text-sm text-stone-500 hover:text-marca-700 lg:inline-flex">
        <ArrowLeft className="size-4" /> {doDia ? "Dia a dia" : `Pedido #${id}`}
      </Link>
      <Cabecalho titulo={`Editar pedido #${id}`} subtitulo={`${pedido.cliente.nomeFantasia} · entrega ${formatarDia(dia)}`} />
      {repetido ? (
        <p className="cartao p-5 text-stone-600">Esse pedido tem o mesmo produto em duas linhas e não dá pra editar por aqui. Exclua e lance de novo.</p>
      ) : (
        <FormPedido
          {...await dadosDoFormPedido({ produtos, cliente: pedido.clienteId, fornecedores: pedido.itens.flatMap((i) => i.fornecedorId ?? []) })}
          hoje={diaISO()}
          diaInicial={dia}
          voltarProDia={doDia}
          edicao={{
            id,
            clienteId: pedido.clienteId,
            origem: pedido.origem,
            observacao: pedido.observacao ?? "",
            entregue: pedido.status === "ENTREGUE",
            pago: pedido.cobranca?.pagoEm ? pedido.cobranca.valor : null,
            itens: pedido.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnit: i.precoUnit, fornecedorId: i.fornecedorId })),
            pagamento: {
              forma: FORMAS_DO_PEDIDO.find((f) => f === pag.forma) ?? "",
              condicao: pag.condicao,
              dias: pag.condicao === "PRAZO" ? null : 7,
              data: pag.condicao === "PRAZO" ? (pedido.cobranca?.vencimento ?? pedido.vencimento ?? "") : "",
            },
          }}
        />
      )}
    </>
  );
}
