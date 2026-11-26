"use client";

import { CampoData } from "@/components/campo-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MEIO_DIA = (dia: string) => new Date(`${dia}T12:00:00-03:00`);
const rotuloDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
const isoDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const somar = (dia: string, n: number) => isoDia.format(new Date(MEIO_DIA(dia).getTime() + n * 864e5));
const bonito = (dia: string) => rotuloDia.format(MEIO_DIA(dia)).replace(/\./g, "").replace(/ de /g, " ");

/**
 * Navegação ‹ dia ›, pela URL (?dia=). No celular: setas grandes e o dia no meio, que abre o seletor do iPhone
 * e já troca (sem "Ir"). `anterior`/`proximo`: quando o passo não é de um dia (semana, mês). `extra`: outros parâmetros da rota.
 */
export function SeletorDia({ dia, rota, rotulo, anterior, proximo, extra = {} }: { dia: string; rota: string; rotulo?: string; anterior?: string; proximo?: string; extra?: Record<string, string> }) {
  const router = useRouter();
  const [indo, iniciar] = useTransition();
  const [escolhido, setEscolhido] = useState(dia);
  const [base, setBase] = useState(dia);
  if (base !== dia) {
    setBase(dia);
    setEscolhido(dia);
  }
  const link = (d: string) => `${rota}?${new URLSearchParams({ ...extra, dia: d })}`;
  const antes = link(anterior ?? somar(dia, -1));
  const depois = link(proximo ?? somar(dia, 1));
  const seta = "grid h-12 w-12 shrink-0 place-items-center text-marca-900 active:bg-stone-100";

  return (
    <>
      <div className="flex flex-1 items-stretch overflow-hidden rounded-xl border border-stone-200 bg-white lg:hidden">
        <Link href={antes} prefetch className={seta} aria-label="Anterior">
          <ChevronLeft className="size-6" />
        </Link>
        <label className="relative flex min-w-0 flex-1 items-center justify-center gap-2 border-x border-stone-200 px-2 active:bg-stone-100">
          {indo ? <span className="size-4 animate-spin rounded-full border-2 border-terra/20 border-t-terra" aria-hidden /> : <CalendarDays className="size-[18px] shrink-0 text-stone-400" aria-hidden />}
          <span className="truncate text-base font-semibold text-marca-950 first-letter:uppercase">{escolhido !== dia ? bonito(escolhido) : (rotulo ?? bonito(dia))}</span>
          <input
            type="date"
            value={escolhido}
            aria-label="Escolher data"
            onChange={(e) => {
              const novo = e.target.value;
              if (!novo) return;
              setEscolhido(novo);
              iniciar(() => router.push(link(novo)));
            }}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          />
        </label>
        <Link href={depois} prefetch className={seta} aria-label="Próximo">
          <ChevronRight className="size-6" />
        </Link>
      </div>

      <div className="hidden items-center gap-1 lg:flex">
        <Link href={antes} className="botao-secundario px-2" aria-label={anterior ? "Período anterior" : "Dia anterior"}>
          <ChevronLeft className="size-4" />
        </Link>
        <form action={rota} className="contents">
          {Object.entries(extra).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <CampoData name="dia" defaultValue={dia} className="campo w-auto" aria-label="Escolher data" />
          <button className="botao-secundario">Ir</button>
        </form>
        <Link href={depois} className="botao-secundario px-2" aria-label={proximo ? "Próximo período" : "Próximo dia"}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </>
  );
}
