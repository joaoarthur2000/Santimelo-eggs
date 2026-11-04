import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { FormLogin } from "../../login/form-login";
import { BotaoInstalar } from "../dica-instalar";
import { Guinho } from "../guinho";
import { MarcaEggs } from "../marca-eggs";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarEggs({ searchParams }: PageProps<"/eggs/entrar">) {
  const usuario = await usuarioAtual();
  if (usuario) redirect(usuario.clienteId ? "/eggs" : "/");
  const { erro, login } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))]">
        <BotaoInstalar automatico />
      </div>
      <Guinho pose="acenando" className="eggs-ginga mb-3 h-40 w-36" />
      <MarcaEggs grande />
      <div className="mt-8 w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_8px_30px_rgba(61,38,20,0.08)]">
        <h1 className="font-eggs text-2xl font-extrabold">Seus pedidos de ovos</h1>
        <p className="mt-1 text-sm text-casca-700">Exclusivo para clientes Santimelo. Use o login e a senha que você recebeu da nossa equipe.</p>
        {erro === "acesso" && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Seu acesso está desativado. Fale com a Santimelo.</p>}
        <FormLogin tema="eggs" login={typeof login === "string" ? login.toUpperCase().slice(0, 20) : ""} />
      </div>
    </main>
  );
}
