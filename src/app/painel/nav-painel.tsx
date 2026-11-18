"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CalendarClock,
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
const GRUPOS: { titulo: string | null; links: { href: string; rotulo: string; icone: LucideIcon }[] }[] = [
  {
    titulo: null,
    links: [
      { href: "/painel", rotulo: "Início", icone: House },
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

/** Ícone do item: enquanto a tela clicada carrega, vira um anel girando (resposta imediata ao clique) */
function IconeItem({ Icone }: { Icone: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-ouro" aria-hidden />
  ) : (
    <Icone className="size-[18px] shrink-0" strokeWidth={1.75} />
  );
}

/** `contadores`: bolinha com o número ao lado do item (pedidos novos, atendimentos abertos) */
export function NavPainel({ contadores = {} }: { contadores?: Record<string, number> }) {
  const rota = usePathname();

  return (
    <nav className="sem-rolagem flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:pb-4">
      {GRUPOS.map((g) => (
        <div key={g.titulo ?? "inicio"} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          {g.titulo && <p className="hidden px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-white/35 uppercase lg:block">{g.titulo}</p>}
          {g.links.map(({ href, rotulo, icone }) => {
            const ativo = href === "/painel" ? rota === href : rota.startsWith(href);
            const n = contadores[href] ?? 0;
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={ativo ? "page" : undefined}
                className={`group relative flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors duration-150 ${
                  ativo ? "bg-white/[0.09] font-medium text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {/* traço dourado do item ativo */}
                <span
                  className={`absolute top-1/2 -left-3 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ouro transition-opacity duration-200 lg:block ${ativo ? "opacity-100" : "opacity-0"}`}
                  aria-hidden
                />
                <IconeItem Icone={icone} />
                <span className="whitespace-nowrap">{rotulo}</span>
                {n > 0 && (
                  <span className="tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ouro px-1.5 text-[11px] font-bold text-terra" aria-label={`${n} pendentes`}>
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
