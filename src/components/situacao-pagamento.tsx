import { diaISO, formatarDia } from "@/lib/datas";
import { pagamentoDoPedido } from "@/lib/pagamento";

type ComPagamento = {
  status: string;
  formaPagamento: string | null;
  condicaoPagamento: string | null;
  vencimento: string | null;
  cliente: { formaPagamento: string | null; prazoPagamentoDias: number | null };
  cobranca: { pagoEm: Date | null; vencimento: string } | null;
};

/** "Pix · em aberto até 02/12": como o pedido é pago e se o valor ainda está em aberto */
export function SituacaoPagamento({ pedido: p }: { pedido: ComPagamento }) {
  if (p.status === "CANCELADO" || !p.cobranca) return <span className="text-stone-400">—</span>;
  const { pagoEm, vencimento } = p.cobranca;
  const vencido = !pagoEm && vencimento < diaISO();
  const dia = formatarDia(vencimento, { day: "2-digit", month: "2-digit" });
  return (
    <>
      {pagamentoDoPedido(p, p.cliente).forma ?? "Sem forma"}
      <span className={`block text-xs font-medium ${pagoEm ? "text-emerald-700" : vencido ? "text-red-700" : "text-amber-800"}`}>{pagoEm ? "pago" : vencido ? `em aberto, venceu ${dia}` : `em aberto até ${dia}`}</span>
    </>
  );
}
