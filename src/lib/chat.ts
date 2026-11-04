// Chat do Guinho (aba Ajuda do app): funil de atendimento.
// O cliente escolhe o assunto e o motivo. O que dá pra resolver sozinho leva direto pra tela certa;
// o resto vira atendimento no painel (já com setor, motivo e pedido) e segue pro WhatsApp ou pra equipe chamar.
// Sem dependência de servidor: o app usa pra montar o chat e o servidor pra conferir o que chegou.

export const SETORES = {
  VENDAS: "Vendas",
  ENTREGA: "Entregas",
  FINANCEIRO: "Financeiro",
  TECNICO: "Suporte técnico",
} as const;
export type Setor = keyof typeof SETORES;

export const CONTATOS = { WHATSAPP: "Chamou no WhatsApp", RETORNO: "Quer que a equipe chame" } as const;
export const STATUS_ATENDIMENTO = { ABERTO: "Aberto", ANDAMENTO: "Em atendimento", RESOLVIDO: "Resolvido" } as const;

type Opcao = {
  rotulo: string;
  /** Resolve sozinho: resposta do Guinho + botão pra tela do app */
  atalho?: { href: string; botao: string; resposta: string };
  /** Pergunta de qual pedido é: próximos (ainda não entregues) ou entregues (últimos dias) */
  pedido?: "proximos" | "entregues";
};

export type Assunto = { id: string; rotulo: string; emoji: string; setor: Setor; pergunta: string; opcoes: Opcao[] };

export const ASSUNTOS: Assunto[] = [
  {
    id: "pedido",
    emoji: "🛒",
    rotulo: "Meus pedidos",
    setor: "ENTREGA",
    pergunta: "Sobre pedido, o que você precisa?",
    opcoes: [
      { rotulo: "Fazer um pedido novo", atalho: { href: "/eggs/pedir", botao: "Fazer pedido", resposta: "Moleza! Toca aqui embaixo, escolhe os ovos, o dia e o horário. 🥚" } },
      {
        rotulo: "Cancelar um pedido",
        atalho: { href: "/eggs/pedidos", botao: "Ver meus pedidos", resposta: "Pedido com status Novo você cancela sozinho em Meus pedidos, no botão Cancelar. Se já saiu da fila, me chama de novo e escolhe \"Mudar um pedido\"." },
      },
      { rotulo: "Mudar um pedido", pedido: "proximos" },
      { rotulo: "Outra coisa" },
    ],
  },
  {
    id: "entrega",
    emoji: "🚚",
    rotulo: "Entrega ou produto",
    setor: "ENTREGA",
    pergunta: "Poxa! O que aconteceu?",
    opcoes: [
      { rotulo: "A entrega está atrasada", pedido: "proximos" },
      { rotulo: "Veio ovo quebrado ou trincado", pedido: "entregues" },
      { rotulo: "Faltou produto", pedido: "entregues" },
      { rotulo: "Outra coisa" },
    ],
  },
  {
    id: "pagamento",
    emoji: "💰",
    rotulo: "Pagamento",
    setor: "FINANCEIRO",
    pergunta: "Sobre pagamento, me diz:",
    opcoes: [
      { rotulo: "Ver o que tenho em aberto", atalho: { href: "/eggs/financeiro", botao: "Abrir Financeiro", resposta: "Tá tudo no Financeiro: o que está em aberto, os vencimentos e o que já foi pago." } },
      { rotulo: "Preciso do boleto ou da chave Pix" },
      { rotulo: "Paguei e ainda aparece em aberto" },
      { rotulo: "Outra coisa" },
    ],
  },
  {
    id: "vendas",
    emoji: "🤝",
    rotulo: "Falar com vendas",
    setor: "VENDAS",
    pergunta: "Bora conversar! Sobre o quê?",
    opcoes: [{ rotulo: "Preço e condições" }, { rotulo: "Aumentar a quantidade" }, { rotulo: "Mudar dia ou horário de entrega" }, { rotulo: "Outra coisa" }],
  },
  {
    id: "app",
    emoji: "📱",
    rotulo: "Problema no app",
    setor: "TECNICO",
    pergunta: "Vamos resolver! O que está acontecendo?",
    opcoes: [{ rotulo: "Não consigo fazer pedido" }, { rotulo: "Uma tela deu erro" }, { rotulo: "Dúvida de como usar" }, { rotulo: "Outra coisa" }],
  },
];

/** Texto que o cliente manda no WhatsApp: a equipe já sabe o assunto antes de responder */
export function textoWhatsapp(a: { protocolo: number; responsavel: string; cliente: string; setor: Setor; motivo: string; pedidoId?: number | null; detalhe?: string | null }) {
  return [
    `Olá! Sou ${a.responsavel}, da ${a.cliente}.`,
    `Protocolo #${a.protocolo} · ${SETORES[a.setor]}: ${a.motivo}${a.pedidoId ? ` (pedido #${a.pedidoId})` : ""}.`,
    a.detalhe ? `"${a.detalhe}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
