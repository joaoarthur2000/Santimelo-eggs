import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { exigirPapel } from "@/lib/sessao";
import { FormClienteRapido } from "./form";

export const metadata: Metadata = { title: "Cliente novo" };

export default async function ClienteRapido() {
  await exigirPapel("DIRETOR");
  return (
    <>
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <Cabecalho titulo="Cliente novo" subtitulo="Só o nome e a forma de pagamento são obrigatórios. Salvou, o formulário limpa pro próximo." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="cartao max-w-xl p-5 sm:p-7">
          <FormClienteRapido />
        </section>
        <aside className="space-y-4 text-sm text-stone-600">
          <div className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Depois, na ficha do cliente</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>Tipo de comércio, região de entrega e prazo de pagamento.</li>
              <li>Valor de venda e de custo da caixa.</li>
              <li>Valores em aberto de entregas antigas.</li>
              <li>Acesso ao app EGGS.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
