"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(max-width: 640px)";
const assinar = (f: () => void) => {
  const m = matchMedia(CONSULTA);
  m.addEventListener("change", f);
  return () => m.removeEventListener("change", f);
};

/** Tela de celular (pra gráfico, que não se ajusta por CSS) */
export const useEstreito = () => useSyncExternalStore(assinar, () => matchMedia(CONSULTA).matches, () => false);
