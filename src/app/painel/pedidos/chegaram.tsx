import Link from "next/link";
import { BellRing } from "lucide-react";
import { ORIGENS_PEDIDO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { diaISO, formatarDia } from "@/lib/datas";
import { quantidade, reais } from "@/lib/formato";

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
    orderBy: { criadoEm: "desc" },
  });
  return pedidos.map((p) => ({ ...p, quando: ha(p.criadoEm) }));
}

export async function PedidosQueChegaram() {
  const pedidos = await buscarChegaram();
  if (pedidos.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-gema-50 ring-2 ring-gema-400">
      <h2 className="flex items-center gap-2 bg-gema-400 px-5 py-2.5 font-bold text-casca-900">
        <BellRing className="size-4" /> {pedidos.length === 1 ? "1 pedido chegou" : `${pedidos.length} pedidos chegaram`} nas últimas 24 h
      </h2>
      <ul className="divide-y divide-gema-200">
        {pedidos.map((p) => (
          <li key={p.id}>
            <Link href={`/painel/pedidos/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-gema-100">
              <span className="font-semibold text-marca-800">#{p.id}</span>
              <span className="min-w-40 flex-1">
                <b>{p.cliente.nomeFantasia}</b>
                <span className="block text-xs text-stone-600">
                  {p.itens.map((i) => `${quantidade(i.quantidade, i.produto.unidade)} ${i.produto.item.nome.replace(/^Ovo /, "")}`).join(" · ")}
                </span>
              </span>
              <span className="text-stone-700">
                entrega <b className="first-letter:uppercase">{formatarDia(diaISO(p.dataEntrega), { weekday: "short", day: "2-digit", month: "2-digit" })}</b>
                {p.janela && ` · ${p.janela.inicio}–${p.janela.fim}`}
              </span>
              <span className="tabular font-semibold">{reais(p.total)}</span>
              <span className="text-xs text-stone-500">
                {ORIGENS_PEDIDO[p.origem as keyof typeof ORIGENS_PEDIDO] ?? p.origem} · {p.quando}
                {p.status === "NOVO" && <span className="ml-1.5 rounded-full bg-casca-900 px-2 py-0.5 font-bold text-gema-50">novo</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
