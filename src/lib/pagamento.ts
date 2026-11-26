import { z } from "zod";
import { somarDias } from "./datas";

// Como o cliente vai pagar cada pedido. Escolhido no lançamento pela equipe; pedido do app (ou antigo) não tem
// escolha própria e segue o combinado no cadastro do cliente.

export const FORMAS_DO_PEDIDO = ["Dinheiro", "Pix"] as const;
export type FormaDoPedido = (typeof FORMAS_DO_PEDIDO)[number];
/** À vista = paga no dia da entrega. A prazo = na data escolhida */
export const CONDICOES_DO_PEDIDO = { VISTA: "À vista", PRAZO: "A prazo" } as const;
export type CondicaoDoPedido = keyof typeof CONDICOES_DO_PEDIDO;

export const esquemaPagamento = z.object({
  formaPagamento: z.enum(FORMAS_DO_PEDIDO, "Escolha dinheiro ou Pix"),
  condicaoPagamento: z.enum(["VISTA", "PRAZO"], "Escolha à vista ou a prazo"),
  /** "AAAA-MM-DD", só a prazo */
  vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data do pagamento")
    .nullable(),
});
export type PagamentoEscolhido = z.infer<typeof esquemaPagamento>;

/** Confere a data do prazo contra o dia da entrega. Devolve o erro, ou o que gravar no pedido */
export function validarPagamento(p: PagamentoEscolhido, entrega: string): { erro: string } | { dados: PagamentoEscolhido } {
  if (p.condicaoPagamento === "VISTA") return { dados: { ...p, vencimento: null } };
  if (!p.vencimento) return { erro: "Escolha a data do pagamento a prazo." };
  if (p.vencimento < entrega) return { erro: "A data do pagamento não pode ser antes da entrega." };
  return { dados: p };
}

type Pedido = { formaPagamento: string | null; condicaoPagamento: string | null; vencimento: string | null };
type Cliente = { formaPagamento: string | null; prazoPagamentoDias: number | null };

/** O que vale pra esse pedido: a escolha do lançamento ou o combinado com o cliente */
export function pagamentoDoPedido(pedido: Pedido, cliente: Cliente) {
  const condicao: CondicaoDoPedido = pedido.condicaoPagamento ? (pedido.condicaoPagamento === "PRAZO" ? "PRAZO" : "VISTA") : cliente.prazoPagamentoDias ? "PRAZO" : "VISTA";
  return { forma: pedido.formaPagamento ?? cliente.formaPagamento, condicao };
}

/** Dia em que o pedido vence, a partir do dia da entrega */
export function vencimentoDoPedido(pedido: Pedido, cliente: Cliente, entrega: string) {
  if (pedido.condicaoPagamento === "VISTA") return entrega;
  if (pedido.condicaoPagamento === "PRAZO" && pedido.vencimento) return pedido.vencimento;
  return somarDias(entrega, cliente.prazoPagamentoDias ?? 0);
}
