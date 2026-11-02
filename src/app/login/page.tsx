import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { usuarioAtual } from "@/lib/sessao";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function Login() {
  if (await usuarioAtual()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-marca-900 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <Marca tamanho="lg" />
        <p className="mt-2 text-sm text-stone-500">Painel da equipe Santimelo.</p>
        <FormLogin />
      </div>
    </main>
  );
}
