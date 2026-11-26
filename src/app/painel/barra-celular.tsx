"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ClipboardPlus, HandCoins, LayoutGrid, LogOut, PackagePlus, Plus, Receipt, RefreshCw, UserPlus, type LucideIcon } from "lucide-react";
import { IconeEggs } from "@/app/eggs/marca-eggs";
import { Folha } from "@/components/folha";
import { GRUPOS } from "./itens-nav";

// Painel no celular: topo com título e voltar, barra de abas no polegar, "+" com os lançamentos do dia a dia
// e "Mais" com o resto. No computador nada disso aparece (menu lateral).

const ITENS = GRUPOS.flatMap((g) => g.links);
const item = (href: string) => ITENS.find((i) => i.href === href)!;

const ABAS = ["/painel", "/painel/pedidos", null, "/painel/clientes"] as const;

// Tudo que não está na barra, do mais usado pro menos usado na rua
const MAIS = [
  "/painel/dia",
  "/painel/cobrancas",
  "/painel/rotas",
  "/painel/estoque",
  "/painel/fornecedores",
  "/painel/relatorios",
  "/painel/despesas",
  "/painel/precos",
  "/painel/veiculos",
  "/painel/prospeccao",
  "/painel/atendimentos",
  "/painel/entregas",
  "/painel/aplicativo",
];
const ROTULO_CURTO: Record<string, string> = { "/painel/entregas": "Regiões" };

const LANCAR: { href: string; rotulo: string; detalhe: string; icone: LucideIcon }[] = [
  { href: "/painel/pedidos/novo", rotulo: "Novo pedido", detalhe: "Chegou por WhatsApp, telefone ou balcão", icone: ClipboardPlus },
  { href: "/painel/cobrancas", rotulo: "Receber pagamento", detalhe: "Marcar cobrança como paga", icone: HandCoins },
  { href: "/painel/fornecedores#lancar", rotulo: "Lançar compra", detalhe: "Caixas que você pegou no fornecedor", icone: PackagePlus },
  { href: "/painel/despesas#lancar", rotulo: "Lançar despesa", detalhe: "Gasto da operação", icone: Receipt },
  { href: "/painel/clientes/rapido", rotulo: "Cliente novo", detalhe: "Nome e forma de pagamento já bastam", icone: UserPlus },
];

const ehApp = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
const ehFormulario = (rota: string) => /\/(novo|rapido|editar)$/.test(rota);
/** Nome da tela pro botão de voltar: o item do menu que cobre a rota */
const nomeDa = (rota: string) => ITENS.filter((i) => ativa(i.href, rota)).sort((a, b) => b.href.length - a.href.length)[0]?.rotulo ?? "Voltar";
/** Tela de dentro (/painel/pedidos/32) → a lista dela (/painel/pedidos). Tela de aba não tem volta */
function pai(rota: string) {
  const partes = rota.split("/").filter(Boolean);
  return partes.length > 2 ? `/${partes.slice(0, 2).join("/")}` : null;
}
const ativa = (href: string, rota: string) => (href === "/painel" ? rota === href : rota === href || rota.startsWith(`${href}/`));

function Bolinha({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="tabular absolute top-1 left-1/2 z-10 ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pimenta px-1 text-[11px] font-bold text-white" aria-label={`${n} pendentes`}>
      {n}
    </span>
  );
}

/** Enquanto a tela tocada carrega, o ícone gira no lugar: o toque nunca parece perdido */
function Icone({ Icone: I, forte }: { Icone: LucideIcon; forte: boolean }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="size-6 animate-spin rounded-full border-[2.5px] border-terra/15 border-t-terra" aria-hidden />
  ) : (
    <I className="size-6" strokeWidth={forte ? 2.25 : 1.75} aria-hidden />
  );
}

export function TopoCelular() {
  const rota = usePathname();
  const router = useRouter();
  const [rolou, setRolou] = useState<string | null>(null);
  const [atualizando, iniciar] = useTransition();
  // de onde veio: "voltar" devolve a tela no ponto em que estava (menos formulário: aí vai pra lista)
  const [trilha, setTrilha] = useState<{ atual: string; anterior: string | null }>({ atual: rota, anterior: null });
  if (trilha.atual !== rota) setTrilha({ atual: rota, anterior: trilha.atual });
  const puxador = useRef<HTMLDivElement>(null);
  const volta = pai(rota);
  const origem = trilha.anterior && !ehFormulario(trilha.anterior) ? trilha.anterior : null;

  // passou do título grande, ele aparece no topo
  useEffect(() => {
    let quadro = 0;
    const ver = () => {
      quadro = 0;
      const h1 = document.querySelector("main h1");
      const passou = !!h1 && h1.getBoundingClientRect().bottom < 56;
      setRolou(passou ? (rota === "/painel" ? "Início" : (h1.textContent ?? "")) : null);
    };
    const rolar = () => {
      if (!quadro) quadro = requestAnimationFrame(ver);
    };
    rolar();
    addEventListener("scroll", rolar, { passive: true });
    return () => {
      removeEventListener("scroll", rolar);
      cancelAnimationFrame(quadro);
    };
  }, [rota]);

  // voltou pro app depois de um tempo: dados novos sem precisar tocar em nada
  useEffect(() => {
    let saiu = 0;
    const ver = () => {
      if (document.visibilityState === "hidden") saiu = Date.now();
      else if (saiu && Date.now() - saiu > 15_000) router.refresh();
    };
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, [router]);

  // teclado aberto: a barra de abas sai da frente
  useEffect(() => {
    const digita = (e: Event) => (e.target as HTMLElement).matches?.("input:not([type=checkbox],[type=radio],[type=date],[type=button]),textarea");
    const abre = (e: Event) => {
      if (digita(e)) document.documentElement.dataset.teclado = "";
    };
    const fecha = () => delete document.documentElement.dataset.teclado;
    document.addEventListener("focusin", abre);
    document.addEventListener("focusout", fecha);
    return () => {
      document.removeEventListener("focusin", abre);
      document.removeEventListener("focusout", fecha);
      fecha();
    };
  }, []);

  // puxar pra atualizar (na tela inicial o iPhone não tem o do Safari). Mexe direto no elemento: 60 fps sem renderizar
  useEffect(() => {
    if (!ehApp()) return;
    const LIMITE = 72;
    let y0 = 0;
    let x0 = 0;
    let puxando = false;
    let d = 0;
    const el = () => puxador.current!;
    const desenhar = () => {
      el().style.transform = `translate(-50%, ${Math.min(d, 96) - 52}px) rotate(${d * 3}deg)`;
      el().style.opacity = String(Math.min(1, d / LIMITE));
    };
    const comeca = (e: TouchEvent) => {
      puxando = scrollY <= 0 && e.touches.length === 1 && !(e.target as Element).closest("dialog,[data-sem-puxar]");
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      d = 0;
    };
    const move = (e: TouchEvent) => {
      if (!puxando) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || Math.abs(e.touches[0].clientX - x0) > dy || scrollY > 0) {
        if (d) solta();
        puxando = false;
        return;
      }
      el().style.transition = "none";
      d = dy * 0.5;
      desenhar();
    };
    const solta = () => {
      if (!puxando && !d) return;
      puxando = false;
      el().style.transition = "";
      const valeu = d > LIMITE;
      d = 0;
      el().style.transform = "";
      el().style.opacity = "";
      if (valeu) iniciar(() => router.refresh());
    };
    addEventListener("touchstart", comeca, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", solta, { passive: true });
    addEventListener("touchcancel", solta, { passive: true });
    return () => {
      removeEventListener("touchstart", comeca);
      removeEventListener("touchmove", move);
      removeEventListener("touchend", solta);
      removeEventListener("touchcancel", solta);
    };
  }, [router]);

  return (
    <header className="topo-celular sticky top-0 z-40 bg-[#2b1c15] text-white lg:hidden print:hidden">
      <div className="relative flex h-12 items-center px-1">
        {volta ? (
          <button
            type="button"
            onClick={() => {
              if (origem && history.length > 1) router.back();
              else router.push(document.querySelector("main [data-voltar]")?.getAttribute("href") ?? volta);
            }}
            className="flex h-12 min-w-12 items-center pr-3 pl-1.5 text-ouro active:opacity-60"
          >
            <ChevronLeft className="size-7" strokeWidth={2} aria-hidden />
            <span className="text-[17px]">{nomeDa(origem ?? volta)}</span>
          </button>
        ) : (
          <span className={`flex items-center gap-2.5 pl-3 transition-opacity duration-200 ${rolou ? "opacity-0" : ""}`}>
            <IconeEggs className="size-8" />
            <span className="font-eggs text-xl font-extrabold tracking-tight">Santimelo</span>
          </span>
        )}
        <span aria-hidden className={`pointer-events-none absolute inset-y-0 left-1/2 flex max-w-[46%] -translate-x-1/2 items-center transition-[opacity,translate] duration-200 ${rolou ? "" : "translate-y-1 opacity-0"}`}>
          <span className="truncate text-[17px] font-semibold">{rolou}</span>
        </span>
        <button type="button" onClick={() => iniciar(() => router.refresh())} aria-label="Atualizar" className="ml-auto grid size-12 place-items-center text-white/75 active:opacity-60">
          <RefreshCw className={`size-5 ${atualizando ? "animate-spin" : ""}`} strokeWidth={2} />
        </button>
      </div>
      <div ref={puxador} className={`puxador ${atualizando ? "puxador-ativo" : ""}`} aria-hidden>
        <RefreshCw className={`size-5 ${atualizando ? "animate-spin" : ""}`} strokeWidth={2.25} />
      </div>
    </header>
  );
}

export function AbasCelular({ contadores, nome, sair }: { contadores: Record<string, number>; nome: string; sair: () => Promise<void> }) {
  const rota = usePathname();
  const [folha, setFolha] = useState<"lancar" | "mais" | null>(null);
  const fechar = () => setFolha(null);
  const noMais = MAIS.some((h) => ativa(h, rota));
  const pendentesNoMais = contadores["/painel/atendimentos"] ?? 0;
  const classe = (on: boolean) => `relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-100 active:opacity-60 ${on ? "text-terra" : "text-stone-500"}`;

  return (
    <>
      <nav className="abas-celular lg:hidden print:hidden" aria-label="Principal">
        {ABAS.map((href) => {
          if (!href)
            return (
              <button key="lancar" type="button" onClick={() => setFolha("lancar")} aria-haspopup="dialog" aria-label="Lançar" className="flex h-14 items-center justify-center active:scale-95">
                <span className="grid size-12 place-items-center rounded-2xl bg-ouro text-terra">
                  <Plus className="size-7" strokeWidth={2.25} />
                </span>
              </button>
            );
          const { rotulo, icone } = item(href);
          const on = ativa(href, rota);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={on ? "page" : undefined}
              className={classe(on)}
              onClick={(e) => {
                // tocar na aba em que já está: volta pro topo, como nos apps do iPhone
                if (rota !== href) return;
                e.preventDefault();
                scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Bolinha n={contadores[href] ?? 0} />
              <Icone Icone={icone} forte={on} />
              {rotulo}
            </Link>
          );
        })}
        <button type="button" onClick={() => setFolha("mais")} aria-haspopup="dialog" className={classe(noMais)}>
          <Bolinha n={pendentesNoMais} />
          <LayoutGrid className="size-6" strokeWidth={noMais ? 2.25 : 1.75} aria-hidden />
          Mais
        </button>
      </nav>

      <Folha aberta={folha === "lancar"} aoFechar={fechar} titulo="Lançar">
        <ul className="px-2 pb-2">
          {LANCAR.map(({ href, rotulo, detalhe, icone: I }, n) => (
            <li key={href}>
              <Link href={href} onClick={fechar} className="flex min-h-16 items-center gap-4 rounded-2xl px-3 py-2 active:bg-stone-100">
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${n === 0 ? "bg-ouro text-terra" : "bg-concha text-noz"}`}>
                  <I className="size-[22px]" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold text-marca-950">{rotulo}</span>
                  <span className="block text-[15px] text-stone-500">{detalhe}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Folha>

      <Folha aberta={folha === "mais"} aoFechar={fechar} titulo="Mais">
        <ul className="grid grid-cols-3 gap-x-1 gap-y-2 px-3 pb-3">
          {MAIS.map((href) => {
            const { rotulo, icone: I } = item(href);
            const on = ativa(href, rota);
            const n = contadores[href] ?? 0;
            return (
              <li key={href}>
                <Link href={href} onClick={fechar} aria-current={on ? "page" : undefined} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl px-1 text-center active:bg-stone-100">
                  <span className={`relative grid size-[52px] place-items-center rounded-2xl ${on ? "bg-terra text-ouro" : "bg-concha text-noz"}`}>
                    <I className="size-6" strokeWidth={1.75} aria-hidden />
                    {n > 0 && (
                      <span className="tabular absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pimenta px-1 text-xs font-bold text-white" aria-label={`${n} pendentes`}>
                        {n}
                      </span>
                    )}
                  </span>
                  <span className="text-[14px] leading-tight font-medium text-marca-950">{ROTULO_CURTO[href] ?? rotulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mx-5 flex min-h-14 items-center justify-between border-t border-stone-200">
          <span className="truncate text-[15px] text-stone-600">{nome}</span>
          <form action={sair}>
            <button className="-mr-2 flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-medium text-red-700 active:bg-red-50">
              <LogOut className="size-[18px]" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </Folha>
    </>
  );
}
