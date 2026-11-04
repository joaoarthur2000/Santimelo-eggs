import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, MessagesSquare } from "lucide-react";
import { AtualizaSozinho } from "@/components/atualiza-sozinho";
import { Cabecalho, Vazio } from "@/components/ui";
import { CONTATOS, SETORES, STATUS_ATENDIMENTO, type Setor } from "@/lib/chat";
import { formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { mudarAtendimento, salvarNotaAtendimento } from "../actions";

export const metadata: Metadata = { title: "Atendimentos" };

const COR_SETOR: Record<Setor, string> = {
  VENDAS: "bg-sky-100 text-sky-900",
  ENTREGA: "bg-amber-100 text-amber-900",
  FINANCEIRO: "bg-green-100 text-green-900",
  TECNICO: "bg-violet-100 text-violet-900",
};

const FILTROS = { abertos: "Abertos", resolvidos: "Resolvidos" } as const;

export default async function Atendimentos({ searchParams }: PageProps<"/painel/atendimentos">) {
  const { ver } = await searchParams;
  const resolvidos = ver === "resolvidos";
  const lista = await db.atendimento.findMany({
    where: resolvidos ? { status: "RESOLVIDO" } : { status: { not: "RESOLVIDO" } },
    include: {
      cliente: true,
      pedido: true,
      conversa: { orderBy: { criadaEm: "desc" }, take: 1 },
      _count: { select: { conversa: { where: { de: "CLIENTE", lidaEm: null } } } },
    },
    orderBy: resolvidos ? { resolvidoEm: "desc" } : [{ status: "asc" }, { criadoEm: "asc" }],
    take: resolvidos ? 50 : undefined,
  });

  return (
    <>
      <Cabecalho titulo="Atendimentos" subtitulo="O que os clientes pediram no chat do Guinho, já com o assunto. Mais antigo primeiro.">
        <AtualizaSozinho segundos={20} />
      </Cabecalho>

      <nav className="mb-4 flex gap-2 text-sm">
        {Object.entries(FILTROS).map(([chave, rotulo]) => (
          <Link
            key={chave}
            href={chave === "abertos" ? "/painel/atendimentos" : "/painel/atendimentos?ver=resolvidos"}
            className={`etiqueta px-3 py-1 ${(chave === "resolvidos") === resolvidos ? "bg-marca-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <div className="cartao p-5">
          <Vazio>{resolvidos ? "Nenhum atendimento resolvido ainda." : "Nenhum atendimento aberto. Tudo em dia! 🥚"}</Vazio>
        </div>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
          {lista.map((a) => {
            const whats = (a.cliente.whatsapp ?? "").replace(/\D/g, "");
            const resposta = `Oi, ${a.cliente.responsavel?.split(" ")[0] ?? ""}! Aqui é da Santimelo 🥚 Sobre o seu protocolo #${a.id} (${a.motivo}):`;
            return (
              <li key={a.id} className={`cartao p-5 ${a.status === "ABERTO" ? "ring-2 ring-gema-400" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-500">
                      Protocolo #{a.id} · {formatarDataCurta(a.criadoEm)} {a.criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </p>
                    <Link href={`/painel/clientes/${a.clienteId}`} className="text-lg font-semibold text-marca-900 hover:underline">{a.cliente.nomeFantasia}</Link>
                    <p className="text-sm text-stone-600">{a.cliente.responsavel ?? "—"} · {a.cliente.whatsapp ?? "sem WhatsApp"}</p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <span className={`etiqueta ${COR_SETOR[a.setor as Setor] ?? "bg-stone-100"}`}>{SETORES[a.setor as Setor] ?? a.setor}</span>
                    <span className={`etiqueta ${a.status === "ABERTO" ? "bg-gema-400 text-casca-900" : a.status === "ANDAMENTO" ? "bg-sky-100 text-sky-900" : "bg-stone-100 text-stone-600"}`}>
                      {STATUS_ATENDIMENTO[a.status as keyof typeof STATUS_ATENDIMENTO]}
                    </span>
                  </span>
                </div>

                <p className="mt-3 font-semibold">{a.motivo}</p>
                {a.pedido && (
                  <Link href={`/painel/pedidos/${a.pedido.id}`} className="text-sm text-marca-700 hover:underline">
                    Pedido #{a.pedido.id} · entrega {formatarDataCurta(a.pedido.dataEntrega)}
                  </Link>
                )}
                {a.detalhe && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm italic">&ldquo;{a.detalhe}&rdquo;</p>}
                {a.conversa[0] && (
                  <p className="mt-2 truncate text-sm text-stone-600">
                    <b>{a.conversa[0].de === "CLIENTE" ? a.conversa[0].autor : `${a.conversa[0].autor} (equipe)`}:</b> {a.conversa[0].texto}
                  </p>
                )}
                <p className="mt-2 text-xs font-medium text-stone-500">{CONTATOS[a.contato as keyof typeof CONTATOS]}</p>

                <form action={salvarNotaAtendimento.bind(null, a.id)} className="mt-3 flex gap-2">
                  <input name="nota" defaultValue={a.nota ?? ""} placeholder="Anotação da equipe (o cliente não vê)" className="campo py-1.5 text-sm" />
                  <button className="botao-secundario px-3 py-1.5 text-xs">Salvar</button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/painel/atendimentos/${a.id}`} className="botao-primario">
                    <MessagesSquare className="size-4" /> Conversar
                    {a._count.conversa > 0 && <span className="rounded-full bg-gema-400 px-1.5 text-xs font-bold text-casca-900">{a._count.conversa}</span>}
                  </Link>
                  {whats && (
                    <a href={`https://wa.me/55${whats}?text=${encodeURIComponent(resposta)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                      <MessageCircle className="size-4" /> Chamar no WhatsApp
                    </a>
                  )}
                  {a.status === "ABERTO" && (
                    <form action={mudarAtendimento.bind(null, a.id, "ANDAMENTO")}>
                      <button className="botao-secundario">Peguei esse</button>
                    </form>
                  )}
                  {a.status !== "RESOLVIDO" ? (
                    <form action={mudarAtendimento.bind(null, a.id, "RESOLVIDO")}>
                      <button className="botao-secundario">Resolvido ✓</button>
                    </form>
                  ) : (
                    <form action={mudarAtendimento.bind(null, a.id, "ANDAMENTO")}>
                      <button className="botao-secundario">Reabrir</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
