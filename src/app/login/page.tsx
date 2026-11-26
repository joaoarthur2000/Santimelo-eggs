import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { metadadosDoPainel, viewportDoPainel } from "@/lib/app-painel";
import { usuarioAtual } from "@/lib/sessao";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { ...metadadosDoPainel, title: "Entrar" };
export const viewport: Viewport = viewportDoPainel;

export default async function Login() {
  if (await usuarioAtual()) redirect("/");

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#1f140e] px-4 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+48px)]">
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
