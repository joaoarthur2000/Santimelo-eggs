"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, EllipsisVertical, Share, SquarePlus, TriangleAlert, X } from "lucide-react";
import { IconeEggs } from "./marca-eggs";

type Ambiente = "app" | "iphone" | "android" | "outro";
type PedidoAndroid = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome do Android oferece o "instalar" nativo (só em https): guarda o pedido pra usar no botão
let pedidoAndroid: PedidoAndroid | null = null;
const ouvintes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedidoAndroid = e as PedidoAndroid;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    pedidoAndroid = null;
    ouvintes.forEach((f) => f());
  });
}
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

function ambiente(): Ambiente {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || matchMedia("(display-mode: standalone)").matches) return "app";
  if (/iphone|ipad|ipod/i.test(nav.userAgent)) return "iphone";
  if (/android/i.test(nav.userAgent)) return "android";
  return "outro";
}
// Navegador de dentro do Instagram, Facebook, TikTok etc.: dali não dá pra instalar
const naoInstala = () => /instagram|fban|fbav|fb_iab|tiktok|musical_ly|line\//i.test(navigator.userAgent);

const CHAVE = "eggs.instalar.visto";
const REPETIR_MS = 3 * 24 * 60 * 60 * 1000;
function vistoHaPouco() {
  try {
    return Date.now() - Number(localStorage.getItem(CHAVE) ?? 0) < REPETIR_MS;
  } catch {
    return false;
  }
}
function marcarVisto() {
  try {
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {}
}

function useInstalar(automatico: boolean) {
  const onde = useSyncExternalStore<Ambiente>(assinar, ambiente, () => "app");
  const interno = useSyncExternalStore(assinar, naoInstala, () => false);
  const temPedido = useSyncExternalStore(assinar, () => pedidoAndroid !== null, () => false);
  const [aberto, setAberto] = useState(false);

  // Primeiro acesso pelo celular: abre o passo a passo sozinho (de novo só depois de 3 dias)
  useEffect(() => {
    if (!automatico || (onde !== "iphone" && onde !== "android") || vistoHaPouco()) return;
    const t = setTimeout(() => setAberto(true), 1200);
    return () => clearTimeout(t);
  }, [automatico, onde]);

  async function abrir() {
    if (temPedido && pedidoAndroid) {
      await pedidoAndroid.prompt();
      return;
    }
    setAberto(true);
  }
  const fechar = useCallback(() => {
    marcarVisto();
    setAberto(false);
  }, []);

  const janela = aberto && (onde === "iphone" || onde === "android") ? createPortal(<JanelaInstalar onde={onde} interno={interno} fechar={fechar} />, document.body) : null;
  return { onde, abrir, janela };
}

/** Botão "Instalar" do topo. Some quando o EGGS já está aberto pelo ícone ou no computador */
export function BotaoInstalar({ automatico = false }: { automatico?: boolean }) {
  const { onde, abrir, janela } = useInstalar(automatico);
  if (onde === "app" || onde === "outro") return null;
  return (
    <>
      <button type="button" onClick={abrir} className="eggs-toque inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-bold text-casca-900 shadow-sm ring-1 ring-casca-100">
        <Download className="size-4 text-gema-700" /> Instalar
      </button>
      {janela}
    </>
  );
}

/** Cartão "Deixe o EGGS na tela do celular" (aba Conta) */
export function DicaInstalar() {
  const { onde, abrir, janela } = useInstalar(false);
  if (onde === "app" || onde === "outro") return null;
  return (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-3xl bg-gema-100 p-4 text-sm text-casca-900">
      <IconeEggs className="size-11 shrink-0" />
      <p className="min-w-0 flex-1">
        <b className="font-eggs text-base font-extrabold">EGGS na tela do celular</b>
        <br />
        Abre em tela cheia, como app.
      </p>
      <button type="button" onClick={abrir} className="botao-eggs shrink-0 px-4 py-2.5 text-sm">
        Instalar
      </button>
      {janela}
    </div>
  );
}

function JanelaInstalar({ onde, interno, fechar }: { onde: "iphone" | "android"; interno: boolean; fechar: () => void }) {
  // Esc fecha e a página de trás não rola enquanto a janela está aberta
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      removeEventListener("keydown", tecla);
    };
  }, [fechar]);

  const iphone = onde === "iphone";
  const navegador = iphone ? "Safari" : "Chrome";
  const passos = iphone
    ? [
        {
          icone: <Share className="size-5" />,
          texto: (
            <>
              Toque em <b>Compartilhar</b>, o quadrado com a seta. Não achou? Toque antes nos <b>•••</b> da barra de baixo.
            </>
          ),
        },
        {
          icone: <SquarePlus className="size-5" />,
          texto: (
            <>
              Role e escolha <b>Adicionar à Tela de Início</b>.
            </>
          ),
        },
      ]
    : [
        {
          icone: <EllipsisVertical className="size-5" />,
          texto: (
            <>
              Toque nos <b>⋮</b> no canto de cima do Chrome.
            </>
          ),
        },
        {
          icone: <Download className="size-5" />,
          texto: (
            <>
              Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
            </>
          ),
        },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-casca-900/45 p-3 backdrop-blur-sm sm:items-center" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-instalar"
        onClick={(e) => e.stopPropagation()}
        className="eggs-entra w-full max-w-sm rounded-[28px] bg-gema-50 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_20px_60px_rgba(61,38,20,0.35)] ring-1 ring-casca-100"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-instalar" className="font-eggs text-2xl font-extrabold uppercase leading-tight">
            Instalar no {iphone ? "iPhone" : "Android"}
          </h2>
          <button type="button" onClick={fechar} className="-mr-1 -mt-1 rounded-full p-2 text-casca-500 hover:bg-casca-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-casca-700">
          {iphone ? "O iPhone não instala sozinho. São dois toques, no próprio Safari:" : "São dois toques, no próprio Chrome:"}
        </p>

        {interno && (
          <p className="mt-4 flex gap-2.5 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Você abriu por dentro de outro app. Primeiro toque nos <b>•••</b> e escolha <b>Abrir no {navegador}</b>.
            </span>
          </p>
        )}

        <ol className="mt-4 space-y-2.5">
          {passos.map((p, n) => (
            <li key={n} style={{ "--i": n + 1 } as React.CSSProperties} className="eggs-entra flex items-center gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-casca-100">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gema-100 text-gema-700">{p.icone}</span>
              <span>{p.texto}</span>
            </li>
          ))}
          <li style={{ "--i": 3 } as React.CSSProperties} className="eggs-entra flex items-center gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-casca-100">
            <IconeEggs className="size-10 shrink-0" />
            <span>
              Pronto: abra pelo <b>ícone do EGGS</b>. Fica em tela cheia, sem barra do navegador.
            </span>
          </li>
        </ol>

        {!interno && (
          <p className="mt-4 text-xs leading-relaxed text-casca-500">
            Se você abriu o link pelo Instagram ou WhatsApp, não vai funcionar: toque nos três pontinhos e escolha <b>Abrir no {navegador}</b> primeiro.
          </p>
        )}

        <button type="button" onClick={fechar} className="botao-eggs mt-5 w-full">
          Entendi
        </button>
      </div>
    </div>
  );
}
