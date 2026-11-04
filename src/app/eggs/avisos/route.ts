import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/sessao";

// Avisos pro app (consultado de tempo em tempo pelo avisador): etapas do pedido e respostas da equipe no chat.
// `desde` = até quando o celular já avisou; só volta o que chegou depois (no máximo 1 dia).
export async function GET(req: Request) {
  const usuario = await usuarioAtual();
  if (!usuario?.clienteId) return Response.json({ avisos: [] }, { status: 401 });
  const pedido = new URL(req.url).searchParams.get("desde");
  const limite = Date.now() - 24 * 3600 * 1000;
  const desde = new Date(Math.max(limite, pedido ? Date.parse(pedido) || limite : limite));

  const [etapas, respostas] = await Promise.all([
    db.mensagem.findMany({ where: { clienteId: usuario.clienteId, tipo: "STATUS", criadaEm: { gt: desde } }, orderBy: { criadaEm: "asc" } }),
    db.mensagemAtendimento.findMany({
      where: { de: "EQUIPE", autor: { not: "Guinho" }, lidaEm: null, criadaEm: { gt: desde }, atendimento: { clienteId: usuario.clienteId } },
      orderBy: { criadaEm: "asc" },
    }),
  ]);
  const avisos = [
    ...etapas.map((m) => ({ tipo: "etapa" as const, etapa: m.chave?.split(":")[2] ?? "", texto: m.texto, em: m.criadaEm.toISOString(), link: "/eggs/pedidos" })),
    ...respostas.map((m) => ({ tipo: "chat" as const, etapa: "", texto: `${m.autor}: ${m.texto}`, em: m.criadaEm.toISOString(), link: `/eggs/ajuda/${m.atendimentoId}` })),
  ].sort((a, b) => a.em.localeCompare(b.em));
  return Response.json({ avisos, agora: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
