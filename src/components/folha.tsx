"use client";

import { useEffect, useRef } from "react";

const DURACAO = 260;

/**
 * Folha que sobe do rodapé (celular). Fecha arrastando a alça pra baixo, tocando fora ou com Esc.
 * É um <dialog> nativo: foco preso e leitura de tela certos sem biblioteca.
 */
export function Folha({ aberta, aoFechar, titulo, children }: { aberta: boolean; aoFechar: () => void; titulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const arrasto = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (aberta) {
      delete el.dataset.fechando;
      el.style.transform = "";
      if (!el.open) el.showModal();
      el.focus({ preventScroll: true }); // foco na folha, sem marcar o primeiro item
      return;
    }
    if (el.open) {
      el.dataset.fechando = "";
      el.style.transform = "";
      const id = setTimeout(() => el.close(), DURACAO);
      return () => clearTimeout(id);
    }
  }, [aberta]);

  function soltar(y: number, t: number) {
    const a = arrasto.current;
    const el = ref.current;
    if (!a || !el) return;
    const d = y - a.y;
    const rapido = d / Math.max(1, t - a.t) > 0.5;
    arrasto.current = null;
    delete el.dataset.arrastando;
    if (d > 96 || (rapido && d > 24)) aoFechar();
    else el.style.transform = "";
  }

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={titulo}
      className="folha"
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        className="folha-alca"
        onPointerDown={(e) => {
          arrasto.current = { y: e.clientY, t: e.timeStamp };
          e.currentTarget.setPointerCapture(e.pointerId);
          if (ref.current) ref.current.dataset.arrastando = "";
        }}
        onPointerMove={(e) => {
          if (arrasto.current && ref.current) ref.current.style.transform = `translateY(${Math.max(0, e.clientY - arrasto.current.y)}px)`;
        }}
        onPointerUp={(e) => soltar(e.clientY, e.timeStamp)}
        onPointerCancel={(e) => soltar(arrasto.current?.y ?? 0, e.timeStamp)}
      >
        <span className="block h-1.5 w-10 rounded-full bg-stone-300" aria-hidden />
      </div>
      {children}
    </dialog>
  );
}
