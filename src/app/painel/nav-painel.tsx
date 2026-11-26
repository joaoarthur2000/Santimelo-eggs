"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { GRUPOS } from "./itens-nav";

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
    <nav className="sem-rolagem flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
      {GRUPOS.map((g) => (
        <div key={g.titulo ?? "inicio"} className="flex shrink-0 flex-col gap-0.5">
          {g.titulo && <p className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-white/35 uppercase">{g.titulo}</p>}
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
                  className={`absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ouro transition-opacity duration-200 ${ativo ? "opacity-100" : "opacity-0"}`}
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
