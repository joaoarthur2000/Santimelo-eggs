// Zera os dados da operação pra começar com os dados reais (usado em 2026-11-09).
// APAGA: clientes e logins de clientes, pedidos, cobranças, estoque, despesas, rotas, gastos do veículo,
//        atendimentos, mensagens, preços combinados e agendados, histórico de preços.
// MANTÉM: logins da equipe, produtos e preços atuais, fornecedores, veículos, regiões e horários de entrega.
// Liga o "modo real": o seed nunca mais cria dados de exemplo.
// Rodar (servidor parado, com backup feito): npx tsx scripts/zerar-dados.ts --confirmar
import { PrismaClient } from "@prisma/client";

if (!process.argv.includes("--confirmar")) {
  console.log("Isso apaga os dados da operação. Faça backup de prisma/dev.db e rode de novo com --confirmar.");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const produtos = await db.produto.findMany();
  const apagados = await db.$transaction(async (tx) => {
    await tx.usuario.updateMany({ where: { papel: "DIRETOR" }, data: { clienteId: null } });
    const r = {
      conversas: (await tx.mensagemAtendimento.deleteMany()).count,
      atendimentos: (await tx.atendimento.deleteMany()).count,
      mensagens: (await tx.mensagem.deleteMany()).count,
      cobrancas: (await tx.cobranca.deleteMany()).count,
      estoque: (await tx.movimentoEstoque.deleteMany()).count,
      itensDePedido: (await tx.pedidoItem.deleteMany()).count,
      pedidos: (await tx.pedido.deleteMany()).count,
      precosCombinados: (await tx.precoCliente.deleteMany()).count,
      precosAgendados: (await tx.precoAgendado.deleteMany()).count,
      rotas: (await tx.rotaDia.deleteMany()).count,
      despesas: (await tx.despesa.deleteMany()).count,
      gastosVeiculo: (await tx.gastoVeiculo.deleteMany()).count,
      loginsDeClientes: (await tx.usuario.deleteMany({ where: { papel: "CLIENTE" } })).count,
      clientes: (await tx.cliente.deleteMany()).count,
      historicoPrecos: (await tx.historicoPreco.deleteMany()).count,
    };
    // o histórico recomeça com o preço de hoje
    for (const p of produtos) if (p.preco > 0) await tx.historicoPreco.create({ data: { produtoId: p.id, preco: p.preco, origem: "INICIAL", autor: "Sistema" } });
    await tx.configuracao.upsert({ where: { chave: "modo-real" }, update: { valor: new Date().toISOString() }, create: { chave: "modo-real", valor: new Date().toISOString() } });
    return r;
  });
  console.log("Apagado:", apagados);
  console.log("Mantido:", {
    equipe: await db.usuario.count(),
    produtos: await db.produto.count(),
    fornecedores: await db.fornecedor.count(),
    veiculos: await db.veiculo.count(),
    regioes: await db.regiao.count(),
    horariosDeEntrega: await db.janelaEntrega.count({ where: { ativo: true } }),
  });
}

main().finally(() => db.$disconnect());
