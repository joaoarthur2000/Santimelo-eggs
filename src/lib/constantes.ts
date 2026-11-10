// Valores fixos usados nos campos String do banco (ver prisma/schema.prisma).

export const PAPEIS = { DIRETOR: "DIRETOR", CLIENTE: "CLIENTE" } as const;
export type Papel = (typeof PAPEIS)[keyof typeof PAPEIS];

/** Tela inicial de cada papel: equipe no painel, cliente no app */
export const INICIO_DO_PAPEL: Record<Papel, string> = { DIRETOR: "/painel", CLIENTE: "/eggs" };

export const STATUS_PEDIDO = {
  NOVO: "Novo",
  SEPARACAO: "Em separação",
  ENTREGA: "Saiu pra entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
} as const;
export type StatusPedido = keyof typeof STATUS_PEDIDO;

// Ordem do fluxo de um pedido (o botão "avançar" segue essa sequência)
export const FLUXO_PEDIDO: StatusPedido[] = ["NOVO", "SEPARACAO", "ENTREGA", "ENTREGUE"];

export const ORIGENS_PEDIDO = {
  APP: "App EGGS",
  PAINEL: "Painel",
  WHATSAPP: "WhatsApp",
} as const;

// A Santimelo vende ovo branco, ovo caipira orgânico e camarão (pacote 800 g congelado), entregando direto
// pra estabelecimentos e pro consumidor final, em Porto Alegre e região (atualizado em 2026-11-09)
export const TIPOS_NEGOCIO = ["Padaria", "Confeitaria", "Restaurante", "Lancheria", "Mercado", "Consumidor final"] as const;

// Entregas: terças e quintas, das 05h às 11h
export const DIAS_ENTREGA = [2, 4] as const;
export const HORARIO_ENTREGA = "05h às 11h";

// Gastos da operação fora a compra de mercadoria. Tudo do carro (combustível, manutenção, IPVA...) fica em Veículos
export const CATEGORIAS_DESPESA = ["Embalagens", "Pessoal", "Aluguel e estrutura", "Impostos e taxas", "Marketing", "Outros"] as const;

// Gastos reais com o veículo (o que saiu do caixa)
export const TIPOS_GASTO_VEICULO = {
  ABASTECIMENTO: "Abastecimento",
  MANUTENCAO: "Manutenção e revisão",
  PNEUS: "Pneus",
  IPVA: "IPVA",
  SEGURO: "Seguro",
  LICENCIAMENTO: "Licenciamento",
  LAVAGEM: "Lavagem",
  ESTACIONAMENTO: "Estacionamento e pedágio",
  MULTA: "Multa",
  OUTRO: "Outro",
} as const;
export type TipoGastoVeiculo = keyof typeof TIPOS_GASTO_VEICULO;

export const CIDADES = [
  "Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Alvorada", "Viamão", "Esteio", "Sapucaia do Sul",
  "São Leopoldo", "Novo Hamburgo", "Guaíba", "Eldorado do Sul",
] as const;

/** Condição de pagamento: 0 = à vista (na entrega); o resto é prazo em dias depois da entrega */
export const PRAZOS_PAGAMENTO = [0, 7, 14, 21, 28, 30] as const;
export const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Boleto", "Cartão", "Transferência"] as const;
export const condicaoPagamento = (prazo: number | null | undefined) => (prazo ? `A prazo · ${prazo} dias` : "À vista");

/** Ovos são contados em caixas; o camarão, em pacotes de 800 g */
export const categoriaDoItem = (unidadeEstoque: string) => (unidadeEstoque === "caixa" ? "Ovos" : "Congelados");
export const ehOvo = (unidadeEstoque: string) => unidadeEstoque === "caixa";

export const UNIDADES: Record<string, string> = {
  bandeja: "bdj",
  caixa: "cx",
  pacote: "pct", // plastificado de 20 ovos
};

// Extrato do estoque (MovimentoEstoque.tipo)
export const TIPOS_MOVIMENTO = {
  COMPRA: "Compra",
  VENDA: "Venda",
  PERDA: "Perda",
  AJUSTE: "Ajuste de contagem",
} as const;
export type TipoMovimento = keyof typeof TIPOS_MOVIMENTO;

// Origem das compras lançadas antes do cadastro de fornecedores (2026-11-09). Compras novas usam Fornecedor
export const ORIGENS_COMPRA = {
  GRANJA: "Granja",
  CEASA: "CEASA",
  FORNECEDOR: "Outro fornecedor",
} as const;

// Períodos dos relatórios
export const PERIODOS = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
} as const;
export type Periodo = keyof typeof PERIODOS;

// App
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const ASSINATURA_EGGS = "Guinho";
/** Quantos dias antes do vencimento o app avisa o cliente */
export const AVISO_PAGAMENTO_DIAS = 3;
