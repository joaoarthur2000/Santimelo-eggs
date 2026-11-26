import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { diaISO, diaValido, formatarDia, somarDias } from "@/lib/datas";
import { dadosDoFormPedido } from "../dados-form";
import { FormPedido } from "./form-pedido";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NovoPedido({ searchParams }: PageProps<"/painel/pedidos/novo">) {
  const { dia: diaParam, voltar } = await searchParams;
  const hoje = diaISO();
  const dia = diaParam ? diaValido(diaParam) : somarDias(hoje, 1);
  const doDia = voltar === "dia"; // veio do Dia a dia: adicionar uma entrega naquela data

  return (
    <>
      {doDia && (
        <Link data-voltar href={`/painel/dia?dia=${dia}`} className="mb-3 hidden items-center gap-1 text-sm text-stone-500 hover:text-marca-700 lg:inline-flex">
          <ArrowLeft className="size-4" /> Dia a dia
        </Link>
      )}
      <Cabecalho
        titulo={doDia ? "Adicionar entrega" : "Novo pedido"}
        explica={!doDia}
        subtitulo={doDia ? formatarDia(dia) : "Lançamento manual (ex: pedido que chegou pelo WhatsApp). Cada produto leva o valor do dia e o fornecedor de onde saem as caixas."}
      />
      <FormPedido {...await dadosDoFormPedido()} hoje={hoje} diaInicial={dia} voltarProDia={doDia} />
    </>
  );
}
