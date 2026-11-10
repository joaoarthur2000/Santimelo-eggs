"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Car, ClipboardList, Handshake, Headset, LayoutDashboard, Radar, Receipt, Route, Smartphone, Tags, Truck, Users, Wallet, Warehouse } from "lucide-react";

// Agrupado como a operação funciona: vendas → entrega e dinheiro → gestão
const GRUPOS = [
  {
    titulo: null,
    links: [
      { href: "/painel", rotulo: "Início", icone: LayoutDashboard },
      { href: "/painel/relatorios", rotulo: "Relatórios", icone: BarChart3 },
    ],
  },
  {
    titulo: "Vendas",
    links: [
      { href: "/painel/pedidos", rotulo: "Pedidos", icone: ClipboardList },
      { href: "/painel/clientes", rotulo: "Clientes", icone: Users },
      { href: "/painel/prospeccao", rotulo: "Prospecção", icone: Radar },
      { href: "/painel/atendimentos", rotulo: "Atendimentos", icone: Headset },
      { href: "/painel/precos", rotulo: "Preços", icone: Tags },
    ],
  },
  {
    titulo: "Operação",
    links: [
      { href: "/painel/rotas", rotulo: "Rotas", icone: Route },
      { href: "/painel/entregas", rotulo: "Regiões e horários", icone: Truck },
      { href: "/painel/estoque", rotulo: "Estoque", icone: Warehouse },
      { href: "/painel/fornecedores", rotulo: "Fornecedores", icone: Handshake },
      { href: "/painel/veiculos", rotulo: "Veículos", icone: Car },
    ],
  },
  {
    titulo: "Financeiro",
    links: [
      { href: "/painel/cobrancas", rotulo: "Cobranças", icone: Wallet },
      { href: "/painel/despesas", rotulo: "Despesas", icone: Receipt },
    ],
  },
  {
    titulo: "App",
    links: [{ href: "/painel/aplicativo", rotulo: "Aplicativo", icone: Smartphone }],
  },
];

/** `contadores`: bolinha com o número ao lado do item (pedidos novos, atendimentos abertos) */
export function NavPainel({ contadores = {} }: { contadores?: Record<string, number> }) {
  const rota = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
      {GRUPOS.map((g) => (
        <div key={g.titulo ?? "inicio"} className="flex shrink-0 gap-1 lg:flex-col">
          {g.titulo && <p className="hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-marca-200/60 lg:block">{g.titulo}</p>}
          {g.links.map(({ href, rotulo, icone: Icone }) => {
            const ativo = href === "/painel" ? rota === href : rota.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  ativo ? "bg-white/15 font-semibold text-white" : "text-marca-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icone className="size-4" />
                {rotulo}
                {!!contadores[href] && (
                  <span className="ml-auto rounded-full bg-gema-400 px-2 py-0.5 text-xs font-bold text-casca-900" aria-label={`${contadores[href]} novos`}>{contadores[href]}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
