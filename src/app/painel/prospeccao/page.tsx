import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Star, Trash2 } from "lucide-react";
import { Cabecalho, Indicador, Vazio } from "@/components/ui";
import { lerConfig } from "@/lib/config";
import { diaISO, formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, pct } from "@/lib/formato";
import {
  CHAVE_MENSAGEM, EM_CONVERSA, MENSAGEM_PADRAO, NOMES_REGIOES, STATUS_LEAD, TIPOS_PROSPECCAO, ehStatusLead, formatarCnpj, linkWhatsapp, montarMensagem, temChaveGoogle, type StatusLead,
} from "@/lib/prospeccao";
import { excluirLead } from "./actions";
import { BotaoWhatsapp, FormBusca, FormImportar, FormLead, FormMensagem } from "./forms";

export const metadata: Metadata = { title: "Prospecção" };

const ABAS = {
  abertos: { rotulo: "Pra trabalhar", status: ["NOVO", ...EM_CONVERSA] },
  novos: { rotulo: "Sem contato", status: ["NOVO"] },
  conversa: { rotulo: "Em conversa", status: EM_CONVERSA },
  clientes: { rotulo: "Viraram cliente", status: ["CLIENTE"] },
  descartados: { rotulo: "Sem interesse", status: ["SEM_INTERESSE"] },
} satisfies Record<string, { rotulo: string; status: StatusLead[] }>;
type Aba = keyof typeof ABAS;

const COR_STATUS: Record<StatusLead, string> = {
  NOVO: "bg-sky-100 text-sky-800",
  ENVIADO: "bg-amber-100 text-amber-800",
  RESPONDEU: "bg-violet-100 text-violet-800",
  VISITA: "bg-orange-100 text-orange-800",
  AMOSTRA: "bg-gema-200 text-casca-900",
  CLIENTE: "bg-green-100 text-green-800",
  SEM_INTERESSE: "bg-stone-200 text-stone-600",
};
const ORDEM: StatusLead[] = ["AMOSTRA", "VISITA", "RESPONDEU", "ENVIADO", "NOVO", "CLIENTE", "SEM_INTERESSE"];

export default async function Prospeccao({ searchParams }: PageProps<"/painel/prospeccao">) {
  const { ver, lote: loteParam, q: qParam } = await searchParams;
  const aba: Aba = typeof ver === "string" && ver in ABAS ? (ver as Aba) : "abertos";
  const lote = typeof loteParam === "string" && loteParam ? loteParam : null;
  const q = typeof qParam === "string" ? qParam.trim() : "";
  const hoje = diaISO();

  const [todos, mensagemSalva] = await Promise.all([
    db.lead.findMany({ orderBy: { criadoEm: "desc" } }),
    lerConfig(CHAVE_MENSAGEM),
  ]);
  const mensagem = mensagemSalva ?? MENSAGEM_PADRAO;
  const lotes = [...new Set(todos.map((l) => l.lote).filter((l): l is string => !!l))];

  const doLote = lote ? todos.filter((l) => l.lote === lote) : todos;
  const conta = (s: StatusLead[]) => doLote.filter((l) => (s as string[]).includes(l.status)).length;
  const contatados = doLote.filter((l) => l.status !== "NOVO").length;
  const clientes = conta(["CLIENTE"]);

  const busca = q.toLowerCase();
  const lista = doLote
    .filter((l) => (ABAS[aba].status as string[]).includes(l.status))
    .filter((l) => !busca || [l.nome, l.bairro, l.cidade, l.razaoSocial, l.telefone].some((v) => v?.toLowerCase().includes(busca)))
    .map((l) => ({ ...l, atrasado: !!l.proximoPasso && l.proximoPasso <= hoje && !["CLIENTE", "SEM_INTERESSE"].includes(l.status) }))
    .sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || ORDEM.indexOf(a.status as StatusLead) - ORDEM.indexOf(b.status as StatusLead) || (b.nota ?? 0) * Math.log10((b.avaliacoes ?? 0) + 10) - (a.nota ?? 0) * Math.log10((a.avaliacoes ?? 0) + 10))
    .slice(0, 300);

  const url = (p: { ver?: string; lote?: string | null }) => {
    const s = new URLSearchParams();
    const v = p.ver ?? aba;
    if (v !== "abertos") s.set("ver", v);
    const l = p.lote === undefined ? lote : p.lote;
    if (l) s.set("lote", l);
    if (q) s.set("q", q);
    const t = s.toString();
    return `/painel/prospeccao${t ? `?${t}` : ""}`;
  };
  const temChave = temChaveGoogle();

  return (
    <>
      <Cabecalho titulo="Prospecção" subtitulo="Estabelecimentos pra virar cliente: busca no Google por tipo e região, chama no WhatsApp com a mensagem pronta e acompanha até fechar." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Sem contato" valor={num(conta(["NOVO"]))} detalhe="na fila pra chamar" />
        <Indicador rotulo="Em conversa" valor={num(conta(EM_CONVERSA))} detalhe={`${num(conta(["RESPONDEU", "VISITA", "AMOSTRA"]))} já responderam`} />
        <Indicador rotulo="Viraram cliente" valor={num(clientes)} detalhe={contatados ? `${pct(clientes / contatados)} dos contatados` : "ninguém contatado ainda"} />
        <Indicador rotulo="Na lista" valor={num(doLote.length)} detalhe={lote ? "nessa busca" : `${lotes.length} ${lotes.length === 1 ? "busca" : "buscas"}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(ABAS) as Aba[]).map((a) => (
              <Link key={a} href={url({ ver: a })} className={`rounded-full px-3 py-1.5 text-sm ${a === aba ? "bg-marca-800 font-semibold text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"}`}>
                {ABAS[a].rotulo} <span className="tabular opacity-70">{conta(ABAS[a].status)}</span>
              </Link>
            ))}
          </div>
          <form action="/painel/prospeccao" className="flex flex-wrap gap-2">
            {aba !== "abertos" && <input type="hidden" name="ver" value={aba} />}
            <select name="lote" defaultValue={lote ?? ""} className="campo w-auto max-w-full" aria-label="Busca">
              <option value="">Todas as buscas</option>
              {lotes.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input name="q" defaultValue={q} placeholder="Nome, bairro, telefone…" className="campo w-auto min-w-0 flex-1" />
            <button className="botao-secundario">Filtrar</button>
          </form>

          {lista.length === 0 && (
            <Vazio>{todos.length === 0 ? "Nenhum lead ainda. Faça a primeira busca no Google ao lado, ou peça pro bot: \"traga 50 lancherias da Zona Sul\"." : "Nada nesse filtro."}</Vazio>
          )}

          {lista.map((l) => {
            const status = ehStatusLead(l.status) ? l.status : "NOVO";
            return (
              <article key={l.id} className={`cartao p-4 ${l.atrasado ? "ring-2 ring-gema-400" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-marca-950">{l.nome}</h2>
                      <span className={`etiqueta ${COR_STATUS[status]}`}>{STATUS_LEAD[status]}</span>
                      {l.atrasado && <span className="etiqueta bg-gema-400 text-casca-900">Voltar a falar</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {[l.tipoNegocio, [l.endereco, l.bairro].filter(Boolean).join(" · "), l.cidade].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {l.telefone && (
                        <span className="tabular">
                          {l.telefone} <span className="text-xs text-stone-500">{l.celular ? "· celular (WhatsApp provável)" : "· fixo (pode ter WhatsApp Business)"}</span>
                        </span>
                      )}
                      {l.nota !== null && (
                        <span className="inline-flex items-center gap-1 text-stone-600">
                          <Star className="size-3.5 fill-gema-400 text-gema-500" aria-hidden /> {num(l.nota)} <span className="text-xs text-stone-500">({num(l.avaliacoes ?? 0)} avaliações)</span>
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {l.cnpj ? (
                        <>CNPJ <span className="tabular text-stone-700">{formatarCnpj(l.cnpj)}</span>{[l.porte, l.razaoSocial, l.situacaoCnpj && l.situacaoCnpj !== "Ativa" ? `situação: ${l.situacaoCnpj}` : null].filter(Boolean).map((x) => ` · ${x}`)}</>
                      ) : (
                        "Sem CNPJ ainda (o bot procura, ou coloque abaixo)"
                      )}
                      {l.contatadoEm && ` · contato em ${formatarDataCurta(l.contatadoEm)}`}
                      {l.proximoPasso && ` · voltar a falar em ${l.proximoPasso.split("-").reverse().slice(0, 2).join("/")}`}
                    </p>
                  </div>
                  {l.whatsapp && <BotaoWhatsapp id={l.id} novo={l.status === "NOVO"} href={linkWhatsapp(l.whatsapp, montarMensagem(mensagem, l))} />}
                </div>
                {l.observacoes && <p className="mt-2 rounded-lg bg-marca-50 px-3 py-2 text-sm text-stone-700">{l.observacoes}</p>}
                <details className="mt-3 border-t border-stone-100 pt-3">
                  <summary className="cursor-pointer text-sm text-marca-700 hover:underline">Atualizar</summary>
                  <div className="mt-3 space-y-3">
                    <FormLead lead={l} />
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {l.linkMaps && (
                        <a href={l.linkMaps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-marca-700 hover:underline">
                          Ver no Google Maps <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      <Link href="/painel/clientes/rapido" className="text-marca-700 hover:underline">Cadastrar como cliente →</Link>
                      <form action={excluirLead.bind(null, l.id)} className="ml-auto">
                        <button className="inline-flex items-center gap-1 text-stone-500 hover:text-red-600"><Trash2 className="size-3.5" /> Excluir da lista</button>
                      </form>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </section>

        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Buscar no Google</h2>
            <p className="mb-3 mt-1 text-xs text-stone-500">Vai bairro por bairro e já tira fechados, grandes redes, quem não tem telefone e quem já é cliente.</p>
            {!temChave && (
              <p className="mb-3 rounded-lg bg-gema-100 px-3 py-2 text-xs text-casca-900">
                Falta a chave do Google: coloque <code>GOOGLE_PLACES_API_KEY</code> no <code>.env</code> do EGGS e reinicie. O passo a passo está em <code>prospeccao-bot/README.md</code>.
              </p>
            )}
            <FormBusca tipos={TIPOS_PROSPECCAO} regioes={NOMES_REGIOES} temChave={temChave} />
          </section>

          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Mensagem do WhatsApp</h2>
            <p className="mb-3 mt-1 text-xs text-stone-500">Vai pronta no botão de cada lead. <code>{"{nome}"}</code> vira o nome do lugar e <code>{"{bairro}"}</code> o bairro. Você revisa e envia no seu WhatsApp.</p>
            <FormMensagem atual={mensagem} />
          </section>

          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Importar lista</h2>
            <p className="mb-3 mt-1 text-xs text-stone-500">Arquivo do bot ou planilha (CSV ou JSON) com nome e telefone. Quem já está na lista ou já é cliente não entra de novo.</p>
            <FormImportar tipos={TIPOS_PROSPECCAO} />
          </section>
        </aside>
      </div>
    </>
  );
}
