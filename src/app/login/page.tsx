import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { usuarioAtual } from "@/lib/sessao";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function Login() {
  if (await usuarioAtual()) redirect("/");

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#1f140e] px-4 py-12">
      {/* brilho dourado discreto atrás do cartão (estático, não pesa) */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-ouro/15 blur-3xl" aria-hidden />
      <div className="painel-entra relative w-full max-w-[380px]">
        <div className="rounded-3xl bg-white p-8 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.5)] ring-1 ring-black/5 sm:p-9">
          <Marca tamanho="lg" />
          <p className="mt-3 text-sm text-stone-500">Painel de gestão da equipe Santimelo.</p>
          <FormLogin />
        </div>
        <p className="mt-6 text-center text-xs text-white/35">EGGS by Santimelo</p>
      </div>
    </main>
  );
}
