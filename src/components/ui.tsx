import { formatarDia } from "@/lib/datas";

export { SeletorDia } from "./seletor-dia";

/** `explica`: o subtítulo só explica a tela (no celular some, pra sobrar espaço). `acoesNoCelular`: falso esconde os botões no celular */
export function Cabecalho({ titulo, subtitulo, explica = false, acoesNoCelular = true, children }: { titulo: string; subtitulo?: string; explica?: boolean; acoesNoCelular?: boolean; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-7 lg:gap-4">
      <div className="min-w-0 max-lg:w-full">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance text-marca-950 lg:text-[26px]">{titulo}</h1>
        {subtitulo && <p className={`mt-1.5 max-w-3xl text-sm text-stone-500 first-letter:uppercase ${explica ? "max-lg:hidden" : ""}`}>{subtitulo}</p>}
      </div>
      {children && <div className={`flex flex-wrap items-center gap-2 max-lg:w-full ${acoesNoCelular ? "" : "max-lg:hidden"}`}>{children}</div>}
    </header>
  );
}

export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao p-4 lg:p-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-stone-500 uppercase max-lg:text-sm max-lg:font-medium">{rotulo}</p>
      <p className="tabular mt-2 text-[22px] leading-none font-semibold tracking-[-0.02em] text-marca-950 lg:text-[26px]">{valor}</p>
      {detalhe && <p className="mt-2 text-xs text-stone-500">{detalhe}</p>}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 px-6 py-10 text-center text-sm text-stone-500">{children}</p>;
}

export function tituloDia(dia: string) {
  return formatarDia(dia);
}

// fundo claro + contorno fino + bolinha da cor: lê de longe sem gritar
const CORES_STATUS: Record<string, [string, string]> = {
  NOVO: ["bg-sky-50 text-sky-700 ring-sky-600/15", "bg-sky-500"],
  SEPARACAO: ["bg-amber-50 text-amber-800 ring-amber-600/20", "bg-amber-500"],
  ENTREGA: ["bg-violet-50 text-violet-700 ring-violet-600/15", "bg-violet-500"],
  ENTREGUE: ["bg-emerald-50 text-emerald-700 ring-emerald-600/15", "bg-emerald-500"],
  CANCELADO: ["bg-stone-100 text-stone-500 ring-stone-500/15", "bg-stone-400"],
};

export function Etiqueta({ status, children }: { status: string; children: React.ReactNode }) {
  const [cor, bolinha] = CORES_STATUS[status] ?? ["bg-stone-100 text-stone-700 ring-stone-500/15", "bg-stone-400"];
  return (
    <span className={`etiqueta ring-1 ring-inset ${cor}`}>
      <span className={`size-1.5 rounded-full ${bolinha}`} aria-hidden />
      {children}
    </span>
  );
}

/** Barra de progresso de 0 a 1 (valores fora disso ficam no limite) */
export function Barra({ valor, rotulo, grossa = false }: { valor: number; rotulo: string; grossa?: boolean }) {
  const v = Math.max(0, Math.min(1, valor));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`overflow-hidden rounded-full bg-stone-200/70 ${grossa ? "h-2.5" : "h-1.5"}`}
    >
      {/* cresce com transform (GPU) em vez de width */}
      <div
        className={`h-full origin-left rounded-full transition-transform duration-700 ease-suave ${v >= 1 ? "bg-folha" : "bg-ouro"}`}
        style={{ transform: `scaleX(${v})` }}
      />
    </div>
  );
}

/** Código do tipo de ovo, em etiqueta gema */
export function Codigo({ codigo, grande = false }: { codigo: string | number | null; grande?: boolean }) {
  if (codigo === null || codigo === "") return null;
  return (
    <span
      className={`tabular inline-flex shrink-0 items-center justify-center rounded-md bg-gema-200 font-bold text-casca-900 ${grande ? "min-w-10 px-2 py-1 text-base" : "min-w-7 px-1.5 py-px text-xs"}`}
    >
      {codigo}
    </span>
  );
}
