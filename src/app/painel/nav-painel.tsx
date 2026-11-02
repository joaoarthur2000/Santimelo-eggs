"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, LayoutDashboard, Smartphone, Tags, Truck, Users, Wallet, Warehouse } from "lucide-react";

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
      { href: "/painel/precos", rotulo: "Preços", icone: Tags },
    ],
  },
  {
    titulo: "Operação",
    links: [
      { href: "/painel/entregas", rotulo: "Entregas", icone: Truck },
      { href: "/painel/cobrancas", rotulo: "Cobranças", icone: Wallet },
      { href: "/painel/estoque", rotulo: "Estoque", icone: Warehouse },
    ],
  },
  {
    titulo: "App",
    links: [{ href: "/painel/aplicativo", rotulo: "Aplicativo", icone: Smartphone }],
  },
];

export function NavPainel() {
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
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
