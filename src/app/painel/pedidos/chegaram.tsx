import { Fragment } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { ORIGENS_PEDIDO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { diaISO, formatarDia } from "@/lib/datas";
import { quantidade, reais } from "@/lib/formato";
import { ExcluirPedido } from "./excluir-pedido";

// Pedidos que chegaram nas últimas 24 h, seja qual for o dia da entrega.
// A lista de Pedidos é por dia de entrega: sem isso, um pedido pra sexta feito hoje ficava escondido.

const JANELA_MS = 24 * 3600 * 1000;

export async function contarChegaram() {
  return db.pedido.count({ where: { criadoEm: { gte: new Date(Date.now() - JANELA_MS), lte: new Date() }, status: "NOVO" } });
}

const ha = (data: Date) => {
  const min = Math.max(0, Math.round((Date.now() - data.getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.round(min / 60)} h`;
};

async function buscarChegaram() {
  const pedidos = await db.pedido.findMany({
    where: { criadoEm: { gte: new Date(Date.now() - JANELA_MS), lte: new Date() }, status: { not: "CANCELADO" } },
    include: { cliente: true, janela: true, itens: { include: { produto: { include: { item: true } } } } },
  });
  return pedidos.sort(porDataDeEntrega).map((p) => ({ ...p, quando: ha(p.criadoEm) }));
}

/** Ordem das listas de pedidos: dia da entrega, depois horário, depois número (nunca pela ordem em que chegaram) */
export const porDataDeEntrega = (a: OrdemPedido, b: OrdemPedido) =>
  diaISO(a.dataEntrega).localeCompare(diaISO(b.dataEntrega)) || (a.janela?.inicio ?? "99").localeCompare(b.janela?.inicio ?? "99") || a.id - b.id;
type OrdemPedido = { id: number; dataEntrega: Date; janela: { inicio: string } | null };

export async function PedidosQueChegaram() {
  const pedidos = await buscarChegaram();
  if (pedidos.length === 0) return null;

  return (
    <section className="cartao mb-6 overflow-hidden border-ouro/50">
      <h2 className="flex items-center gap-2.5 border-b border-ouro/30 bg-ouro/15 px-5 py-3 text-sm font-semibold text-terra">
        <span className="grid size-7 place-items-center rounded-full bg-ouro text-terra">
          <BellRing className="size-3.5" />
        </span>
        {pedidos.length === 1 ? "1 pedido chegou" : `${pedidos.length} pedidos chegaram`} nas últimas 24 h
        <span className="pulso ml-auto inline-block size-2 rounded-full text-pimenta" aria-hidden>
          <span className="block size-2 rounded-full bg-pimenta" />
        </span>
      </h2>
      <ul className="divide-y divide-stone-100">
        {pedidos.map((p, n) => {
          const dia = diaISO(p.dataEntrega);
          const doDia = pedidos.filter((x) => diaISO(x.dataEntrega) === dia);
          return (
            <Fragment key={p.id}>
              {/* separador por dia de entrega */}
              {(n === 0 || diaISO(pedidos[n - 1].dataEntrega) !== dia) && (
                <li className="flex items-baseline gap-2 bg-stone-50/80 px-5 py-2 text-xs">
                  <b className="font-semibold text-marca-950 first-letter:uppercase">Entrega {formatarDia(dia, { weekday: "short", day: "2-digit", month: "2-digit" })}</b>
                  <span className="text-stone-500">
                    {doDia.length} {doDia.length === 1 ? "pedido" : "pedidos"} · {reais(doDia.reduce((t, x) => t + x.total, 0))}
                  </span>
                </li>
              )}
              <li className="flex items-center gap-2 transition-colors duration-150 hover:bg-ouro/[0.07] active:bg-ouro/10 lg:pr-4">
                <Link href={`/painel/pedidos/${p.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 py-3 pl-5 text-sm max-lg:pr-5">
                  <span className="tabular w-9 font-medium text-stone-400 max-lg:hidden">#{p.id}</span>
                  <span className="min-w-40 flex-1">
                    <b className="font-semibold text-marca-950">{p.cliente.nomeFantasia}</b>
                    <span className="block text-xs text-stone-500">
                      {p.itens.map((i) => `${quantidade(i.quantidade, i.produto.unidade)} ${i.produto.item.nome.replace(/^Ovo /, "")}`).join(" · ")}
                    </span>
                  </span>
                  {p.janela && <span className="tabular text-stone-600">{p.janela.inicio}–{p.janela.fim}</span>}
                  <span className="tabular w-24 text-right font-semibold">{reais(p.total)}</span>
                  <span className="w-44 text-right text-xs whitespace-nowrap text-stone-500 max-lg:w-full max-lg:text-left">
                    {ORIGENS_PEDIDO[p.origem as keyof typeof ORIGENS_PEDIDO] ?? p.origem} · {p.quando}
                    {p.status === "NOVO" && <span className="ml-1.5 rounded-full bg-terra px-2 py-0.5 text-[11px] font-semibold text-ouro">novo</span>}
                  </span>
                </Link>
                <span className="contents max-lg:[&>*]:hidden"><ExcluirPedido id={p.id} /></span>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </section>
  );
}
