"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { STATUS_PEDIDO } from "@/lib/constantes";
import { diaISO, inicioDoDia } from "@/lib/datas";
import { sincronizarCobranca } from "@/lib/eggs";
import { sincronizarBaixaDoPedido } from "@/lib/estoque";
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

const esquemaPedido = z.object({
  clienteId: z.string().min(1, "Escolha o cliente"),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(["WHATSAPP", "PAINEL"]),
  observacao: z.string().max(500).optional(),
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

export async function criarPedido(dados: NovoPedido): Promise<{ erro?: string }> {
  await exigirPapel("DIRETOR");
  const r = esquemaPedido.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };

  // Valor: o digitado no pedido (só o painel lança por aqui); sem ele, o combinado com o cliente ou o de tabela
  const ids = r.data.itens.map((i) => i.produtoId);
  const idsFornecedor = [...new Set(r.data.itens.map((i) => i.fornecedorId).filter((f): f is string => !!f))];
  const [produtos, cliente, especiais, fornecedores] = await Promise.all([
    db.produto.findMany({ where: { id: { in: ids }, ativo: true } }),
    db.cliente.findUnique({ where: { id: r.data.clienteId }, select: { notaFiscal: true } }),
    db.precoCliente.findMany({ where: { clienteId: r.data.clienteId, produtoId: { in: ids } } }),
    db.fornecedor.findMany({ where: { id: { in: idsFornecedor } }, select: { id: true } }),
  ]);
  if (fornecedores.length !== idsFornecedor.length) return { erro: "Fornecedor não encontrado" };
  const preco = new Map(produtos.map((p) => [p.id, especiais.find((e) => e.produtoId === p.id)?.preco ?? p.preco]));
  const itens = r.data.itens
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

  const pedido = await db.pedido.create({
    data: {
      clienteId: r.data.clienteId,
      origem: r.data.origem,
      notaFiscal: cliente?.notaFiscal ?? false,
      observacao: r.data.observacao || null,
      dataEntrega: new Date(inicioDoDia(r.data.dia).getTime() + 8 * 3600 * 1000),
      total: Math.round(itens.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
      itens: { create: itens },
    },
  });

  await sincronizarCobranca(pedido.id);
  revalidatePath("/painel");
  revalidatePath("/painel/pedidos");
  redirect(`/painel/pedidos/${pedido.id}`);
}
