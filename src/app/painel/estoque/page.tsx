import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, ChartColumnBig, History } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { db } from "@/lib/db";
import { AbaAtual } from "./aba-atual";
import { AbaMovimentos } from "./aba-movimentos";
import { AbaRelatorio } from "./aba-relatorio";
import { ZerarTudo } from "./editar";

export const metadata: Metadata = { title: "Estoque" };

const ABAS = [
  { id: "atual", rotulo: "Estoque atual", icone: Boxes },
  { id: "movimentos", rotulo: "Movimentações", icone: History },
  { id: "relatorio", rotulo: "Relatório", icone: ChartColumnBig },
] as const;
type Aba = (typeof ABAS)[number]["id"];

export default async function Estoque({ searchParams }: PageProps<"/painel/estoque">) {
  const sp = await searchParams;
  const aba: Aba = ABAS.find((a) => a.id === sp.aba)?.id ?? "atual";
  const temSaldo = (await db.movimentoEstoque.count()) > 0;

  return (
    <>
      <Cabecalho titulo="Estoque" explica acoesNoCelular={false} subtitulo="Em caixas de 360 ovos. Compra entra em Lançar entrada; a venda sai quando o pedido é marcado Entregue.">
        <ZerarTudo desativado={!temSaldo} />
      </Cabecalho>

      <nav className="sem-rolagem mb-5 flex max-w-full gap-6 overflow-x-auto max-lg:gap-0 lg:mb-6 border-b border-stone-200" aria-label="Abas do estoque">
        {ABAS.map(({ id, rotulo, icone: Icone }) => (
          <Link
            key={id}
            href={id === "atual" ? "/painel/estoque" : `/painel/estoque?aba=${id}`}
            aria-current={aba === id ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-0.5 pb-3 text-sm max-lg:flex-1 max-lg:justify-center max-lg:pt-3 whitespace-nowrap transition-colors duration-150 ${
              aba === id ? "border-marca-900 font-semibold text-marca-950" : "border-transparent text-stone-500 hover:border-stone-300 hover:text-marca-950"
            }`}
          >
            <Icone className="size-4 max-lg:hidden" strokeWidth={1.75} /> {rotulo}
          </Link>
        ))}
      </nav>

      {aba === "atual" && <AbaAtual />}
      {aba === "movimentos" && <AbaMovimentos sp={sp} />}
      {aba === "relatorio" && <AbaRelatorio sp={sp} />}
    </>
  );
}
