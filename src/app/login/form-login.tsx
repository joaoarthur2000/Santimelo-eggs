"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

/** Mesmo login pro painel e pro app EGGS: o papel do usuário decide pra onde ele vai */
export function FormLogin({ tema = "painel", login = "" }: { tema?: "painel" | "eggs"; login?: string }) {
  const [estado, acao, enviando] = useActionState(entrar, {});
  const eggs = tema === "eggs";
  const campo = eggs ? "campo mt-1 rounded-xl border-casca-300 py-3 text-base focus:border-gema-600 focus:ring-gema-200" : "campo mt-1.5 h-11";

  return (
    <form action={acao} className="mt-8 space-y-4">
      <input type="hidden" name="tema" value={tema} />
      <label className="block">
        <span className={`text-sm font-medium ${eggs ? "text-casca-700" : "text-stone-700"}`}>{eggs ? "Login" : "E-mail ou login"}</span>
        {eggs ? (
          <input name="email" required autoComplete="username" autoCapitalize="characters" defaultValue={login} placeholder="Ex: PAOQUENTE" className={`${campo} font-mono uppercase tracking-widest`} />
        ) : (
          <input name="email" required autoComplete="username" autoCapitalize="none" className={campo} />
        )}
      </label>
      <label className="block">
        <span className={`text-sm font-medium ${eggs ? "text-casca-700" : "text-stone-700"}`}>Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" autoFocus={!!login} className={campo} />
      </label>
      {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button
        disabled={enviando}
        className={eggs ? "w-full rounded-xl bg-casca-900 py-3.5 text-base font-bold text-gema-50 transition hover:bg-casca-700 disabled:opacity-60" : "botao-primario h-11 w-full"}
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
