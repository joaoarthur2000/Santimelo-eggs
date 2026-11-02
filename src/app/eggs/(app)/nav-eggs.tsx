"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, House, ShoppingBasket, TrendingUp } from "lucide-react";

const ABAS = [
  { href: "/eggs", rotulo: "Início", icone: House },
  { href: "/eggs/pedir", rotulo: "Pedir", icone: ShoppingBasket },
  { href: "/eggs/pedidos", rotulo: "Pedidos", icone: ClipboardList },
  { href: "/eggs/precos", rotulo: "Preços", icone: TrendingUp },
  { href: "/eggs/agenda", rotulo: "Agenda", icone: CalendarDays },
];

/** Abas fixas embaixo, como app de celular */
export function NavEggs() {
  const rota = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-casca-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ABAS.map(({ href, rotulo, icone: Icone }) => {
          const ativa = href === "/eggs" ? rota === href : rota.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${ativa ? "text-casca-900" : "text-casca-500 hover:text-casca-700"}`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${ativa ? "bg-gema-400" : ""}`}>
                  <Icone className="size-5" />
                </span>
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
