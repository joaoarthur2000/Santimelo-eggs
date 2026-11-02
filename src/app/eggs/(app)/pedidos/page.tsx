import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaISO, formatarDia, formatarHora } from "@/lib/datas";
import { db } from "@/lib/db";
import { nomeProduto, quantidade, reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { cancelarPedido } from "../actions";
import { TituloEggs } from "../../guinho";
import { PedidoFeito } from "./pedido-feito";

export const metadata: Metadata = { title: "Meus pedidos" };

const COR_STATUS: Record<string, string> = {
  NOVO: "bg-gema-100 text-casca-900",
  SEPARACAO: "bg-amber-100 text-amber-900",
  ENTREGA: "bg-sky-100 text-sky-900",
  ENTREGUE: "bg-green-100 text-green-900",
  CANCELADO: "bg-casca-100 text-casca-500",
};

export default async function PedidosEggs({ searchParams }: PageProps<"/eggs/pedidos">) {
  const { cliente } = await exigirCliente();
  const { novo } = await searchParams;
  const pedidos = await db.pedido.findMany({
    where: { clienteId: cliente.id },
    include: { itens: { include: { produto: { include: { item: true } } } }, janela: true, cobranca: true },
    orderBy: { dataEntrega: "desc" },
    take: 40,
  });

  const feito = typeof novo === "string" ? pedidos.find((p) => String(p.id) === novo) : undefined;

  return (
    <>
      <TituloEggs pose="paz">Meus pedidos</TituloEggs>
      {feito && <PedidoFeito pedido={feito} />}
      <ul className="mt-5 space-y-3">
        {pedidos.map((p, n) => (
          <li key={p.id} className="eggs-entra nota-fiscal bg-white px-5" style={{ "--i": Math.min(n, 6) } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-eggs text-xl font-extrabold first-letter:uppercase">{formatarDia(diaISO(p.dataEntrega), { weekday: "long", day: "2-digit", month: "2-digit" })}</p>
                <p className="text-sm text-casca-700">
                  {p.janela ? `${p.janela.inicio} – ${p.janela.fim}` : formatarHora(p.dataEntrega)} · Pedido #{p.id}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${COR_STATUS[p.status] ?? "bg-casca-100"}`}>{STATUS_PEDIDO[p.status as StatusPedido]}</span>
            </div>
            <ul className="mt-3 space-y-1 border-t-2 border-dashed border-casca-100 pt-3 font-mono text-[13px]">
              {p.itens.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    <span className="tabular font-semibold">{quantidade(i.quantidade, i.produto.unidade)}</span> {nomeProduto(i.produto)}
                  </span>
                  <span className="tabular text-casca-700">{reais(i.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-casca-100 pt-3">
              <span>
                <span className="tabular font-eggs text-xl font-extrabold">{reais(p.total)}</span>
                {p.cobranca && (
                  <span className={`ml-2 text-xs font-semibold ${p.cobranca.pagoEm ? "text-green-700" : "text-casca-500"}`}>
                    {p.cobranca.pagoEm ? "pago" : `vence ${formatarDia(p.cobranca.vencimento, { day: "2-digit", month: "2-digit" })}`}
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                {p.status === "NOVO" && (
                  <form action={cancelarPedido.bind(null, p.id)}>
                    <button className="rounded-2xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Cancelar</button>
                  </form>
                )}
                <Link href={`/eggs/pedir?repetir=${p.id}`} className="botao-eggs-claro">
                  <RotateCcw className="size-4" /> Repetir
                </Link>
              </span>
            </div>
          </li>
        ))}
        {pedidos.length === 0 && (
          <li className="cartao-eggs text-center text-casca-700">
            Nenhum pedido ainda. <Link href="/eggs/pedir" className="font-bold underline">Fazer o primeiro</Link>
          </li>
        )}
      </ul>
    </>
  );
}
