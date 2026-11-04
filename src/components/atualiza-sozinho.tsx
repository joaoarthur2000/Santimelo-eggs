"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da página de tempo em tempo (gráficos "ao vivo") sem perder o que está na tela */
export function AtualizaSozinho({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
      <span className="size-2 animate-pulse rounded-full bg-marca-500" aria-hidden /> ao vivo · atualiza a cada {segundos} s
    </span>
  );
}

/** Igual, sem nada na tela (conversas: busca mensagem nova de tempo em tempo) */
export function RecarregaSozinho({ segundos = 8 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
