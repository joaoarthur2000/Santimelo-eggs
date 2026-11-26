import type { Metadata, Viewport } from "next";
import { LogOut } from "lucide-react";
import { Marca } from "@/components/marca";
import { exigirPapel } from "@/lib/sessao";
import { sair } from "../login/actions";
import { AbasCelular, TopoCelular } from "./barra-celular";
import { NavPainel } from "./nav-painel";
import { db } from "@/lib/db";
import { contarChegaram } from "./pedidos/chegaram";
import { diaISO } from "@/lib/datas";
import { metadadosDoPainel, viewportDoPainel } from "@/lib/app-painel";

// Instalável na tela inicial do celular
export const metadata: Metadata = metadadosDoPainel;
export const viewport: Viewport = viewportDoPainel;

export default async function LayoutPainel({ children }: LayoutProps<"/painel">) {
  const usuario = await exigirPapel("DIRETOR");
  const [novos, atendimentos, atrasados] = await Promise.all([
    contarChegaram(),
    db.atendimento.count({ where: { status: "ABERTO" } }),
    // clientes que não pagaram no vencimento (à vista = no dia da entrega)
    db.cliente.count({ where: { cobrancas: { some: { pagoEm: null, vencimento: { lt: diaISO() } } } } }),
  ]);
  const iniciais = usuario.nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const contadores = { "/painel/pedidos": novos, "/painel/atendimentos": atendimentos, "/painel/clientes": atrasados, "/painel/cobrancas": atrasados };

  return (
    <div className="painel flex min-h-screen flex-col lg:flex-row">
      {/* Computador: menu lateral. Celular: topo + barra de abas (barra-celular.tsx) */}
      <aside className="hidden shrink-0 flex-col border-r border-white/5 bg-[linear-gradient(180deg,#2b1c15_0%,#1f140e_100%)] text-white lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-screen lg:w-[248px] print:hidden">
        <div className="px-6 pt-6 pb-7">
          <Marca claro />
        </div>
        <NavPainel contadores={contadores} />
        <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ouro/90 text-xs font-bold text-terra" aria-hidden>
            {iniciais}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{usuario.nome}</p>
          <form action={sair}>
            <button title="Sair" aria-label="Sair" className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>
      <TopoCelular />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-10 lg:py-9 print:p-0">{children}</main>
      <AbasCelular contadores={contadores} nome={usuario.nome} sair={sair} />
    </div>
  );
}
