import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { linkDoApp } from "@/lib/rede";
import { exigirPapel } from "@/lib/sessao";
import { CadastroCliente } from "./cadastro";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  await exigirPapel("DIRETOR");
  const regioes = await db.regiao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, bairros: true } });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <header className="mb-6 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/eggs/guinho/guinho-acenando.png" alt="" className="eggs-ginga h-24 shrink-0" />
        <div>
          <h1 className="text-3xl font-extrabold text-marca-950">Bora cadastrar um cliente?</h1>
          <p className="mt-1 text-stone-500">3 passinhos e ele já pode pedir ovos pelo app. O que você preencher aqui já vale no app dele.</p>
        </div>
      </header>
      <CadastroCliente regioes={regioes} linkApp={linkDoApp()} />
    </div>
  );
}
