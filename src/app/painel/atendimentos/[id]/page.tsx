import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { RecarregaSozinho } from "@/components/atualiza-sozinho";
import { Conversa } from "@/components/conversa";
import { CONTATOS, SETORES, STATUS_ATENDIMENTO, type Setor } from "@/lib/chat";
import { lerConversa } from "@/lib/conversa";
import { formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { enviarMensagemAtendimento, mudarAtendimento, salvarNotaAtendimento } from "../../actions";

export const metadata: Metadata = { title: "Atendimento" };

export default async function AtendimentoPainel({ params }: PageProps<"/painel/atendimentos/[id]">) {
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await db.atendimento.findUnique({ where: { id }, include: { cliente: true, pedido: true } }) : null;
  if (!a) notFound();
  const mensagens = await lerConversa(a.id, "EQUIPE");
  const whats = (a.cliente.whatsapp ?? "").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-3xl">
      <RecarregaSozinho segundos={6} />
      <Link href="/painel/atendimentos" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700">
        <ArrowLeft className="size-4" /> Atendimentos
      </Link>

      <header className="cartao mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-stone-500">Protocolo #{a.id} · {formatarDataCurta(a.criadoEm)} · {SETORES[a.setor as Setor] ?? a.setor}</p>
            <Link href={`/painel/clientes/${a.clienteId}`} className="text-xl font-bold text-marca-900 hover:underline">{a.cliente.nomeFantasia}</Link>
            <p className="text-sm text-stone-600">{a.cliente.responsavel ?? "—"} · {a.cliente.whatsapp ?? "sem WhatsApp"}</p>
          </div>
          <span className={`etiqueta ${a.status === "ABERTO" ? "bg-gema-400 text-casca-900" : a.status === "ANDAMENTO" ? "bg-sky-100 text-sky-900" : "bg-stone-100 text-stone-600"}`}>
            {STATUS_ATENDIMENTO[a.status as keyof typeof STATUS_ATENDIMENTO]}
          </span>
        </div>
        <p className="mt-3 font-semibold">{a.motivo}</p>
        {a.pedido && (
          <Link href={`/painel/pedidos/${a.pedido.id}`} className="text-sm text-marca-700 hover:underline">
            Pedido #{a.pedido.id} · entrega {formatarDataCurta(a.pedido.dataEntrega)}
          </Link>
        )}
        {a.detalhe && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm italic">&ldquo;{a.detalhe}&rdquo;</p>}
        <p className="mt-2 text-xs text-stone-500">{CONTATOS[a.contato as keyof typeof CONTATOS] ?? a.contato}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {whats && (
            <a href={`https://wa.me/55${whats}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          {a.status !== "RESOLVIDO" ? (
            <form action={mudarAtendimento.bind(null, a.id, "RESOLVIDO")}>
              <button className="botao-primario">Resolvido ✓</button>
            </form>
          ) : (
            <form action={mudarAtendimento.bind(null, a.id, "ANDAMENTO")}>
              <button className="botao-secundario">Reabrir</button>
            </form>
          )}
        </div>
        <form action={salvarNotaAtendimento.bind(null, a.id)} className="mt-3 flex gap-2">
          <input name="nota" defaultValue={a.nota ?? ""} placeholder="Anotação da equipe (o cliente não vê)" className="campo py-1.5 text-sm" />
          <button className="botao-secundario px-3 py-1.5 text-xs">Salvar</button>
        </form>
      </header>

      <section className="rounded-2xl bg-stone-100/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-600">Conversa no app · o cliente recebe aviso a cada mensagem</h2>
        {mensagens.length === 0 && <p className="mb-3 text-sm text-stone-500">Nenhuma mensagem ainda. Escreva abaixo: chega no app do cliente na hora.</p>}
        <Conversa mensagens={mensagens} eu="EQUIPE" enviar={enviarMensagemAtendimento.bind(null, a.id)} placeholder={`Responder ${a.cliente.responsavel?.split(" ")[0] ?? "o cliente"}…`} />
      </section>
    </div>
  );
}
