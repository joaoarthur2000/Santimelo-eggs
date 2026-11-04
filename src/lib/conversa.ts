import "server-only";
import { db } from "./db";
import type { MensagemConversa } from "@/components/conversa";

const hora = (d: Date) =>
  `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`;

/** Mensagens do atendimento pra tela de conversa; marca como lidas as do outro lado */
export async function lerConversa(atendimentoId: number, eu: "EQUIPE" | "CLIENTE"): Promise<MensagemConversa[]> {
  const outro = eu === "EQUIPE" ? "CLIENTE" : "EQUIPE";
  await db.mensagemAtendimento.updateMany({ where: { atendimentoId, de: outro, lidaEm: null }, data: { lidaEm: new Date() } });
  const lista = await db.mensagemAtendimento.findMany({ where: { atendimentoId }, orderBy: { criadaEm: "asc" } });
  return lista.map((m) => ({ id: m.id, de: m.de, autor: m.autor, texto: m.texto, hora: hora(m.criadaEm), lida: !!m.lidaEm }));
}
