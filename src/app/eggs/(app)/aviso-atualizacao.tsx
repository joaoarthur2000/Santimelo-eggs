"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const INTERVALO_MS = 60_000;

/**
 * Compara a versão com que o app abriu com a do servidor (a cada minuto e sempre que o app volta pra
 * frente da tela). Mudou = mostra o aviso com as novidades e um botão pra recarregar.
 */
export function AvisoAtualizacao({ versao }: { versao: string }) {
  const [novidade, setNovidade] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function conferir() {
      try {
        const r = await fetch("/eggs/versao", { cache: "no-store" });
        const dados: { versao: string; novidades: string } = await r.json();
        if (ativo && dados.versao !== versao) setNovidade(dados.novidades || "Melhoramos o app pra você.");
      } catch {
        // Sem internet: tenta de novo na próxima
      }
    }
    const quandoVoltar = () => document.visibilityState === "visible" && conferir();
    const id = setInterval(conferir, INTERVALO_MS);
    document.addEventListener("visibilitychange", quandoVoltar);
    return () => {
      ativo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", quandoVoltar);
    };
  }, [versao]);

  if (!novidade) return null;
  return (
    <div role="status" className="eggs-entra fixed inset-x-3 top-3 z-50 mx-auto max-w-xl rounded-3xl bg-casca-900 p-4 text-gema-50 shadow-2xl">
      <p className="flex items-center gap-2 font-eggs text-lg font-extrabold">
        <Sparkles className="eggs-balanca size-5 text-gema-400" /> Tem novidade no EGGS!
      </p>
      <p className="mt-1 text-sm text-gema-200">{novidade}</p>
      <button type="button" onClick={() => location.reload()} className="mt-3 w-full rounded-2xl bg-gema-400 py-2.5 font-bold text-casca-900">
        Atualizar agora
      </button>
    </div>
  );
}
