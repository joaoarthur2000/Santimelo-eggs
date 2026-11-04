import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Cabecalho, Etiqueta } from "@/components/ui";
import { condicaoPagamento, FLUXO_PEDIDO, ORIGENS_PEDIDO, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { db } from "@/lib/db";
import { diaISO, formatarDia, formatarHora, formatarDataCurta } from "@/lib/datas";
import { quantidade, reais } from "@/lib/formato";
import { avancarStatus, mudarStatus } from "../actions";
import { BotaoImprimir } from "./botao-imprimir";

export async function generateMetadata({ params }: PageProps<"/painel/pedidos/[id]">) {
  return { title: `Pedido #${(await params).id}` };
}

export default async function Pedido({ params }: PageProps<"/painel/pedidos/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const pedido = await db.pedido.findUnique({
    where: { id },
    include: {
      cliente: { include: { regiao: true } },
      janela: true,
      itens: { include: { produto: { include: { item: true } } } },
    },
  });
  if (!pedido) notFound();

  const status = pedido.status as StatusPedido;
  const proximo = FLUXO_PEDIDO[FLUXO_PEDIDO.indexOf(status) + 1];
  const itensOrdenados = [...pedido.itens].sort(
    (a, b) => a.produto.item.ordem - b.produto.item.ordem || b.precoUnit - a.precoUnit,
  );
  const c = pedido.cliente;

  return (
    <>
      <Link href={`/painel/pedidos?dia=${diaISO(pedido.dataEntrega)}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700 print:hidden">
        <ArrowLeft className="size-4" /> Pedidos do dia
      </Link>
      <Cabecalho
        titulo={`Pedido #${pedido.id} · ${c.nomeFantasia}`}
        subtitulo={`Entrega ${formatarDia(diaISO(pedido.dataEntrega))} · feito em ${formatarDataCurta(pedido.criadoEm)} às ${formatarHora(pedido.criadoEm)} via ${ORIGENS_PEDIDO[pedido.origem as keyof typeof ORIGENS_PEDIDO]}`}
      >
        <Etiqueta status={status}>{STATUS_PEDIDO[status]}</Etiqueta>
        <span className="print:hidden contents">
          {proximo && status !== "CANCELADO" && (
            <form action={avancarStatus.bind(null, pedido.id)}>
              <button className="botao-primario">Marcar “{STATUS_PEDIDO[proximo]}”</button>
            </form>
          )}
          {status !== "CANCELADO" && status !== "ENTREGUE" && (
            <form action={mudarStatus.bind(null, pedido.id, "CANCELADO")}>
              <button className="botao-secundario text-red-700">Cancelar</button>
            </form>
          )}
          {status === "CANCELADO" && (
            <form action={mudarStatus.bind(null, pedido.id, "NOVO")}>
              <button className="botao-secundario">Reabrir</button>
            </form>
          )}
          <BotaoImprimir />
        </span>
      </Cabecalho>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {itensOrdenados.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{i.produto.item.nome}</span>
                    <span className="block text-xs text-stone-500">
                      {i.produto.embalagem}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">{quantidade(i.quantidade, i.produto.unidade)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-stone-500">{reais(i.precoUnit)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{reais(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-stone-200 font-semibold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">Total · frete grátis</td>
                <td className="tabular px-4 py-3 text-right">{reais(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
          {pedido.observacao && <p className="border-t border-stone-100 px-4 py-3 text-sm"><strong>Obs:</strong> {pedido.observacao}</p>}
        </div>

        <aside className="cartao h-fit space-y-2 p-5 text-sm">
          <h2 className="font-semibold text-marca-950">Entrega</h2>
          <Linha rotulo="Cliente" valor={<Link href={`/painel/clientes/${c.id}`} className="text-marca-700 hover:underline">{c.nomeFantasia}</Link>} />
          <Linha rotulo="Endereço" valor={[c.endereco, c.bairro, c.cidade].filter(Boolean).join(" · ")} />
          <Linha rotulo="Região" valor={c.regiao?.nome} />
          <Linha rotulo="Horário" valor={pedido.janela ? `${pedido.janela.inicio}–${pedido.janela.fim}` : null} />
          <Linha rotulo="Responsável" valor={c.responsavel} />
          <Linha rotulo="WhatsApp" valor={c.whatsapp} />
          <Linha rotulo="Pagamento" valor={`${condicaoPagamento(c.prazoPagamentoDias)} · ${c.formaPagamento ?? "—"}`} />
          <Linha rotulo="Nota fiscal" valor={pedido.notaFiscal ? "Com NF" : "Sem NF"} />
        </aside>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (!valor) return null;
  return (
    <p className="flex justify-between gap-4">
      <span className="text-stone-500">{rotulo}</span>
      <span className="text-right">{valor}</span>
    </p>
  );
}
