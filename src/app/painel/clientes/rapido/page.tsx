import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { diaISO } from "@/lib/datas";
import { db } from "@/lib/db";
import { custosMedios } from "@/lib/estoque";
import { FormClienteRapido } from "./form";

export const metadata: Metadata = { title: "Cliente novo" };

export default async function ClienteRapido() {
  const [regioes, custos, branco] = await Promise.all([
    db.regiao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    custosMedios(new Date()),
    db.item.findFirst({ where: { nome: "Ovo branco" } }),
  ]);
  // custo médio das compras lançadas; sem compra ainda, o valor que a Santimelo paga hoje (R$ 140/cx, informado em 2026-11-09)
  const custoAtual = (branco ? custos.get(branco.id) : undefined) ?? 140;

  return (
    <>
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <Cabecalho titulo="Cliente novo" subtitulo="Tudo numa tela, pra cadastrar a carteira rápido. O acesso ao app EGGS pode ser liberado depois, na ficha do cliente." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="cartao p-5 sm:p-7">
          <FormClienteRapido regioes={regioes} hoje={diaISO()} custoAtual={custoAtual} />
        </section>
        <aside className="space-y-4 text-sm text-stone-600">
          <div className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Como fica depois</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>O <b>valor de venda</b> vira o preço combinado da caixa de ovo branco desse cliente: todo pedido dele já sai nesse valor.</li>
              <li>O <b>valor de custo</b> mostra a margem dele na ficha.</li>
              <li>O <b>valor em aberto</b> aparece em Cobranças. Se passar do vencimento sem pagar, o cliente fica marcado em vermelho e o painel avisa.</li>
            </ul>
          </div>
          <Link href="/painel/clientes/novo" className="block rounded-xl border border-dashed border-stone-300 p-4 hover:border-marca-600">
            Precisa liberar o app agora? Use o <b>cadastro completo com acesso ao EGGS</b> →
          </Link>
        </aside>
      </div>
    </>
  );
}
