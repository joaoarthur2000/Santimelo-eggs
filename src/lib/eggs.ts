import "server-only";
import { ASSINATURA_EGGS, AVISO_PAGAMENTO_DIAS, DIAS_SEMANA } from "./constantes";
import { diaDaSemana, diaISO, fimDoDia, formatarDia, inicioDoDia, somarDias } from "./datas";
import { db } from "./db";
import { quantidade, reais } from "./formato";
import { enviarProGrupo } from "./whatsapp";

// Regras do app EGGS (clientes de ovos). O app e o painel usam o mesmo banco: pedido feito no app
// é um Pedido normal (origem APP) e entra nos relatórios e no estoque.

/** Preço agendado cuja data chegou vira o preço do produto (e entra no histórico). Pode rodar sempre. */
export async function aplicarPrecosAgendados() {
  const vencidos = await db.precoAgendado.findMany({ where: { aplicadoEm: null, aPartirDe: { lte: diaISO() } }, orderBy: { aPartirDe: "asc" } });
  for (const a of vencidos) {
    await db.$transaction([
      db.produto.update({ where: { id: a.produtoId }, data: { preco: a.preco } }),
      db.historicoPreco.create({ data: { produtoId: a.produtoId, preco: a.preco, origem: "AGENDADO", autor: a.autor, em: inicioDoDia(a.aPartirDe) } }),
      db.precoAgendado.update({ where: { id: a.id }, data: { aplicadoEm: new Date() } }),
    ]);
  }
}

/** Produtos de ovo ativos com o preço que vale pra esse cliente (negociado ou de tabela) */
export async function produtosDoCliente(clienteId: string) {
  await aplicarPrecosAgendados();
  const produtos = await db.produto.findMany({
    where: { ativo: true, item: { ativo: true } },
    include: {
      item: true,
      precosCliente: { where: { clienteId } },
      precosAgendados: { where: { aplicadoEm: null }, orderBy: { aPartirDe: "asc" } },
      precos: { where: { em: { gte: inicioDoDia(somarDias(diaISO(), -90)) } }, orderBy: { em: "asc" } },
    },
    orderBy: [{ item: { ordem: "asc" } }, { preco: "desc" }],
  });
  return produtos.map((p) => {
    const especial = p.precosCliente[0]?.preco ?? null;
    return {
      id: p.id,
      itemId: p.itemId,
      item: p.item.nome,
      codigo: p.item.codigo,
      embalagem: p.embalagem,
      unidade: p.unidade,
      fatorEstoque: p.fatorEstoque,
      precoTabela: p.preco,
      preco: especial ?? p.preco,
      negociado: especial !== null,
      // Preço de tabela agendado; quem tem preço negociado não muda com ele
      proximos: especial === null ? p.precosAgendados.map((a) => ({ preco: a.preco, aPartirDe: a.aPartirDe })) : [],
      historico: p.precos.map((h) => ({ dia: diaISO(h.em), preco: h.preco })),
    };
  });
}

/** Próximos dias de entrega da região, com os horários e quantas vagas sobram em cada um */
export async function agendaDaRegiao(regiaoId: string | null, dias = 14) {
  if (!regiaoId) return [];
  const amanha = somarDias(diaISO(), 1);
  const fim = somarDias(amanha, dias - 1);
  const [janelas, pedidos] = await Promise.all([
    db.janelaEntrega.findMany({ where: { regiaoId, ativo: true }, orderBy: [{ diaSemana: "asc" }, { inicio: "asc" }] }),
    db.pedido.findMany({
      where: { janela: { regiaoId }, status: { not: "CANCELADO" }, dataEntrega: { gte: inicioDoDia(amanha), lt: fimDoDia(fim) } },
      select: { janelaId: true, dataEntrega: true },
    }),
  ]);
  const ocupados = new Map<string, number>();
  for (const p of pedidos) ocupados.set(`${diaISO(p.dataEntrega)}|${p.janelaId}`, (ocupados.get(`${diaISO(p.dataEntrega)}|${p.janelaId}`) ?? 0) + 1);

  const agenda: { dia: string; janelas: { id: string; inicio: string; fim: string; capacidade: number; livres: number }[] }[] = [];
  for (let d = amanha; d <= fim; d = somarDias(d, 1)) {
    const doDia = janelas.filter((j) => j.diaSemana === diaDaSemana(d));
    if (!doDia.length) continue;
    agenda.push({
      dia: d,
      janelas: doDia.map((j) => ({ id: j.id, inicio: j.inicio, fim: j.fim, capacidade: j.capacidade, livres: Math.max(0, j.capacidade - (ocupados.get(`${d}|${j.id}`) ?? 0)) })),
    });
  }
  return agenda;
}

/**
 * Deixa a cobrança do pedido de acordo com ele: vence N dias depois da entrega
 * (prazo combinado; sem prazo = no dia da entrega). Pedido cancelado apaga a cobrança em aberto.
 * Cobrança já paga nunca é mexida.
 */
export async function sincronizarCobranca(pedidoId: number) {
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, include: { cliente: true, cobranca: true } });
  if (!pedido || pedido.cobranca?.pagoEm) return;
  if (pedido.status === "CANCELADO") {
    if (pedido.cobranca) await db.cobranca.delete({ where: { id: pedido.cobranca.id } });
    return;
  }
  const dados = { valor: pedido.total, vencimento: somarDias(diaISO(pedido.dataEntrega), pedido.cliente.prazoPagamentoDias ?? 0) };
  await db.cobranca.upsert({ where: { pedidoId }, update: dados, create: { ...dados, pedidoId, clienteId: pedido.clienteId } });
}

/** Primeiro nome de quem cuida da conta (ou o nome do estabelecimento) */
export const nomeDoCliente = (c: { responsavel: string | null; nomeFantasia: string }) => c.responsavel?.trim().split(/\s+/)[0] || c.nomeFantasia;

/**
 * Aviso automático de pagamento: quando falta até AVISO_PAGAMENTO_DIAS dias pro vencimento, cria uma vez
 * a mensagem no app do cliente. Roda quando o cliente abre o app.
 */
export async function gerarAvisosDePagamento(cliente: { id: string; responsavel: string | null; nomeFantasia: string }) {
  const hoje = diaISO();
  const abertas = await db.cobranca.findMany({
    where: { clienteId: cliente.id, pagoEm: null, vencimento: { gte: hoje, lte: somarDias(hoje, AVISO_PAGAMENTO_DIAS) } },
  });
  for (const c of abertas) {
    const chave = `pagamento:${c.id}`;
    if (await db.mensagem.findUnique({ where: { chave } })) continue;
    const dias = Math.round((inicioDoDia(c.vencimento).getTime() - inicioDoDia(hoje).getTime()) / 864e5);
    const quando = dias === 0 ? "é hoje" : dias === 1 ? "é amanhã" : `é daqui ${dias} dias`;
    await db.mensagem.create({
      data: {
        clienteId: cliente.id,
        tipo: "PAGAMENTO",
        chave,
        autor: ASSINATURA_EGGS,
        texto: `Olá ${nomeDoCliente(cliente)}, estou passando pra avisar que a data do nosso pagamento ${quando}! Valor: ${reais(c.valor)}. Abraços do ${ASSINATURA_EGGS}`,
      },
    });
  }
}

/** Texto do pedido pro grupo EGGS-ADM, no formato de comanda (negrito do WhatsApp com *) */
export async function textoPedidoGrupo(pedidoId: number) {
  const p = await db.pedido.findUnique({
    where: { id: pedidoId },
    include: { cliente: { include: { regiao: true } }, janela: true, cobranca: true, itens: { include: { produto: { include: { item: true } } } } },
  });
  if (!p) return null;
  const dia = diaISO(p.dataEntrega);
  const c = p.cliente;
  const linhas = [
    `🥚 *NOVO PEDIDO EGGS #${p.id}*`,
    "",
    `*Cliente:* ${c.nomeFantasia}${c.responsavel ? ` (${c.responsavel})` : ""}`,
    c.whatsapp && `*WhatsApp:* ${c.whatsapp}`,
    `*Entrega:* ${DIAS_SEMANA[diaDaSemana(dia)]}, ${formatarDia(dia, { day: "2-digit", month: "2-digit" })}${p.janela ? ` · ${p.janela.inicio}–${p.janela.fim}` : ""}`,
    c.regiao && `*Região:* ${c.regiao.nome}`,
    c.endereco && `*Endereço:* ${c.endereco}`,
    "",
    "*Itens:*",
    ...p.itens.map((i) => `• ${quantidade(i.quantidade, i.produto.unidade)} ${i.produto.item.nome} · ${reais(i.subtotal)}`),
    "",
    `*Total:* ${reais(p.total)}`,
    "*Frete:* grátis",
    `*Pagamento:* ${[c.formaPagamento, p.cobranca && `vence ${formatarDia(p.cobranca.vencimento, { day: "2-digit", month: "2-digit" })}`].filter(Boolean).join(" · ") || "a combinar"}`,
    p.observacao && `*Obs:* ${p.observacao}`,
  ];
  return linhas.filter((l) => typeof l === "string").join("\n");
}

/** Avisa o grupo da equipe que entrou pedido pelo app */
export async function avisarPedidoNoGrupo(pedidoId: number) {
  const texto = await textoPedidoGrupo(pedidoId);
  if (texto) await enviarProGrupo(texto);
}
