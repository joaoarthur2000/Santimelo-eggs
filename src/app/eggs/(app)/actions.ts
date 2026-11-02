"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { DIAS_SEMANA } from "@/lib/constantes";
import { diaDaSemana, diaISO, fimDoDia, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { avisarPedidoNoGrupo, produtosDoCliente, sincronizarCobranca } from "@/lib/eggs";
import { reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { enviarProGrupo } from "@/lib/whatsapp";

const esquemaPedido = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o dia da entrega"),
  janelaId: z.string().min(1, "Escolha o horário da entrega"),
  observacao: z.string().max(300).nullable(),
  itens: z.array(z.object({ produtoId: z.string(), quantidade: z.number().positive().max(1000) })).min(1, "Escolha pelo menos um produto"),
});

function atualizar() {
  revalidatePath("/eggs", "layout");
  revalidatePath("/painel", "layout");
}

/** Pedido feito pelo cliente no app: preço e vaga conferidos aqui, nunca o que vem do celular */
export async function fazerPedido(dados: z.infer<typeof esquemaPedido>): Promise<{ erro?: string; id?: number }> {
  const { cliente } = await exigirCliente();
  const r = esquemaPedido.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };
  const { dia, janelaId, observacao, itens } = r.data;

  if (dia <= diaISO() || dia > somarDias(diaISO(), 14)) return { erro: "Escolha um dia de entrega dos próximos 14 dias." };
  const janela = await db.janelaEntrega.findUnique({ where: { id: janelaId } });
  if (!janela || !janela.ativo || janela.regiaoId !== cliente.regiaoId || janela.diaSemana !== diaDaSemana(dia)) {
    return { erro: "Esse horário não está disponível pra sua região. Escolha outro." };
  }
  const ocupados = await db.pedido.count({ where: { janelaId, status: { not: "CANCELADO" }, dataEntrega: { gte: inicioDoDia(dia), lt: fimDoDia(dia) } } });
  if (ocupados >= janela.capacidade) return { erro: "Esse horário acabou de lotar. Escolha outro." };

  const produtos = new Map((await produtosDoCliente(cliente.id)).map((p) => [p.id, p]));
  const linhas = [];
  for (const i of itens) {
    const p = produtos.get(i.produtoId);
    if (!p) return { erro: "Um dos produtos não está mais disponível. Atualize a página." };
    // Caixa vende em meia caixa; bandeja e dúzia, inteiro
    const passo = p.unidade === "caixa" ? 0.5 : 1;
    if (Math.abs(i.quantidade / passo - Math.round(i.quantidade / passo)) > 1e-9) return { erro: `Quantidade inválida em ${p.item}.` };
    linhas.push({ produtoId: p.id, quantidade: i.quantidade, precoUnit: p.preco, subtotal: Math.round(p.preco * i.quantidade * 100) / 100 });
  }

  if (cliente.limiteCredito !== null) {
    const aberto = (await db.cobranca.aggregate({ where: { clienteId: cliente.id, pagoEm: null }, _sum: { valor: true } }))._sum.valor ?? 0;
    const novo = linhas.reduce((s, l) => s + l.subtotal, 0);
    if (aberto + novo > cliente.limiteCredito) {
      return { erro: `Esse pedido passa do seu limite em aberto (${reais(cliente.limiteCredito)}). Fale com a Santimelo ou acerte um pagamento.` };
    }
  }

  const [h, m] = janela.inicio.split(":").map(Number);
  const pedido = await db.pedido.create({
    data: {
      clienteId: cliente.id,
      origem: "APP",
      janelaId,
      observacao,
      dataEntrega: new Date(inicioDoDia(dia).getTime() + (h * 60 + m) * 60 * 1000),
      total: Math.round(linhas.reduce((s, l) => s + l.subtotal, 0) * 100) / 100,
      itens: { create: linhas },
    },
  });
  await sincronizarCobranca(pedido.id);
  await db.mensagem.create({
    data: {
      clienteId: cliente.id,
      tipo: "PEDIDO",
      autor: "Santimelo",
      lidaEm: new Date(),
      texto: `Pedido #${pedido.id} recebido: entrega ${DIAS_SEMANA[janela.diaSemana].toLowerCase()}, ${formatarDia(dia, { day: "2-digit", month: "2-digit" })}, entre ${janela.inicio} e ${janela.fim}. Total ${reais(pedido.total)}.`,
    },
  });
  atualizar();
  // Grupo EGGS-ADM recebe a comanda depois da resposta: o cliente não espera o WhatsApp
  after(() => avisarPedidoNoGrupo(pedido.id));
  return { id: pedido.id };
}

/** Cliente pode cancelar enquanto o pedido não entrou em separação */
export async function cancelarPedido(id: number) {
  const { cliente } = await exigirCliente();
  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.clienteId !== cliente.id || pedido.status !== "NOVO") return;
  await db.pedido.update({ where: { id }, data: { status: "CANCELADO" } });
  await sincronizarCobranca(id);
  atualizar();
  after(() => enviarProGrupo(`❌ *PEDIDO EGGS #${id} CANCELADO* pelo cliente ${cliente.nomeFantasia}.`));
}

export async function marcarMensagensLidas() {
  const { cliente } = await exigirCliente();
  await db.mensagem.updateMany({ where: { clienteId: cliente.id, lidaEm: null }, data: { lidaEm: new Date() } });
  atualizar();
}
