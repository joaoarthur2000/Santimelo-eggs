"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, ChevronRight, MessageCircle, MessagesSquare, Phone, RotateCcw, Send } from "lucide-react";
import { ASSUNTOS, SETORES, textoWhatsapp, type Assunto } from "@/lib/chat";
import { abrirAtendimento } from "../actions";

export type PedidoChat = { id: number; rotulo: string };

type Fala = { de: "guinho" | "cliente"; texto: React.ReactNode };
type Etapa = "assunto" | "motivo" | "atalho" | "pedido" | "detalhe" | "contato" | "fim";

/** Conversa com o Guinho: funil de botões, quase nada pra digitar */
export function ChatGuinho({
  nome,
  estabelecimento,
  responsavel,
  whatsappCliente,
  whatsappSantimelo,
  pedidos,
  conversas,
}: {
  nome: string;
  estabelecimento: string;
  responsavel: string;
  whatsappCliente: string | null;
  whatsappSantimelo: string | null;
  pedidos: { proximos: PedidoChat[]; entregues: PedidoChat[] };
  conversas: { id: number; motivo: string; status: string; novas: number }[];
}) {
  const router = useRouter();
  const inicio: Fala[] = [{ de: "guinho", texto: <>Oi, {nome}! Eu sou o Guinho 🥚 Como posso te ajudar?</> }];
  const [falas, setFalas] = useState<Fala[]>(inicio);
  const [etapa, setEtapa] = useState<Etapa>("assunto");
  const [assunto, setAssunto] = useState<Assunto>();
  const [motivo, setMotivo] = useState("");
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [protocolo, setProtocolo] = useState<number>();
  const [erro, setErro] = useState<string>();
  const [enviando, iniciar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [falas, etapa]);

  const dizer = (...novas: Fala[]) => setFalas((f) => [...f, ...novas]);
  const opcao = assunto?.opcoes.find((o) => o.rotulo === motivo);

  function escolherAssunto(a: Assunto) {
    setAssunto(a);
    dizer({ de: "cliente", texto: `${a.emoji} ${a.rotulo}` }, { de: "guinho", texto: a.pergunta });
    setEtapa("motivo");
  }

  function escolherMotivo(m: string) {
    const o = assunto!.opcoes.find((x) => x.rotulo === m)!;
    setMotivo(m);
    if (o.atalho) {
      dizer({ de: "cliente", texto: m }, { de: "guinho", texto: o.atalho.resposta });
      setEtapa("atalho");
    } else if (o.pedido && pedidos[o.pedido].length) {
      dizer({ de: "cliente", texto: m }, { de: "guinho", texto: "Qual pedido?" });
      setEtapa("pedido");
    } else {
      dizer({ de: "cliente", texto: m }, { de: "guinho", texto: "Me conta rapidinho o que houve. Se preferir, pode pular." });
      setEtapa("detalhe");
    }
  }

  function escolherPedido(p: PedidoChat | null) {
    setPedidoId(p?.id ?? null);
    dizer({ de: "cliente", texto: p ? `Pedido ${p.rotulo}` : "Não é de um pedido específico" }, { de: "guinho", texto: "Me conta rapidinho o que houve. Se preferir, pode pular." });
    setEtapa("detalhe");
  }

  function enviarDetalhe() {
    const t = detalhe.trim();
    dizer(
      ...(t ? [{ de: "cliente" as const, texto: t }] : []),
      { de: "guinho", texto: <>Anotado! Vou passar pro pessoal de <b>{SETORES[assunto!.setor]}</b>. Como você prefere falar com a gente?</> },
    );
    setEtapa("contato");
  }

  function abrir(contato: "WHATSAPP" | "RETORNO" | "CHAT") {
    setErro(undefined);
    iniciar(async () => {
      const r = await abrirAtendimento({ assunto: assunto!.id, motivo, pedidoId, detalhe: detalhe.trim() || null, contato });
      if (r.erro || !r.protocolo) return setErro(r.erro ?? "Não deu pra enviar. Tenta de novo.");
      if (contato === "CHAT") return router.push(`/eggs/ajuda/${r.protocolo}`);
      setProtocolo(r.protocolo);
      dizer(
        { de: "cliente", texto: contato === "WHATSAPP" ? "💬 Quero falar no WhatsApp" : "📞 Prefiro que vocês me chamem" },
        {
          de: "guinho",
          texto:
            contato === "WHATSAPP" ? (
              <>Prontinho, protocolo <b>#{r.protocolo}</b>! Toca no botão verde: a mensagem já vai escrita, a equipe já sabe o assunto. 💛</>
            ) : (
              <>
                Fechado! Protocolo <b>#{r.protocolo}</b>. A equipe de {SETORES[assunto!.setor]} vai te chamar
                {whatsappCliente ? <> no WhatsApp <b>{whatsappCliente}</b></> : null} em horário comercial. 💛
              </>
            ),
        },
      );
      setEtapa("fim");
    });
  }

  function recomecar() {
    setFalas(inicio);
    setEtapa("assunto");
    setAssunto(undefined);
    setMotivo("");
    setPedidoId(null);
    setDetalhe("");
    setProtocolo(undefined);
    setErro(undefined);
  }

  const linkWhats =
    protocolo && whatsappSantimelo
      ? `https://wa.me/55${whatsappSantimelo.replace(/^55/, "")}?text=${encodeURIComponent(textoWhatsapp({ protocolo, responsavel, cliente: estabelecimento, setor: assunto!.setor, motivo, pedidoId, detalhe: detalhe.trim() || null }))}`
      : null;

  const botao = "eggs-toque w-full rounded-2xl bg-white px-4 py-3 text-left font-semibold ring-1 ring-casca-100 transition hover:ring-gema-500";

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/eggs/guinho/guinho-acenando.png" alt="" className="eggs-ginga h-20 w-18 shrink-0 object-contain" />
        <div>
          <h1 className="font-eggs text-3xl font-extrabold tracking-tight">Ajuda</h1>
          <p className="text-sm text-casca-700">Fala com o Guinho. Se precisar, ele chama a equipe.</p>
        </div>
      </header>

      {conversas.length > 0 && etapa === "assunto" && (
        <section className="space-y-2">
          <p className="titulo-eggs">Suas conversas</p>
          {conversas.map((c) => (
            <Link key={c.id} href={`/eggs/ajuda/${c.id}`} className="eggs-toque flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-casca-100">
              <MessagesSquare className="size-5 shrink-0 text-casca-700" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.motivo}</span>
                <span className="text-xs text-casca-500">Protocolo #{c.id} · {c.status === "RESOLVIDO" ? "resolvido" : "em andamento"}</span>
              </span>
              {c.novas > 0 && <span className="rounded-full bg-tomate-500 px-2 py-0.5 text-xs font-bold text-white">{c.novas} nova{c.novas > 1 ? "s" : ""}</span>}
              <ChevronRight className="size-4 shrink-0 text-casca-500" />
            </Link>
          ))}
        </section>
      )}

      <ol className="space-y-2.5" aria-live="polite">
        {falas.map((f, i) => (
          <li key={i} className={`eggs-entra flex ${f.de === "cliente" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
                f.de === "cliente" ? "rounded-br-md bg-casca-900 text-gema-50" : "rounded-bl-md bg-white shadow-sm ring-1 ring-casca-100"
              }`}
            >
              {f.texto}
            </p>
          </li>
        ))}
      </ol>

      <div className="space-y-2 pt-1">
        {etapa === "assunto" &&
          ASSUNTOS.map((a) => (
            <button key={a.id} type="button" onClick={() => escolherAssunto(a)} className={botao}>
              <span className="mr-2" aria-hidden>{a.emoji}</span>
              {a.rotulo}
            </button>
          ))}

        {etapa === "motivo" &&
          assunto!.opcoes.map((o) => (
            <button key={o.rotulo} type="button" onClick={() => escolherMotivo(o.rotulo)} className={botao}>
              {o.rotulo}
            </button>
          ))}

        {etapa === "atalho" && opcao?.atalho && (
          <>
            <Link href={opcao.atalho.href} className="eggs-toque flex w-full items-center justify-center gap-2 rounded-2xl bg-casca-900 px-4 py-3.5 font-bold text-gema-50">
              {opcao.atalho.botao} <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                dizer({ de: "cliente", texto: "Ainda preciso de ajuda" }, { de: "guinho", texto: "Sem problema! Me conta rapidinho o que houve." });
                setEtapa("detalhe");
              }}
              className={botao}
            >
              Ainda preciso de ajuda
            </button>
          </>
        )}

        {etapa === "pedido" && opcao?.pedido && (
          <>
            {pedidos[opcao.pedido].map((p) => (
              <button key={p.id} type="button" onClick={() => escolherPedido(p)} className={`${botao} tabular`}>
                {p.rotulo}
              </button>
            ))}
            <button type="button" onClick={() => escolherPedido(null)} className={`${botao} text-casca-700`}>
              Não é de um pedido específico
            </button>
          </>
        )}

        {etapa === "detalhe" && (
          <div className="rounded-3xl bg-white p-3 ring-1 ring-casca-100">
            <textarea
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              rows={3}
              maxLength={600}
              autoFocus
              placeholder="Ex: vieram 2 bandejas com ovos trincados"
              className="w-full resize-none rounded-2xl border-0 bg-gema-50 px-3 py-2.5 text-[15px] focus:ring-2 focus:ring-gema-400"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={enviarDetalhe} className="eggs-toque flex flex-1 items-center justify-center gap-2 rounded-2xl bg-casca-900 py-3 font-bold text-gema-50">
                <Send className="size-4" /> {detalhe.trim() ? "Enviar" : "Pular"}
              </button>
            </div>
          </div>
        )}

        {etapa === "contato" && (
          <>
            <button type="button" disabled={enviando} onClick={() => abrir("CHAT")} className="eggs-toque flex w-full items-center justify-center gap-2 rounded-2xl bg-casca-900 px-4 py-3.5 font-bold text-gema-50 disabled:opacity-60">
              <MessagesSquare className="size-5" /> Conversar aqui no app
            </button>
            {whatsappSantimelo && (
              <button type="button" disabled={enviando} onClick={() => abrir("WHATSAPP")} className="eggs-toque flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3.5 font-bold text-white shadow-[0_6px_16px_rgba(22,101,52,0.3)] disabled:opacity-60">
                <MessageCircle className="size-5" /> Falar no WhatsApp
              </button>
            )}
            <button type="button" disabled={enviando} onClick={() => abrir("RETORNO")} className={`${botao} flex items-center justify-center gap-2 disabled:opacity-60`}>
              <Phone className="size-4" /> Prefiro que vocês me chamem
            </button>
            {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          </>
        )}

        {etapa === "fim" && (
          <>
            {linkWhats && (
              <a href={linkWhats} target="_blank" rel="noreferrer" className="eggs-toque flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3.5 font-bold text-white shadow-[0_6px_16px_rgba(22,101,52,0.3)]">
                <MessageCircle className="size-5" /> Abrir o WhatsApp
              </a>
            )}
            <button type="button" onClick={recomecar} className={`${botao} flex items-center justify-center gap-2 text-casca-700`}>
              <RotateCcw className="size-4" /> Falar de outra coisa
            </button>
          </>
        )}
      </div>
      <div ref={fim} />
    </div>
  );
}
