import { Truck } from "lucide-react";
import { DIAS_SEMANA } from "@/lib/constantes";
import { diaDaSemana, diaISO, formatarDia, formatarHora } from "@/lib/datas";
import { reais } from "@/lib/formato";
import { Guinho } from "../../guinho";
import { Brilho } from "../enfeites";

const CORES = ["bg-gema-500", "bg-tomate-500", "bg-green-500", "bg-casca-900", "bg-gema-400", "bg-white"];

/** Última etapa da compra: parabéns, quando chega e o frete grátis */
export function PedidoFeito({ pedido }: { pedido: { id: number; total: number; dataEntrega: Date; janela: { inicio: string; fim: string } | null } }) {
  const dia = diaISO(pedido.dataEntrega);
  return (
    <section className="eggs-entra relative mt-4 overflow-hidden rounded-[28px] bg-gema-400 p-5 text-casca-900 shadow-[0_12px_32px_rgba(245,168,0,0.35)]" aria-live="polite">
      {Array.from({ length: 18 }, (_, n) => (
        <span
          key={n}
          aria-hidden
          className={`eggs-confete pointer-events-none absolute top-0 h-3 w-1.5 rounded-sm ${CORES[n % CORES.length]}`}
          style={{ left: `${(n * 37) % 100}%`, animationDelay: `${(n % 6) * 120}ms` }}
        />
      ))}
      <Brilho className="right-28 top-6 text-xl text-white" />
      <Brilho className="left-[45%] top-3 text-sm text-white" />

      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-casca-700">Pedido #{pedido.id} confirmado</p>
          <h2 className="mt-1 font-eggs text-[2rem] font-extrabold leading-[1.05]">Parabéns pela compra!</h2>
        </div>
        <Guinho pose="comemorando" className="eggs-balanca -mr-1 -mt-1 h-28 w-24 shrink-0" />
      </div>

      <p className="relative mt-2 text-base font-medium">Seu pedido será preparado com carinho e será entregue na data combinada.</p>

      <div className="relative mt-4 rounded-2xl bg-white/85 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-casca-500">Entrega</p>
        <p className="font-eggs text-xl font-extrabold">
          {DIAS_SEMANA[diaDaSemana(dia)]}, {formatarDia(dia, { day: "2-digit", month: "2-digit" })}
        </p>
        <p className="text-sm text-casca-700">
          {pedido.janela ? `entre ${pedido.janela.inicio} e ${pedido.janela.fim}` : `às ${formatarHora(pedido.dataEntrega)}`} · total {reais(pedido.total)}
        </p>
      </div>

      <p className="eggs-pula relative mt-3 flex items-center gap-2.5 rounded-2xl bg-green-600 px-4 py-3 font-eggs text-lg font-extrabold text-white">
        <Truck className="size-6 shrink-0" /> E você recebeu frete grátis!
      </p>
    </section>
  );
}
