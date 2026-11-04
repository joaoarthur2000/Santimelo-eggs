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

// A Santimelo vende só ovos (bandeja de 30 e caixa de 30 dúzias) pra esses 4 tipos de negócio, em Porto Alegre e região
export const TIPOS_NEGOCIO = ["Restaurante", "Lancheria", "Padaria", "Confeitaria"] as const;

export const CIDADES = [
  "Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Alvorada", "Viamão", "Esteio", "Sapucaia do Sul",
  "São Leopoldo", "Novo Hamburgo", "Guaíba", "Eldorado do Sul",
] as const;

/** Condição de pagamento: 0 = à vista (na entrega); o resto é prazo em dias depois da entrega */
export const PRAZOS_PAGAMENTO = [0, 7, 14, 21, 28, 30] as const;
export const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Boleto", "Cartão", "Transferência"] as const;
export const condicaoPagamento = (prazo: number | null | undefined) => (prazo ? `A prazo · ${prazo} dias` : "À vista");

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

// De onde veio a compra: granja; se a granja não entregar, CEASA
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
