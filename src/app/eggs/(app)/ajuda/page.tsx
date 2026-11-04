import type { Metadata } from "next";
import { CONFIG, lerConfig } from "@/lib/config";
import { diaISO, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { nomeDoCliente } from "@/lib/eggs";
import { reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { ChatGuinho, type PedidoChat } from "./chat";

export const metadata: Metadata = { title: "Ajuda" };

export default async function AjudaEggs() {
  const { cliente } = await exigirCliente();
  const hoje = diaISO();
  const [proximos, entregues, numero, conversas] = await Promise.all([
    db.pedido.findMany({
      where: { clienteId: cliente.id, status: { notIn: ["ENTREGUE", "CANCELADO"] }, dataEntrega: { gte: inicioDoDia(somarDias(hoje, -2)) } },
      orderBy: { dataEntrega: "asc" },
      take: 5,
    }),
    db.pedido.findMany({
      where: { clienteId: cliente.id, status: "ENTREGUE", dataEntrega: { gte: inicioDoDia(somarDias(hoje, -21)) } },
      orderBy: { dataEntrega: "desc" },
      take: 5,
    }),
    lerConfig(CONFIG.WHATSAPP_ATENDIMENTO),
    db.atendimento.findMany({
      where: { clienteId: cliente.id, OR: [{ status: { not: "RESOLVIDO" } }, { resolvidoEm: { gte: inicioDoDia(somarDias(hoje, -7)) } }] },
      include: { _count: { select: { conversa: { where: { de: "EQUIPE", lidaEm: null } } } } },
      orderBy: { criadoEm: "desc" },
      take: 5,
    }),
  ]);
  const resumo = (p: (typeof proximos)[number]): PedidoChat => ({
    id: p.id,
    rotulo: `#${p.id} · ${formatarDia(diaISO(p.dataEntrega), { weekday: "short", day: "2-digit", month: "2-digit" })} · ${reais(p.total)}`,
  });

  return (
    <ChatGuinho
      nome={nomeDoCliente(cliente)}
      estabelecimento={cliente.nomeFantasia}
      responsavel={cliente.responsavel ?? cliente.nomeFantasia}
      whatsappCliente={cliente.whatsapp}
      whatsappSantimelo={numero?.replace(/\D/g, "") || null}
      pedidos={{ proximos: proximos.map(resumo), entregues: entregues.map(resumo) }}
      conversas={conversas.map((c) => ({ id: c.id, motivo: c.motivo, status: c.status, novas: c._count.conversa }))}
    />
  );
}
