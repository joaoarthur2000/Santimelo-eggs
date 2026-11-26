"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

function Girando({ texto }: { texto: string }) {
  return (
    <>
      <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current" aria-hidden /> {texto}
    </>
  );
}

/** Botão de formulário que responde na hora do toque: trava e mostra que está salvando */
export function BotaoEnviar({ children, enviando = "Salvando…", className = "botao-primario" }: { children: React.ReactNode; enviando?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? <Girando texto={enviando} /> : children}
    </button>
  );
}

/**
 * Igual, mas no dedo pede um segundo toque pra confirmar (dinheiro e estoque: esbarrão não pode valer).
 * No mouse continua com um clique só.
 */
export function BotaoConfirma({ children, confirmar, enviando = "Salvando…", className = "botao-secundario" }: { children: React.ReactNode; confirmar: string; enviando?: string; className?: string }) {
  const [armado, setArmado] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armado) return;
    const id = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(id);
  }, [armado]);
  return (
    <button
      disabled={pending}
      className={`${className} ${armado && !pending ? "botao-armado" : ""}`}
      onClick={(e) => {
        if (armado) return setArmado(false); // segundo toque: segue o envio e desarma
        if (!matchMedia("(pointer: coarse)").matches) return;
        e.preventDefault();
        setArmado(true);
      }}
    >
      {pending ? <Girando texto={enviando} /> : armado ? confirmar : children}
    </button>
  );
}
