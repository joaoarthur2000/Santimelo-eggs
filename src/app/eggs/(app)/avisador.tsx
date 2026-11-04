"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Aviso = { tipo: "etapa" | "chat"; etapa: string; texto: string; em: string; link: string };

const CHAVE = "eggs.avisos.desde";
const CADA_MS = 10_000;

const VISUAL: Record<string, { titulo: string; pose: string; notas: number[] }> = {
  SEPARACAO: { titulo: "Separando seu pedido!", pose: "joinha", notas: [660, 880] },
  ENTREGA: { titulo: "Saiu pra entrega!", pose: "acenando", notas: [660, 880, 990] },
  ENTREGUE: { titulo: "Pedido entregue!", pose: "comemorando", notas: [880, 990, 1320] },
  chat: { titulo: "Mensagem da Santimelo", pose: "paz", notas: [880, 660] },
};

const ler = () => {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
};
const gravar = (v: string) => {
  try {
    localStorage.setItem(CHAVE, v);
  } catch {}
};

/**
 * Avisa o cliente quando o pedido muda de etapa (em separação, saiu pra entrega, entregue) e quando a
 * equipe responde no chat: Guinho na tela, som e vibração. Funciona com o app aberto (consulta a cada 10 s
 * e quando o app volta pra frente). iPhone não vibra pelo navegador; o som toca depois do primeiro toque na tela.
 */
export function Avisador() {
  const router = useRouter();
  const [fila, setFila] = useState<Aviso[]>([]);
  const audio = useRef<AudioContext | null>(null);

  // Navegador só libera som depois de um toque: prepara o áudio no primeiro toque
  useEffect(() => {
    const liberar = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {}
    };
    window.addEventListener("pointerdown", liberar, { once: true });
    return () => window.removeEventListener("pointerdown", liberar);
  }, []);

  useEffect(() => {
    let parado = false;
    async function consultar() {
      if (document.visibilityState !== "visible") return;
      const desde = ler();
      try {
        const r = await fetch(`/eggs/avisos${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`, { cache: "no-store" });
        if (!r.ok || parado) return;
        const d = (await r.json()) as { avisos: Aviso[]; agora: string };
        gravar(d.agora);
        // Primeira vez neste celular: só marca o ponto de partida, sem avisar coisa antiga
        if (desde && d.avisos.length) {
          setFila((f) => [...f, ...d.avisos]);
          router.refresh();
        }
      } catch {}
    }
    consultar();
    const id = setInterval(consultar, CADA_MS);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      parado = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [router]);

  const atual = fila[0];
  const visual = atual ? (VISUAL[atual.tipo === "chat" ? "chat" : atual.etapa] ?? VISUAL.chat) : null;

  // Som (sininho com Web Audio, sem arquivo) e vibração a cada aviso novo na tela
  useEffect(() => {
    if (!visual) return;
    try {
      navigator.vibrate?.([220, 120, 220, 120, 320]);
    } catch {}
    const ctx = audio.current;
    if (!ctx) return;
    visual.notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.type = "sine";
      osc.frequency.value = freq;
      volume.gain.setValueAtTime(0.0001, t);
      volume.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(volume).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }, [atual, visual]);

  if (!atual || !visual) return null;
  const fechar = () => setFila((f) => f.slice(1));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-casca-900/50 p-4 backdrop-blur-sm sm:items-center" role="alertdialog" aria-labelledby="aviso-titulo" aria-describedby="aviso-texto">
      <div className="eggs-entra relative w-full max-w-sm overflow-hidden rounded-[28px] bg-gema-50 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center shadow-[0_20px_60px_rgba(61,38,20,0.35)]">
        {atual.etapa === "ENTREGUE" &&
          ["🥚", "✨", "🐣", "✨", "🥚"].map((c, i) => (
            <span key={i} className="eggs-confete pointer-events-none absolute top-0 text-2xl" style={{ left: `${10 + i * 20}%`, animationDelay: `${i * 0.2}s` }} aria-hidden>
              {c}
            </span>
          ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/eggs/guinho/guinho-${visual.pose}.png`} alt="" className="eggs-pulo mx-auto h-40" />
        <h2 id="aviso-titulo" className="mt-2 font-eggs text-3xl font-extrabold">{visual.titulo}</h2>
        <p id="aviso-texto" className="mt-2 text-casca-700">{atual.texto}</p>
        <div className="mt-5 grid gap-2">
          <Link href={atual.link} onClick={fechar} className="rounded-2xl bg-casca-900 py-3.5 font-bold text-gema-50">
            {atual.tipo === "chat" ? "Abrir conversa" : "Ver meus pedidos"}
          </Link>
          <button type="button" onClick={fechar} className="rounded-2xl py-3 font-semibold text-casca-700">
            {fila.length > 1 ? `Ok (mais ${fila.length - 1})` : "Ok"}
          </button>
        </div>
      </div>
    </div>
  );
}
