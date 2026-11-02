"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, RotateCcw, Truck } from "lucide-react";
import { fazerPedido } from "../actions";
import { Ovo, tipoDoOvo } from "../enfeites";

type Produto = { id: string; item: string; codigo: string | null; embalagem: string; unidade: string; preco: number; negociado: boolean };
type Dia = { dia: string; janelas: { id: string; inicio: string; fim: string; capacidade: number; livres: number }[] };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const UN: Record<string, string> = { caixa: "cx", bandeja: "bdj", duzia: "dz" };
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (dia: string) => {
  const d = new Date(`${dia}T12:00:00-03:00`);
  return { semana: SEMANA[d.getUTCDay()], numero: dia.slice(8, 10), mes: dia.slice(5, 7) };
};

type Etapa = "ovos" | "dia" | "horario";
const FALTA: Record<Etapa, string> = { ovos: "Escolha os ovos aqui 👇", dia: "Escolha o dia da entrega 👇", horario: "Agora escolha o horário 👇" };

/** Chamada em cima da etapa que falta preencher (pula de novo a cada toque no botão) */
function Falta({ etapa, falta, vez }: { etapa: Etapa; falta?: Etapa; vez: number }) {
  if (falta !== etapa) return null;
  return (
    <p key={vez} className="eggs-pula mb-2 inline-block rounded-full bg-tomate-500 px-3 py-1 text-sm font-bold text-white">
      {FALTA[etapa]}
    </p>
  );
}

/** Produtos → dia → horário → fazer pedido. Caixa anda de meia em meia */
export function FormPedido({ produtos, agenda, anterior, repetindo }: { produtos: Produto[]; agenda: Dia[]; anterior: { produtoId: string; quantidade: number }[]; repetindo: boolean }) {
  const router = useRouter();
  const [carrinho, setCarrinho] = useState<Map<string, number>>(() => new Map(repetindo ? anterior.map((a) => [a.produtoId, a.quantidade]) : []));
  const primeiroDia = agenda.find((d) => d.janelas.some((j) => j.livres > 0));
  const [dia, setDia] = useState(primeiroDia?.dia ?? "");
  const [janelaId, setJanelaId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string>();
  const [falta, setFalta] = useState<Etapa>();
  const [vez, setVez] = useState(0);
  const [enviando, iniciar] = useTransition();
  const refOvos = useRef<HTMLElement>(null);
  const refDia = useRef<HTMLElement>(null);
  const refHorario = useRef<HTMLElement>(null);

  const linhas = useMemo(() => produtos.filter((p) => (carrinho.get(p.id) ?? 0) > 0).map((p) => ({ p, q: carrinho.get(p.id)! })), [produtos, carrinho]);
  const total = linhas.reduce((s, l) => s + l.p.preco * l.q, 0);
  const diaEscolhido = agenda.find((d) => d.dia === dia);

  /** Rola até a etapa e chama atenção nela */
  function irPara(etapa: Etapa, marcar = true) {
    if (marcar) {
      setFalta(etapa);
      setVez((v) => v + 1);
    }
    // espera a etapa aparecer (o horário só existe depois de escolher o dia)
    setTimeout(() => ({ ovos: refOvos, dia: refDia, horario: refHorario })[etapa].current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  function mudar(p: Produto, delta: number) {
    if (falta === "ovos" && delta > 0) setFalta(undefined);
    setCarrinho((c) => {
      const n = new Map(c);
      const v = Math.max(0, Math.round(((n.get(p.id) ?? 0) + delta) * 10) / 10);
      if (v === 0) n.delete(p.id);
      else n.set(p.id, v);
      return n;
    });
  }

  function confirmar() {
    setErro(undefined);
    if (!linhas.length) return irPara("ovos");
    if (!dia) return irPara("dia");
    if (!janelaId) return irPara("horario");
    setFalta(undefined);
    iniciar(async () => {
      const r = await fazerPedido({ dia, janelaId, observacao: observacao.trim() || null, itens: linhas.map((l) => ({ produtoId: l.p.id, quantidade: l.q })) });
      if (r.erro) return setErro(r.erro);
      router.push(`/eggs/pedidos?novo=${r.id}`);
    });
  }

  return (
    <div className="mt-5 space-y-6">
      {anterior.length > 0 && !repetindo && carrinho.size === 0 && (
        <button type="button" onClick={() => setCarrinho(new Map(anterior.map((a) => [a.produtoId, a.quantidade])))} className="botao-eggs-claro w-full">
          <RotateCcw className="size-4" /> Repetir meu último pedido
        </button>
      )}

      <section ref={refOvos} className="scroll-mt-24">
        <h2 className="titulo-eggs mb-2">1. Ovos</h2>
        <Falta etapa="ovos" falta={falta} vez={vez} />
        <ul className="space-y-2.5">
          {produtos.map((p, n) => {
            const q = carrinho.get(p.id) ?? 0;
            const passo = p.unidade === "caixa" ? 0.5 : 1;
            return (
              <li
                key={p.id}
                style={{ "--i": n } as React.CSSProperties}
                className={`eggs-entra grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-3xl p-3 ring-1 transition ${q > 0 ? "bg-gema-100 ring-2 ring-gema-500" : "bg-white ring-casca-100"}`}
              >
                <Ovo tipo={tipoDoOvo(p.item)} className={`row-span-2 size-14 ${q > 0 ? "eggs-balanca" : ""}`} />
                <div className="min-w-0">
                  <p className="font-eggs text-lg font-extrabold leading-tight">
                    {p.item}
                    {p.negociado && <span className="ml-2 inline-block rounded-full bg-gema-400 px-2 py-0.5 align-middle font-sans text-[11px] font-bold">seu preço</span>}
                  </p>
                  <p className="text-sm text-casca-700">{p.embalagem}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="tabular font-eggs text-xl font-extrabold text-tomate-600">
                    {reais(p.preco)}
                    <span className="font-sans text-sm font-normal text-casca-500">/{UN[p.unidade] ?? p.unidade}</span>
                  </p>
                <div className="flex shrink-0 items-center rounded-2xl bg-white ring-1 ring-casca-100">
                  <button type="button" onClick={() => mudar(p, -passo)} disabled={q === 0} className="p-3 text-casca-700 disabled:opacity-30" aria-label={`Menos ${p.item}`}>
                    <Minus className="size-5" />
                  </button>
                  <span key={q} className={`tabular w-10 text-center text-lg font-bold ${q > 0 ? "eggs-pula" : ""}`} aria-live="polite">{qtd(q)}</span>
                  <button type="button" onClick={() => mudar(p, passo)} className="p-3 text-casca-900" aria-label={`Mais ${p.item}`}>
                    <Plus className="size-5" />
                  </button>
                </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-casca-500">Caixa = 12 bandejas de 30 (360 ovos). Dá pra pedir meia caixa.</p>
      </section>

      <section ref={refDia} className="scroll-mt-24">
        <h2 className="titulo-eggs mb-2">2. Dia da entrega</h2>
        <Falta etapa="dia" falta={falta} vez={vez} />
        {agenda.length === 0 ? (
          <p className="cartao-eggs text-sm text-casca-700">Nenhum dia de entrega nos próximos 14 dias pra sua região. Fale com a Santimelo.</p>
        ) : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {agenda.map((d) => {
              const lotado = d.janelas.every((j) => j.livres === 0);
              const c = diaCurto(d.dia);
              return (
                <button
                  key={d.dia}
                  type="button"
                  disabled={lotado}
                  onClick={() => {
                    setDia(d.dia);
                    setJanelaId("");
                    if (falta === "dia") setFalta(undefined);
                    // escolheu o dia: já leva pros horários
                    irPara("horario", false);
                  }}
                  className={`eggs-toque flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 transition disabled:opacity-40 ${dia === d.dia ? "bg-casca-900 text-gema-50" : "bg-white ring-1 ring-casca-100"}`}
                >
                  <span className="text-xs font-semibold uppercase">{c.semana}</span>
                  <span className="font-eggs text-2xl font-extrabold leading-tight">{c.numero}</span>
                  <span className="text-[11px] opacity-70">{lotado ? "lotado" : `/${c.mes}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {diaEscolhido && (
        <section ref={refHorario} className={`scroll-mt-24 rounded-3xl transition ${falta === "horario" ? "bg-tomate-500/10 shadow-[0_0_0_10px_rgba(232,67,47,0.1)]" : ""}`}>
          <h2 className="titulo-eggs mb-2">3. Horário</h2>
          <Falta etapa="horario" falta={falta} vez={vez} />
          <div className="grid grid-cols-2 gap-2">
            {diaEscolhido.janelas.map((j) => (
              <button
                key={j.id}
                type="button"
                disabled={j.livres === 0}
                onClick={() => {
                  setJanelaId(j.id);
                  setFalta(undefined);
                }}
                className={`eggs-toque rounded-2xl px-3 py-3 text-left transition disabled:opacity-40 ${janelaId === j.id ? "bg-casca-900 text-gema-50" : "bg-white ring-1 ring-casca-100"}`}
              >
                <span className="block font-eggs text-lg font-extrabold">{j.inicio} – {j.fim}</span>
                <span className="text-xs opacity-80">{j.livres === 0 ? "lotado" : j.livres === 1 ? "última vaga" : `${j.livres} vagas`}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="titulo-eggs mb-2">Observação (opcional)</h2>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Ex: deixar na portaria dos fundos"
          className="w-full rounded-2xl border-0 bg-white p-3 text-base ring-1 ring-casca-100 outline-none focus:ring-2 focus:ring-gema-500"
        />
      </section>

      {/* Resumo fixo acima das abas */}
      <div className="fixed inset-x-0 bottom-[68px] z-10 px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-3 shadow-[0_-4px_24px_rgba(61,38,20,0.12)] ring-1 ring-casca-100">
          {erro && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 pl-2">
              <p key={total} className="tabular eggs-pula inline-block font-eggs text-2xl font-extrabold">{reais(total)}</p>
              <p className="truncate text-xs text-casca-500">
                {linhas.length ? linhas.map((l) => `${qtd(l.q)} ${UN[l.p.unidade] ?? l.p.unidade} ${l.p.item.toLowerCase()}`).join(" · ") : "Escolha os ovos"}
              </p>
              {linhas.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-green-700">
                  <Truck className="size-3.5" /> Frete grátis
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando}
              className="eggs-toque inline-flex shrink-0 items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-base font-bold text-white shadow-[0_6px_16px_rgba(22,101,52,0.35)] transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Fazer pedido"}
            </button>
          </div>
        </div>
      </div>
      <div className="h-24" aria-hidden />
    </div>
  );
}
