"use client";

import { useState } from "react";
import { POSES_GUINHO } from "../guinho";

/**
 * Guinho da aba Início: ginga parado, como desenho dos anos 30. A cada toque ele pula
 * (estica e amassa) e troca de pose. Só CSS e os PNGs das poses, sem biblioteca.
 */
export function GuinhoAnimado({ className = "" }: { className?: string }) {
  const [vez, setVez] = useState(0);
  const [dica, setDica] = useState(true);
  const pose = POSES_GUINHO[vez % POSES_GUINHO.length];

  return (
    <button
      type="button"
      onClick={() => {
        setVez((v) => v + 1);
        setDica(false);
      }}
      aria-label="Guinho, o mascote do EGGS. Toque pra ele mudar de pose"
      className={`relative cursor-pointer select-none ${className}`}
    >
      {/* Pré-carrega as poses pra troca não piscar */}
      {POSES_GUINHO.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p} src={`/eggs/guinho/guinho-${p}.png`} alt="" aria-hidden className="hidden" />
      ))}
      <span className="eggs-ginga block size-full">
        {/* key muda a cada toque: reinicia a animação do pulo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={vez}
          src={`/eggs/guinho/guinho-${pose}.png`}
          alt=""
          aria-hidden
          className={`pointer-events-none size-full object-contain ${vez ? "eggs-pulo" : ""}`}
        />
      </span>
      {dica && (
        <span className="eggs-entra pointer-events-none absolute -left-3 top-1 rounded-full bg-casca-900 px-2.5 py-1 text-[11px] font-bold text-gema-200 shadow" style={{ "--i": 6 } as React.CSSProperties}>
          toca em mim!
        </span>
      )}
    </button>
  );
}
