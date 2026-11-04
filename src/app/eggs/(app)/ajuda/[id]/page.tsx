import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecarregaSozinho } from "@/components/atualiza-sozinho";
import { Conversa } from "@/components/conversa";
import { SETORES, STATUS_ATENDIMENTO, type Setor } from "@/lib/chat";
import { lerConversa } from "@/lib/conversa";
import { db } from "@/lib/db";
import { exigirCliente } from "@/lib/sessao";
import { responderAtendimento } from "../../actions";

export const metadata: Metadata = { title: "Conversa" };

export default async function ConversaEggs({ params }: PageProps<"/eggs/ajuda/[id]">) {
  const { cliente } = await exigirCliente();
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await db.atendimento.findUnique({ where: { id } }) : null;
  if (!a || a.clienteId !== cliente.id) notFound();
  const mensagens = await lerConversa(a.id, "CLIENTE");

  return (
    <div className="space-y-4">
      <RecarregaSozinho segundos={6} />
      <Link href="/eggs/ajuda" className="inline-flex items-center gap-1 text-sm font-semibold text-casca-700">
        <ArrowLeft className="size-4" /> Ajuda
      </Link>
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/eggs/guinho/guinho-joinha.png" alt="" className="h-16 w-14 shrink-0 object-contain" />
        <div className="min-w-0">
          <h1 className="font-eggs text-2xl font-extrabold leading-tight">{a.motivo}</h1>
          <p className="text-sm text-casca-700">
            Protocolo #{a.id} · {SETORES[a.setor as Setor] ?? a.setor} · {STATUS_ATENDIMENTO[a.status as keyof typeof STATUS_ATENDIMENTO]}
          </p>
        </div>
      </header>
      <Conversa mensagens={mensagens} eu="CLIENTE" tema="eggs" enviar={responderAtendimento.bind(null, a.id)} placeholder="Escreva pra Santimelo…" />
    </div>
  );
}
