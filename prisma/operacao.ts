// Operação real da Santimelo (informada pelo dono em 2026-11-09). Roda em todo seed e só cria o que falta.
// - Fornecedores: Rogério Ovos, Fabiano CEASA, Suprema Hortifruti
// - Produtos: ovo branco, ovo caipira orgânico e camarão em pacote de 800 g congelado
// - Entregas: terças e quintas, das 05h às 11h (aplicado uma vez; depois a equipe ajusta em "Regiões e horários")
import type { PrismaClient } from "@prisma/client";

const FORNECEDORES = [
  { nome: "Rogério Ovos", produtos: "Ovos", ordem: 1 },
  { nome: "Fabiano CEASA", produtos: "Ovos", ordem: 2 },
  { nome: "Suprema Hortifruti", produtos: "Ovos", ordem: 3 },
];

const MARCA = "operacao-2026-11-09";

// Fiorino da entrega. Custos fixos e por km são ESTIMATIVA inicial (2026-11-09): trocar pelos valores reais em Veículos
const FIORINO = {
  apelido: "Fiorino",
  modelo: "Fiat Fiorino Hard Working 1.4 8V",
  ano: 2021,
  placa: "QXX1J55",
  combustivel: "Gasolina",
  consumoKmL: 10,
  precoLitro: 6.4,
  ipvaAnual: 2400, // RS: 3% do valor venal; Fiorino 2021 ≈ R$ 80 mil na FIPE (conferir no boleto)
  seguroAnual: 3600,
  licenciamentoAnual: 160,
  outrosFixosAnual: 0,
  manutencaoPorKm: 0.18, // revisões, óleo, freio e suspensão de um utilitário urbano
  pneusPorKm: 0.06,
};

export async function garantirOperacao(db: PrismaClient) {
  for (const f of FORNECEDORES) {
    if (!(await db.fornecedor.findUnique({ where: { nome: f.nome } }))) await db.fornecedor.create({ data: f });
  }
  if (!(await db.veiculo.findUnique({ where: { placa: FIORINO.placa } }))) await db.veiculo.create({ data: FIORINO });

  // Só uma vez: renomeia o caipira, cadastra o camarão e muda as janelas de entrega
  if (await db.configuracao.findUnique({ where: { chave: MARCA } })) return;

  const caipira = await db.item.findFirst({ where: { nome: "Ovo caipira" } });
  if (caipira && !(await db.item.findUnique({ where: { nome: "Ovo caipira orgânico" } }))) {
    await db.item.update({ where: { id: caipira.id }, data: { nome: "Ovo caipira orgânico" } });
  }

  let camarao = await db.item.findUnique({ where: { nome: "Camarão" } });
  if (!camarao) {
    const codigoLivre = (await db.item.findUnique({ where: { codigo: "5" } })) ? null : "5";
    camarao = await db.item.create({ data: { codigo: codigoLivre, nome: "Camarão", unidadeEstoque: "pacote", ordem: 5 } });
  }
  if (!(await db.produto.findFirst({ where: { itemId: camarao.id } }))) {
    // Preço ainda não informado: entra desligado do app até a equipe definir em Preços
    await db.produto.create({ data: { codigo: "CAMARAO 800G CONG", itemId: camarao.id, embalagem: "Pacote 800 g congelado", unidade: "pacote", fatorEstoque: 1, preco: 0, ativo: false } });
  }

  // Entregas: terça (2) e quinta (4), em duas faixas que cobrem das 05h às 11h
  const FAIXAS = [["05:00", "08:00"], ["08:00", "11:00"]] as const;
  for (const r of await db.regiao.findMany({ include: { janelas: true } })) {
    for (const j of r.janelas) {
      const certa = [2, 4].includes(j.diaSemana) && FAIXAS.some(([i]) => i === j.inicio);
      if (!certa && j.ativo) await db.janelaEntrega.update({ where: { id: j.id }, data: { ativo: false } });
    }
    for (const dia of [2, 4]) {
      for (const [inicio, fim] of FAIXAS) {
        await db.janelaEntrega.upsert({
          where: { regiaoId_diaSemana_inicio: { regiaoId: r.id, diaSemana: dia, inicio } },
          update: { fim, ativo: true },
          create: { regiaoId: r.id, diaSemana: dia, inicio, fim, capacidade: 8 },
        });
      }
    }
  }

  await db.configuracao.create({ data: { chave: MARCA, valor: "fornecedores, caipira orgânico, camarão e entregas ter/qui 05h–11h" } });
}
