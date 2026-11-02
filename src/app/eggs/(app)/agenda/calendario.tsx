import { diaDaSemana, diaISO, formatarDia, somarDias } from "@/lib/datas";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"]; // começa no domingo, como calendário brasileiro

/** Meses (AAAA-MM) que o período de hoje até `ate` cobre */
function mesesAte(hoje: string, ate: string) {
  const meses: string[] = [];
  for (let d = `${hoje.slice(0, 7)}-01`; d.slice(0, 7) <= ate.slice(0, 7); ) {
    meses.push(d.slice(0, 7));
    const [a, m] = d.split("-").map(Number);
    d = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  }
  return meses;
}

/**
 * Calendário do mês (com o ano) mostrando os dias de entrega da região e os pedidos do cliente.
 * Dias da semana calculados no fuso de Porto Alegre (datas.ts), então batem com o calendário real.
 */
export function CalendarioEntregas({ diasEntrega, diasPedido, ate }: { diasEntrega: string[]; diasPedido: string[]; ate: string }) {
  const hoje = diaISO();
  const entrega = new Set(diasEntrega);
  const pedido = new Set(diasPedido);

  return (
    <div className="space-y-4">
      {mesesAte(hoje, ate).map((mes) => {
        const [ano, m] = mes.split("-").map(Number);
        const primeiro = `${mes}-01`;
        const totalDias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
        const vazios = diaDaSemana(primeiro);
        const dias = Array.from({ length: totalDias }, (_, i) => somarDias(primeiro, i));
        return (
          <section key={mes} className="cartao-eggs">
            <h3 className="font-eggs text-2xl font-extrabold first-letter:uppercase">
              {formatarDia(primeiro, { month: "long" })} <span className="text-gema-600">{ano}</span>
            </h3>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {SEMANA.map((s, i) => (
                <span key={i} className={`pb-1 text-xs font-bold ${i === 0 ? "text-tomate-500" : "text-casca-500"}`}>{s}</span>
              ))}
              {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
              {dias.map((d) => {
                const passado = d < hoje;
                const ehHoje = d === hoje;
                const temPedido = pedido.has(d);
                const temEntrega = entrega.has(d);
                return (
                  <span
                    key={d}
                    title={formatarDia(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    className={`relative flex aspect-square items-center justify-center rounded-2xl text-sm font-bold tabular ${
                      temPedido
                        ? "bg-casca-900 text-gema-50"
                        : temEntrega
                          ? "bg-gema-400 text-casca-900"
                          : passado
                            ? "text-casca-300"
                            : "text-casca-700"
                    } ${ehHoje ? "ring-2 ring-tomate-500 ring-offset-1" : ""}`}
                  >
                    {Number(d.slice(8))}
                    {temPedido && <span className="absolute bottom-1 size-1.5 rounded-full bg-gema-400" />}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-casca-700">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-gema-400" /> Dia de entrega</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-casca-900" /> Seu pedido</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-tomate-500" /> Hoje</li>
      </ul>
    </div>
  );
}
