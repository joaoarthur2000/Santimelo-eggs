"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Guinho em 3D (só na aba Início). O three.js é carregado sob demanda, então as outras abas
 * não pagam o peso. Enquanto carrega, ou se o aparelho não tiver WebGL, aparece o Guinho em PNG.
 */
export function Guinho3D({ className = "" }: { className?: string }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const [dica, setDica] = useState(true);

  useEffect(() => {
    let desmontar: (() => void) | undefined;
    let ativo = true;
    import("./guinho-cena")
      .then(({ montarGuinho }) => {
        if (!ativo || !tela.current) return;
        desmontar = montarGuinho(tela.current);
        setPronto(true);
      })
      .catch(() => {
        /* sem WebGL: fica o PNG */
      });
    const t = setTimeout(() => setDica(false), 6000);
    return () => {
      ativo = false;
      clearTimeout(t);
      desmontar?.();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/eggs/guinho/guinho-acenando.png"
        alt=""
        className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${pronto ? "opacity-0" : "opacity-100"}`}
      />
      <canvas
        ref={tela}
        role="img"
        aria-label="Guinho, o mascote do EGGS, acenando"
        onPointerDown={() => setDica(false)}
        className={`relative size-full cursor-pointer touch-none transition-opacity duration-300 ${pronto ? "opacity-100" : "opacity-0"}`}
      />
      {pronto && dica && (
        <span className="eggs-entra pointer-events-none absolute -left-3 top-1 rounded-full bg-casca-900 px-2.5 py-1 text-[11px] font-bold text-gema-200 shadow">
          toca em mim!
        </span>
      )}
    </div>
  );
}
