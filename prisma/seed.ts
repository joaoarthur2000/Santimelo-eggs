// Piloto local do EGGS by Santimelo.
// Produtos e preços dos ovos são os REAIS (vieram do sistema da Suprema em 2026-11-02: custo R$ 125/cx na granja,
// venda R$ 190/cx). Clientes, pedidos, compras e cobranças abaixo são EXEMPLO, pra os relatórios terem números.
// Rodar: npm run db:seed (não faz nada se já houver dados) · npm run db:reset (apaga e recria)
// Acessos de exemplo: teste ADM123 / 123 (painel; pela tela do app, entra como "Santimelo (teste)") · app EGG-PADR, EGG-DCGM, EGG-SMSH, EGG-BELL / ovos123
import { PrismaClient } from "@prisma/client";
import { gerarHash } from "../src/lib/senha";
import { diaISO, inicioDoDia, somarDias } from "../src/lib/datas";
import { garantirOperacao } from "./operacao";

const db = new PrismaClient();

// Gerador determinístico pra o histórico ser sempre o mesmo
let semente = 42;
function aleatorio() {
  semente = (semente * 16807) % 2147483647;
  return (semente - 1) / 2147483646;
}
const escolher = <T,>(lista: readonly T[]) => lista[Math.floor(aleatorio() * lista.length)];
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const diaSemanaDe = (dia: string) => new Date(`${dia}T12:00:00-03:00`).getUTCDay();
const quando = (dia: string, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return new Date(inicioDoDia(dia).getTime() + (h * 60 + m) * 60000);
};

// Só ovos: bandeja de 30 e caixa de 30 dúzias (360 ovos = 12 bandejas de 30)
const CATALOGO = [
  {
    codigo: "1",
    nome: "Ovo branco",
    produtos: [
      { codigo: "OVOS BRANCOS 30UN BD #CAIXA", embalagem: "Caixa 30 dúzias", unidade: "caixa", fatorEstoque: 1, preco: 190, precoAntes: 185 },
      { codigo: "OVOS BRANCOS 30UN BD", embalagem: "Bandeja 30 ovos", unidade: "bandeja", fatorEstoque: 1 / 12, preco: 20.59 },
    ],
  },
  {
    codigo: "2",
    nome: "Ovo caipira",
    produtos: [
      { codigo: "OVO CAIPIRA 30UN BD", embalagem: "Bandeja 30 ovos", unidade: "bandeja", fatorEstoque: 1 / 12, preco: 42.75 },
      { codigo: "OVO CAIPIRA 20UN PLAST", embalagem: "Plastificado 20 ovos", unidade: "pacote", fatorEstoque: 20 / 360, preco: 28.5 },
    ],
  },
];

// Custo de compra por caixa (EXEMPLO, a granja cobra R$ 125 no branco)
const CUSTO: Record<string, number> = { "Ovo branco": 125, "Ovo caipira": 360 };

async function main() {
  const vazia = async (contar: () => Promise<number>) => (await contar()) === 0;
  // Modo real (ligado em 2026-11-09, quando a Santimelo zerou os dados de exemplo): nunca mais cria exemplo
  const modoReal = !!(await db.configuracao.findUnique({ where: { chave: "modo-real" } }));
  const hoje = diaISO();

  // Equipe — login de teste ADM123 / 123 (trocar antes de ir pra nuvem)
  if (await vazia(() => db.usuario.count({ where: { papel: "DIRETOR" } }))) {
    await db.usuario.create({ data: { nome: "João Arthur", email: "joao@santimelo.local", codigoAcesso: "ADM123", senhaHash: gerarHash("123"), papel: "DIRETOR" } });
  }

  // Catálogo
  if (await vazia(() => db.item.count())) {
    for (const [ordem, i] of CATALOGO.entries()) {
      await db.item.create({
        data: {
          codigo: i.codigo,
          nome: i.nome,
          ordem,
          produtos: {
            create: i.produtos.map((p) => ({
              codigo: p.codigo,
              embalagem: p.embalagem,
              unidade: p.unidade,
              fatorEstoque: p.fatorEstoque,
              preco: p.preco,
              precos: {
                create: [
                  ...("precoAntes" in p ? [{ preco: p.precoAntes as number, origem: "INICIAL", em: inicioDoDia(somarDias(hoje, -60)) }] : []),
                  { preco: p.preco, origem: "precoAntes" in p ? "PAINEL" : "INICIAL", autor: "João Arthur", em: inicioDoDia(somarDias(hoje, "precoAntes" in p ? -18 : -60)) },
                ],
              },
            })),
          },
        },
      });
    }
  }

  // Regiões com os dias e horários de entrega (EXEMPLO)
  if (await vazia(() => db.regiao.count())) {
    const norte = await db.regiao.create({ data: { nome: "Zona Norte", bairros: "Sarandi, Passo d'Areia, Jardim Lindóia" } });
    const centro = await db.regiao.create({ data: { nome: "Centro", bairros: "Centro Histórico, Cidade Baixa, Bom Fim" } });
    await db.janelaEntrega.createMany({
      data: [
        ...[1, 3, 5].flatMap((diaSemana) => [
          { regiaoId: norte.id, diaSemana, inicio: "07:00", fim: "09:00", capacidade: 6 },
          { regiaoId: norte.id, diaSemana, inicio: "09:00", fim: "11:00", capacidade: 6 },
        ]),
        ...[2, 4, 6].flatMap((diaSemana) => [
          { regiaoId: centro.id, diaSemana, inicio: "06:30", fim: "08:30", capacidade: 5 },
          { regiaoId: centro.id, diaSemana, inicio: "14:00", fim: "16:00", capacidade: 5 },
        ]),
      ],
    });
  }

  // Clientes com acesso ao app, pedidos dos últimos 45 dias, cobranças e baixa no estoque (EXEMPLO)
  if (!modoReal && (await vazia(() => db.cliente.count()))) {
    const regiao = Object.fromEntries((await db.regiao.findMany()).map((r) => [r.nome, r.id]));
    const produtos = await db.produto.findMany({ include: { item: true } });
    const produto = (item: string, unidade: string) => produtos.find((p) => p.item.nome === item && p.unidade === unidade)!;

    const CLIENTES = [
      {
        codigo: "EGG-PADR",
        dados: { nomeFantasia: "Padaria Pão Quente", razaoSocial: "Pão Quente Panificadora Ltda", tipoNegocio: "Padaria", responsavel: "Marina", whatsapp: "(51) 99321-4455", endereco: "Av. Assis Brasil, 3200", bairro: "Passo d'Areia", cidade: "Porto Alegre", cep: "91010-003", notaFiscal: false, consumoSemanal: 3, limiteCredito: 3000, prazoPagamentoDias: 7, formaPagamento: "Pix", regiaoId: regiao["Zona Norte"], negociacao: "Mínimo de 1 caixa por pedido. Ovo trincado é trocado na próxima entrega." },
        cesta: () => [{ p: produto("Ovo branco", "caixa"), q: escolher([1, 1, 1.5, 2]) }, aleatorio() < 0.4 && { p: produto("Ovo caipira", "bandeja"), q: escolher([2, 4]) }],
        vezes: 0.7,
      },
      {
        codigo: "EGG-DCGM",
        dados: { nomeFantasia: "Confeitaria Doce Gema", razaoSocial: "Doce Gema Confeitaria Ltda", tipoNegocio: "Confeitaria", responsavel: "Rafael", whatsapp: "(51) 99555-0101", cnpj: "12.345.678/0001-90", endereco: "Rua da República, 410", bairro: "Cidade Baixa", cidade: "Porto Alegre", cep: "90050-320", notaFiscal: true, consumoSemanal: 4, limiteCredito: 5000, prazoPagamentoDias: 14, formaPagamento: "Boleto", regiaoId: regiao["Centro"], negociacao: "Preço especial na caixa de ovo branco por volume (2 caixas por semana)." },
        cesta: () => [{ p: produto("Ovo branco", "caixa"), q: escolher([1, 2, 2]) }, aleatorio() < 0.5 && { p: produto("Ovo caipira", "pacote"), q: escolher([3, 5]) }],
        vezes: 0.8,
        especial: { item: "Ovo branco", unidade: "caixa", preco: 182 },
      },
      {
        codigo: "EGG-SMSH",
        dados: { nomeFantasia: "Smash Burger POA", razaoSocial: "Smash POA Lanches Ltda", tipoNegocio: "Lancheria", responsavel: "Diego", whatsapp: "(51) 98444-2020", endereco: "Rua Lima e Silva, 880", bairro: "Cidade Baixa", cidade: "Porto Alegre", cep: "90050-100", notaFiscal: false, consumoSemanal: 1.5, limiteCredito: 1500, prazoPagamentoDias: 0, formaPagamento: "Pix na entrega", regiaoId: regiao["Centro"] },
        cesta: () => [{ p: produto("Ovo branco", "caixa"), q: escolher([0.5, 1]) }, aleatorio() < 0.5 && { p: produto("Ovo branco", "bandeja"), q: escolher([4, 6]) }],
        vezes: 0.55,
      },
      {
        codigo: "EGG-BELL",
        dados: { nomeFantasia: "Bella Massa Restaurante", razaoSocial: "Bella Massa Alimentos Ltda", tipoNegocio: "Restaurante", responsavel: "Luciana", whatsapp: "(51) 99777-3131", endereco: "Av. Sertório, 1500", bairro: "Sarandi", cidade: "Porto Alegre", cep: "91110-000", notaFiscal: true, consumoSemanal: 2, limiteCredito: 2500, prazoPagamentoDias: 7, formaPagamento: "Boleto", regiaoId: regiao["Zona Norte"] },
        cesta: () => [{ p: produto("Ovo caipira", "bandeja"), q: escolher([4, 6]) }, { p: produto("Ovo branco", "caixa"), q: escolher([0.5, 1]) }],
        vezes: 0.5,
      },
    ];

    const janelas = await db.janelaEntrega.findMany();
    const demanda = new Map<string, Map<string, number>>(); // dia → itemId → caixas pedidas (base das compras)

    for (const c of CLIENTES) {
      const cliente = await db.cliente.create({ data: c.dados });
      await db.usuario.create({
        data: { nome: c.dados.responsavel, email: `${c.codigo.toLowerCase()}@eggs.app`, codigoAcesso: c.codigo, senhaHash: gerarHash("ovos123"), papel: "CLIENTE", clienteId: cliente.id },
      });
      if (c.especial) await db.precoCliente.create({ data: { clienteId: cliente.id, produtoId: produto(c.especial.item, c.especial.unidade).id, preco: c.especial.preco } });
      const minhas = janelas.filter((j) => j.regiaoId === cliente.regiaoId);

      for (let d = somarDias(hoje, -45); d <= somarDias(hoje, 4); d = somarDias(d, 1)) {
        const janelasDoDia = minhas.filter((j) => j.diaSemana === diaSemanaDe(d));
        if (!janelasDoDia.length || aleatorio() > c.vezes) continue;
        const janela = escolher(janelasDoDia);
        const itens = c.cesta().filter((x): x is { p: (typeof produtos)[number]; q: number } => !!x);
        const especial = await db.precoCliente.findMany({ where: { clienteId: cliente.id } });
        const linhas = itens.map(({ p, q }) => {
          // Preço da época: as caixas custavam R$ 185 até 18 dias atrás
          const tabela = p.unidade === "caixa" && p.preco === 190 && d < somarDias(hoje, -18) ? 185 : p.preco;
          const precoUnit = especial.find((e) => e.produtoId === p.id)?.preco ?? tabela;
          return { produtoId: p.id, quantidade: q, precoUnit, subtotal: arred(q * precoUnit) };
        });
        const dataEntrega = quando(d, janela.inicio);
        const passado = d < hoje;
        const status = passado ? (aleatorio() < 0.04 ? "CANCELADO" : "ENTREGUE") : d === hoje ? "SEPARACAO" : "NOVO";
        const pedido = await db.pedido.create({
          data: {
            clienteId: cliente.id,
            origem: aleatorio() < 0.85 ? "APP" : "WHATSAPP",
            janelaId: janela.id,
            notaFiscal: c.dados.notaFiscal,
            status,
            dataEntrega,
            criadoEm: new Date(dataEntrega.getTime() - (1 + Math.floor(aleatorio() * 2)) * 864e5),
            total: arred(linhas.reduce((s, l) => s + l.subtotal, 0)),
            itens: { create: linhas },
          },
        });
        if (status === "CANCELADO") continue;
        for (const { p, q } of itens) {
          const dia = demanda.get(d) ?? new Map<string, number>();
          dia.set(p.itemId, (dia.get(p.itemId) ?? 0) + q * (p.fatorEstoque ?? 0));
          demanda.set(d, dia);
        }
        const vencimento = somarDias(d, cliente.prazoPagamentoDias ?? 0);
        await db.cobranca.create({
          data: { clienteId: cliente.id, pedidoId: pedido.id, valor: pedido.total, vencimento, pagoEm: vencimento < somarDias(hoje, -2) ? inicioDoDia(vencimento) : null },
        });
        if (status !== "ENTREGUE") continue;
        for (const { p, q } of itens) {
          const caixas = q * (p.fatorEstoque ?? 0);
          await db.movimentoEstoque.create({ data: { itemId: p.itemId, tipo: "VENDA", quantidade: -caixas, pedidoId: pedido.id, data: dataEntrega, autor: "Exemplo", observacao: `Pedido #${pedido.id}` } });
        }
      }
      await db.mensagem.create({
        data: { clienteId: cliente.id, tipo: "AVISO", autor: "Guinho", texto: "Bem-vindo ao EGGS! Por aqui você faz seus pedidos, acompanha os preços e vê os horários de entrega da sua região." },
      });
    }

    // Compras: a granja entrega 2 vezes por semana o que vai sair até a próxima, com folga; às vezes falha e compram na CEASA
    const itens = await db.item.findMany();
    const dias = [...demanda.keys()].sort();
    for (let d = somarDias(hoje, -47); d <= hoje; d = somarDias(d, 1)) {
      if (![1, 4].includes(diaSemanaDe(d))) continue;
      const ceasa = aleatorio() < 0.12;
      for (const item of itens) {
        const proximos = dias.filter((x) => x >= d && x < somarDias(d, 4));
        const precisa = proximos.reduce((s, x) => s + (demanda.get(x)?.get(item.id) ?? 0), 0);
        if (precisa <= 0) continue;
        const caixas = Math.ceil(precisa * 1.05 * 2) / 2; // de meia em meia caixa
        const custoUnit = arred(CUSTO[item.nome] * (ceasa ? 1.1 : 1) * (1 + (aleatorio() - 0.5) * 0.04));
        await db.movimentoEstoque.create({ data: { itemId: item.id, tipo: "COMPRA", quantidade: caixas, custoUnit, origem: ceasa ? "CEASA" : "GRANJA", data: quando(d, "06:00"), autor: "Exemplo" } });
      }
    }
    const branco = itens.find((i) => i.nome === "Ovo branco")!;
    await db.movimentoEstoque.create({ data: { itemId: branco.id, tipo: "PERDA", quantidade: -0.25, data: quando(somarDias(hoje, -6), "15:00"), autor: "Exemplo", observacao: "Bandejas trincadas no transporte" } });

    // Previsibilidade: aumento da bandeja de branco já avisado com uma semana de antecedência
    await db.precoAgendado.create({ data: { produtoId: produto("Ovo branco", "bandeja").id, preco: 21.5, aPartirDe: somarDias(hoje, 7), autor: "João Arthur" } });
  }

  // Login de teste ADM123: pela tela do app, entra como esse cliente (pedidos de teste aparecem no painel e nos relatórios)
  const adm = await db.usuario.findUnique({ where: { codigoAcesso: "ADM123" } });
  if (!modoReal && adm && !adm.clienteId) {
    const regiao = await db.regiao.findFirst({ orderBy: { nome: "desc" } });
    const teste = await db.cliente.create({
      data: { nomeFantasia: "Santimelo (teste)", razaoSocial: "Cliente de teste", tipoNegocio: "Padaria", responsavel: "João Arthur", bairro: "Sarandi", cidade: "Porto Alegre", regiaoId: regiao?.id, prazoPagamentoDias: 7, formaPagamento: "Pix", observacoes: "Cliente de teste do login ADM123. Apagar antes de ir pra nuvem." },
    });
    await db.usuario.update({ where: { id: adm.id }, data: { clienteId: teste.id } });
  }

  // Operação real: fornecedores, caipira orgânico, camarão e entregas ter/qui (só cria o que falta)
  await garantirOperacao(db);
}

main()
  .then(() => console.log("Banco pronto."))
  .finally(() => db.$disconnect());
