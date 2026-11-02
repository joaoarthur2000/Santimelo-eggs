import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatarDia, somarDias } from "@/lib/datas";

export function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-marca-950">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-stone-500 first-letter:uppercase">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-bold text-marca-950">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-stone-500">{detalhe}</p>}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">{children}</p>;
}

/** Navegação ‹ dia › que preserva a rota atual via ?dia= */
export function SeletorDia({ dia, rota }: { dia: string; rota: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={`${rota}?dia=${somarDias(dia, -1)}`} className="botao-secundario px-2" aria-label="Dia anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <form action={rota} className="contents">
        <input type="date" name="dia" defaultValue={dia} className="campo w-auto" />
        <button className="botao-secundario">Ir</button>
      </form>
      <Link href={`${rota}?dia=${somarDias(dia, 1)}`} className="botao-secundario px-2" aria-label="Próximo dia">
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

export function tituloDia(dia: string) {
  return formatarDia(dia);
}

const CORES_STATUS: Record<string, string> = {
  NOVO: "bg-sky-100 text-sky-800",
  SEPARACAO: "bg-amber-100 text-amber-800",
  ENTREGA: "bg-violet-100 text-violet-800",
  ENTREGUE: "bg-green-100 text-green-800",
  CANCELADO: "bg-stone-200 text-stone-600",
};

export function Etiqueta({ status, children }: { status: string; children: React.ReactNode }) {
  return <span className={`etiqueta ${CORES_STATUS[status] ?? "bg-stone-100 text-stone-700"}`}>{children}</span>;
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
      className={`overflow-hidden rounded-full bg-stone-200 ${grossa ? "h-3" : "h-1.5"}`}
    >
      <div className={`h-full rounded-full ${v >= 1 ? "bg-marca-600" : "bg-marca-400"}`} style={{ width: `${v * 100}%` }} />
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
