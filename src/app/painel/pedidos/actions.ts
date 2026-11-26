"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { STATUS_PEDIDO } from "@/lib/constantes";
import { diaISO, inicioDoDia } from "@/lib/datas";
import { sincronizarCobranca } from "@/lib/eggs";
import { sincronizarBaixaDoPedido } from "@/lib/estoque";
import { reais } from "@/lib/formato";
import { esquemaPagamento, validarPagamento, type PagamentoEscolhido } from "@/lib/pagamento";
import { exigirPapel } from "@/lib/sessao";

/** Mensagem no app do cliente a cada etapa: o app avisa com imagem, som e vibração (ver eggs/(app)/avisador.tsx) */
async function avisarEtapaNoApp(id: number, status: string) {
  const pedido = await db.pedido.findUnique({ where: { id }, include: { janela: true } });
  if (!pedido) return;
  const horario = pedido.janela ? ` entre ${pedido.janela.inicio} e ${pedido.janela.fim}` : "";
  const textos: Record<string, string> = {
    SEPARACAO: `🥚 Seu pedido #${id} está sendo separado agora!`,
    ENTREGA: `🚚 Seu pedido #${id} saiu pra entrega! Chega hoje${horario}.`,
    ENTREGUE: `✅ Pedido #${id} entregue. Obrigado pela preferência!`,
  };
  const texto = textos[status];
  if (!texto) return;
  const chave = `status:${id}:${status}`;
  await db.mensagem.upsert({
    where: { chave },
    update: { texto, criadaEm: new Date(), lidaEm: null },
    create: { chave, clienteId: pedido.clienteId, tipo: "STATUS", autor: "Santimelo", texto },
  });
}

export async function mudarStatus(id: number, status: string) {
  const usuario = await exigirPapel("DIRETOR");
  if (!(status in STATUS_PEDIDO)) throw new Error("Status inválido");
  await db.pedido.update({ where: { id }, data: { status } });
  // Saiu pra entrega = baixa do estoque; voltou ou cancelou = desfaz
  await sincronizarBaixaDoPedido(id, usuario.nome);
  await sincronizarCobranca(id);
  await avisarEtapaNoApp(id, status);
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  revalidatePath("/painel/pedidos");
  revalidatePath(`/painel/pedidos/${id}`);
}

/** Pedido aberto → Entregue (o painel só tem esse passo; pedidos antigos "Em separação"/"Saiu pra entrega" também fecham direto) */
export async function avancarStatus(id: number) {
  await exigirPapel("DIRETOR");
  const pedido = await db.pedido.findUniqueOrThrow({ where: { id } });
  if (pedido.status !== "ENTREGUE" && pedido.status !== "CANCELADO") await mudarStatus(id, "ENTREGUE");
}

/** Escolhe de qual fornecedor saíram as caixas de um item (pedidos do app chegam sem). Refaz a baixa do estoque. */
export async function definirFornecedorItem(itemId: string, fornecedorId: string) {
  const usuario = await exigirPapel("DIRETOR");
  const item = await db.pedidoItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  if (fornecedorId && !(await db.fornecedor.findUnique({ where: { id: fornecedorId } }))) return;
  await db.pedidoItem.update({ where: { id: itemId }, data: { fornecedorId: fornecedorId || null } });
  await sincronizarBaixaDoPedido(item.pedidoId, usuario.nome);
  revalidatePath("/painel", "layout");
}

/**
 * Apaga o pedido de vez (lançado errado). Vão junto: itens, baixa no estoque (as caixas voltam) e a cobrança em aberto.
 * Pedido já pago: o pagamento sai junto, então só exclui com `mesmoPago` (a tela pede uma segunda confirmação).
 */
export async function excluirPedido(id: number, voltarProDia = false, mesmoPago = false): Promise<{ erro?: string; pago?: number }> {
  await exigirPapel("DIRETOR");
  const pedido = await db.pedido.findUnique({ where: { id }, include: { cobranca: true } });
  if (!pedido) return { erro: "Esse pedido já foi excluído." };
  if (pedido.cobranca?.pagoEm && !mesmoPago) return { pago: pedido.cobranca.valor };
  await db.$transaction([
    db.mensagem.deleteMany({ where: { chave: { startsWith: `status:${id}:` } } }),
    db.pedido.delete({ where: { id } }),
  ]);
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  if (voltarProDia) redirect(`/painel/pedidos?dia=${diaISO(pedido.dataEntrega)}`);
  return {};
}

/** Troca a forma ou o prazo de um pedido ainda não pago (a cobrança acompanha) */
export async function definirPagamento(id: number, dados: PagamentoEscolhido): Promise<{ erro?: string }> {
  await exigirPapel("DIRETOR");
  const r = esquemaPagamento.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };
  const pedido = await db.pedido.findUnique({ where: { id }, include: { cobranca: true } });
  if (!pedido) return { erro: "Esse pedido não existe mais." };
  if (pedido.cobranca?.pagoEm) return { erro: "Esse pedido já foi pago. Desfaça o pagamento pra mudar." };
  const pagamento = validarPagamento(r.data, diaISO(pedido.dataEntrega));
  if ("erro" in pagamento) return pagamento;
  await db.pedido.update({ where: { id }, data: pagamento.dados });
  await sincronizarCobranca(id);
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  return {};
}

const esquemaPedido = z.object({
  clienteId: z.string().min(1, "Escolha o cliente"),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(["WHATSAPP", "PAINEL"]),
  observacao: z.string().max(500).optional(),
  pagamento: esquemaPagamento,
  /** lançamento de um dia que já passou: a entrega já aconteceu */
  entregue: z.boolean().optional(),
  /** ... e o dinheiro já entrou */
  recebido: z.boolean().optional(),
  voltarProDia: z.boolean().optional(),
  itens: z
    .array(
      z.object({
        produtoId: z.string(),
        quantidade: z.number().positive(),
        // valor da caixa no dia (muda por cliente e por dia); sem valor, vale o combinado ou o de tabela
        precoUnit: z.number("Valor inválido").positive("Valor inválido").max(100000).optional(),
        fornecedorId: z.string().nullable().optional(),
      }),
    )
    .min(1, "Adicione pelo menos um produto"),
});

export type NovoPedido = z.infer<typeof esquemaPedido>;

/** Itens com o valor certo: o digitado (só o painel lança por aqui); sem ele, o combinado com o cliente ou o de tabela */
async function montarItens(dados: NovoPedido, jaNoPedido: string[] = []) {
  const ids = dados.itens.map((i) => i.produtoId);
  const idsFornecedor = [...new Set(dados.itens.map((i) => i.fornecedorId).filter((f): f is string => !!f))];
  const [produtos, cliente, especiais, fornecedores] = await Promise.all([
    db.produto.findMany({ where: { id: { in: ids }, OR: [{ ativo: true }, { id: { in: jaNoPedido } }] } }),
    db.cliente.findUnique({ where: { id: dados.clienteId }, select: { notaFiscal: true } }),
    db.precoCliente.findMany({ where: { clienteId: dados.clienteId, produtoId: { in: ids } } }),
    db.fornecedor.findMany({ where: { id: { in: idsFornecedor } }, select: { id: true } }),
  ]);
  if (!cliente) return { erro: "Cliente não encontrado" };
  if (fornecedores.length !== idsFornecedor.length) return { erro: "Fornecedor não encontrado" };
  const preco = new Map(produtos.map((p) => [p.id, especiais.find((e) => e.produtoId === p.id)?.preco ?? p.preco]));
  const itens = dados.itens
    .filter((i) => preco.has(i.produtoId))
    .map((i) => {
      const precoUnit = Math.round((i.precoUnit ?? preco.get(i.produtoId)!) * 100) / 100;
      return {
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        precoUnit,
        subtotal: Math.round(precoUnit * i.quantidade * 100) / 100,
        fornecedorId: i.fornecedorId || null,
      };
    });
  if (itens.length === 0) return { erro: "Nenhum produto válido no pedido" };
  return { itens, total: Math.round(itens.reduce((s, i) => s + i.subtotal, 0) * 100) / 100, notaFiscal: cliente.notaFiscal };
}

const horaDaEntrega = (dia: string) => new Date(inicioDoDia(dia).getTime() + 8 * 3600 * 1000);

export async function criarPedido(dados: NovoPedido): Promise<{ erro?: string }> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaPedido.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };
  const { dia } = r.data;
  const pagamento = validarPagamento(r.data.pagamento, dia);
  if ("erro" in pagamento) return pagamento;
  const montado = await montarItens(r.data);
  if ("erro" in montado) return montado;
  const passado = dia <= diaISO(); // só o que já chegou no dia pode nascer entregue ou recebido
  const entregue = passado && !!r.data.entregue;

  const pedido = await db.pedido.create({
    data: {
      clienteId: r.data.clienteId,
      origem: r.data.origem,
      status: entregue ? "ENTREGUE" : "NOVO",
      notaFiscal: montado.notaFiscal,
      observacao: r.data.observacao || null,
      ...pagamento.dados,
      dataEntrega: horaDaEntrega(dia),
      total: montado.total,
      itens: { create: montado.itens },
    },
  });

  if (entregue) await sincronizarBaixaDoPedido(pedido.id, usuario.nome);
  await sincronizarCobranca(pedido.id);
  if (passado && r.data.recebido) {
    // à vista, o dinheiro entrou no dia da entrega; a prazo já pago, entrou agora
    const agora = new Date();
    const naEntrega = new Date(inicioDoDia(dia).getTime() + 12 * 3600 * 1000);
    await db.cobranca.update({ where: { pedidoId: pedido.id }, data: { pagoEm: pagamento.dados.condicaoPagamento === "VISTA" && naEntrega < agora ? naEntrega : agora } });
  }
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  redirect(r.data.voltarProDia ? `/painel/dia?dia=${dia}` : `/painel/pedidos/${pedido.id}`);
}

/**
 * Corrige um pedido já lançado: cliente, dia, itens, valores, fornecedor, pagamento e se foi entregue.
 * Estoque e cobrança acompanham. Pago: valor e cliente só mudam depois de desfazer o pagamento.
 */
export async function editarPedido(id: number, dados: NovoPedido): Promise<{ erro?: string }> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaPedido.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };
  const { dia, clienteId } = r.data;
  const pagamento = validarPagamento(r.data.pagamento, dia);
  if ("erro" in pagamento) return pagamento;
  const pedido = await db.pedido.findUnique({ where: { id }, include: { itens: true, cobranca: true } });
  if (!pedido) return { erro: "Esse pedido não existe mais." };
  if (pedido.status === "CANCELADO") return { erro: "Pedido cancelado: reabra antes de editar." };
  const montado = await montarItens(r.data, pedido.itens.map((i) => i.produtoId));
  if ("erro" in montado) return montado;
  if (pedido.cobranca?.pagoEm && (Math.abs(montado.total - pedido.cobranca.valor) > 0.005 || clienteId !== pedido.clienteId)) {
    return { erro: `Esse pedido já foi pago (${reais(pedido.cobranca.valor)}). Pra mudar valor ou cliente, desfaça o pagamento na tela do pedido.` };
  }

  const mudouDia = diaISO(pedido.dataEntrega) !== dia;
  const status = r.data.entregue ? "ENTREGUE" : pedido.status === "ENTREGUE" ? "NOVO" : pedido.status;
  await db.$transaction([
    db.pedidoItem.deleteMany({ where: { pedidoId: id } }),
    db.pedido.update({
      where: { id },
      data: {
        clienteId,
        status,
        observacao: r.data.observacao || null,
        ...pagamento.dados,
        total: montado.total,
        itens: { create: montado.itens },
        ...(pedido.origem !== "APP" && { origem: r.data.origem }), // pedido feito no app continua sendo do app
        ...(mudouDia && { dataEntrega: horaDaEntrega(dia), janelaId: null }),
        ...(clienteId !== pedido.clienteId && { notaFiscal: montado.notaFiscal }),
      },
    }),
  ]);
  await sincronizarBaixaDoPedido(id, usuario.nome);
  await sincronizarCobranca(id);
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  redirect(r.data.voltarProDia ? `/painel/dia?dia=${dia}` : `/painel/pedidos/${id}`);
}
