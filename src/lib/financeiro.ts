import { diaISO, inicioDoDia, somarDias } from "./datas";
import { db } from "./db";

/**
 * Situação de cada conta no app do cliente. Tudo que não foi pago soma no "em aberto" assim que o pedido é feito:
 * AGENDADA = pedido ainda não entregue (vence N dias depois da entrega) · ABERTA = entregue, dentro do prazo
 * VENCIDA = entregue e passou do vencimento · PAGA
 */
export type SituacaoConta = "AGENDADA" | "ABERTA" | "VENCIDA" | "PAGA";

const centavos = (v: number) => Math.round(v * 100) / 100;
export const diasEntre = (de: string, ate: string) => Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / 864e5);

/** Extrato do cliente: cada cobrança com o pedido, a situação e os totais (em aberto, vencido, agendado, pago) */
export async function extratoDoCliente(clienteId: string) {
  const hoje = diaISO();
  const cobrancas = await db.cobranca.findMany({
    where: { clienteId },
    include: { pedido: { include: { itens: { include: { produto: { include: { item: true } } } } } } },
  });

  const linhas = cobrancas
    .map((c) => {
      const entrega = c.pedido ? diaISO(c.pedido.dataEntrega) : c.vencimento;
      const situacao: SituacaoConta = c.pagoEm ? "PAGA" : entrega > hoje ? "AGENDADA" : c.vencimento < hoje ? "VENCIDA" : "ABERTA";
      return { ...c, entrega, situacao };
    })
    .sort((a, b) => b.entrega.localeCompare(a.entrega) || (b.pedidoId ?? 0) - (a.pedidoId ?? 0));

  const soma = (lista: typeof linhas) => centavos(lista.reduce((t, l) => t + l.valor, 0));
  const abertas = linhas.filter((l) => l.situacao !== "PAGA").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const vencidas = abertas.filter((l) => l.situacao === "VENCIDA");
  const desde30 = somarDias(hoje, -30);

  return {
    hoje,
    linhas,
    emAberto: soma(abertas),
    contasAbertas: abertas.length,
    vencido: soma(vencidas),
    vencidaMaisAntiga: vencidas[0] ?? null,
    proximoVencimento: abertas.find((l) => l.situacao !== "VENCIDA") ?? null,
    agendado: soma(linhas.filter((l) => l.situacao === "AGENDADA")),
    pago30: soma(linhas.filter((l) => l.pagoEm && diaISO(l.pagoEm) >= desde30)),
  };
}
