import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Cabecalho, Vazio } from "@/components/ui";
import { cadastroIncompleto, faltaNoCadastro, pareceEstabelecimento } from "@/lib/cadastro";
import { db } from "@/lib/db";
import { temChaveGoogle } from "@/lib/prospeccao";
import { exigirPapel } from "@/lib/sessao";
import { ListaCompletar } from "./lista";

export const metadata: Metadata = { title: "Completar cadastros" };

export default async function Completar() {
  await exigirPapel("DIRETOR");
  const clientes = await db.cliente.findMany({ where: { ativo: true }, orderBy: { nomeFantasia: "asc" } });
  const incompletos = clientes.filter(cadastroIncompleto);
  const comGoogle = temChaveGoogle();

  return (
    <>
      <Link data-voltar href="/painel/clientes" className="mb-3 hidden items-center gap-1 text-sm text-stone-500 hover:text-marca-700 lg:inline-flex">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <Cabecalho titulo="Completar cadastros" subtitulo={incompletos.length ? `${incompletos.length} de ${clientes.length} clientes com dado faltando` : "Todos os cadastros estão completos"} />
      {!comGoogle && incompletos.length > 0 && (
        <section className="mb-5 rounded-2xl border border-ouro bg-ouro/10 p-4 text-sm text-noz lg:p-5">
          <h2 className="text-base font-semibold text-terra">A busca pelo nome ainda está no mapa aberto</h2>
          <p className="mt-1">
            Ele conhece poucos lugares e quase nunca tem telefone. Com a chave do Google, um botão preenche endereço, bairro, CEP, telefone e tipo de todos de uma vez. O passo a passo está em{" "}
            <b>clientes/Santimelo/prospeccao-bot/README.md</b>. Enquanto isso, cole o link do Google Maps de cada um.
          </p>
        </section>
      )}
      {incompletos.length === 0 ? (
        <Vazio>Nada pra completar.</Vazio>
      ) : (
        <ListaCompletar
          comGoogle={comGoogle}
          clientes={incompletos.map((c) => ({
            id: c.id,
            nome: c.nomeFantasia,
            falta: faltaNoCadastro(c),
            marcado: pareceEstabelecimento(c.nomeFantasia),
            atual: {
              endereco: c.endereco ?? "",
              bairro: c.bairro ?? "",
              cidade: c.cidade ?? "",
              cep: c.cep ?? "",
              whatsapp: c.whatsapp ?? "",
              tipoNegocio: c.tipoNegocio === "A definir" ? "" : c.tipoNegocio,
              responsavel: c.responsavel ?? "",
            },
          }))}
        />
      )}
    </>
  );
}
