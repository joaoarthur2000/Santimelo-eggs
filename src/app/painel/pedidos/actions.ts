"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { FLUXO_PEDIDO, STATUS_PEDIDO } from "@/lib/constantes";
import { inicioDoDia } from "@/lib/datas";
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

export async function avancarStatus(id: number) {
  await exigirPapel("DIRETOR");
  const pedido = await db.pedido.findUniqueOrThrow({ where: { id } });
  const i = FLUXO_PEDIDO.indexOf(pedido.status as (typeof FLUXO_PEDIDO)[number]);
  if (i >= 0 && i < FLUXO_PEDIDO.length - 1) await mudarStatus(id, FLUXO_PEDIDO[i + 1]);
}

const esquemaPedido = z.object({
  clienteId: z.string().min(1, "Escolha o cliente"),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.enum(["WHATSAPP", "PAINEL"]),
  observacao: z.string().max(500).optional(),
  itens: z.array(z.object({ produtoId: z.string(), quantidade: z.number().positive() })).min(1, "Adicione pelo menos um produto"),
});

export type NovoPedido = z.infer<typeof esquemaPedido>;

export async function criarPedido(dados: NovoPedido): Promise<{ erro?: string }> {
  await exigirPapel("DIRETOR");
  const r = esquemaPedido.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0].message };

  // Preço sempre do banco, nunca do navegador: o combinado com o cliente ou o de tabela
  const ids = r.data.itens.map((i) => i.produtoId);
  const [produtos, cliente, especiais] = await Promise.all([
    db.produto.findMany({ where: { id: { in: ids }, ativo: true } }),
    db.cliente.findUnique({ where: { id: r.data.clienteId }, select: { notaFiscal: true } }),
    db.precoCliente.findMany({ where: { clienteId: r.data.clienteId, produtoId: { in: ids } } }),
  ]);
  const preco = new Map(produtos.map((p) => [p.id, especiais.find((e) => e.produtoId === p.id)?.preco ?? p.preco]));
  const itens = r.data.itens
    .filter((i) => preco.has(i.produtoId))
    .map((i) => {
      const precoUnit = preco.get(i.produtoId)!;
      return { produtoId: i.produtoId, quantidade: i.quantidade, precoUnit, subtotal: Math.round(precoUnit * i.quantidade * 100) / 100 };
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
