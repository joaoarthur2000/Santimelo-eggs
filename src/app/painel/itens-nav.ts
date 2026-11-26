import {
  Boxes,
  CalendarClock,
  CalendarDays,
  ChartColumnBig,
  ClipboardList,
  HandCoins,
  Handshake,
  House,
  MessagesSquare,
  Receipt,
  Route,
  Smartphone,
  Store,
  Tags,
  Target,
  Truck,
  type LucideIcon,
} from "lucide-react";

// Agrupado como a operação funciona: vendas → entrega e dinheiro → gestão
export const GRUPOS: { titulo: string | null; links: { href: string; rotulo: string; icone: LucideIcon }[] }[] = [
  {
    titulo: null,
    links: [
      { href: "/painel", rotulo: "Início", icone: House },
      { href: "/painel/dia", rotulo: "Dia a dia", icone: CalendarDays },
      { href: "/painel/relatorios", rotulo: "Relatórios", icone: ChartColumnBig },
    ],
  },
  {
    titulo: "Vendas",
    links: [
      { href: "/painel/pedidos", rotulo: "Pedidos", icone: ClipboardList },
      { href: "/painel/clientes", rotulo: "Clientes", icone: Store },
      { href: "/painel/prospeccao", rotulo: "Prospecção", icone: Target },
      { href: "/painel/atendimentos", rotulo: "Atendimentos", icone: MessagesSquare },
      { href: "/painel/precos", rotulo: "Preços", icone: Tags },
    ],
  },
  {
    titulo: "Operação",
    links: [
      { href: "/painel/rotas", rotulo: "Rotas", icone: Route },
      { href: "/painel/entregas", rotulo: "Regiões e horários", icone: CalendarClock },
      { href: "/painel/estoque", rotulo: "Estoque", icone: Boxes },
      { href: "/painel/fornecedores", rotulo: "Fornecedores", icone: Handshake },
      { href: "/painel/veiculos", rotulo: "Veículos", icone: Truck },
    ],
  },
  {
    titulo: "Financeiro",
    links: [
      { href: "/painel/cobrancas", rotulo: "Cobranças", icone: HandCoins },
      { href: "/painel/despesas", rotulo: "Despesas", icone: Receipt },
    ],
  },
  {
    titulo: "App",
    links: [{ href: "/painel/aplicativo", rotulo: "Aplicativo", icone: Smartphone }],
  },
];
