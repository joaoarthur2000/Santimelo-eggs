"use client";

import { useActionState } from "react";
import { liberarProduto } from "./actions";

/** Produto novo (ex: camarão) que espera o primeiro preço pra aparecer no app */
export function FormLiberarProduto({ produtoId, nome }: { produtoId: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(liberarProduto, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="produtoId" value={produtoId} />
      <label className="flex-1 text-xs text-stone-500">
        Preço de venda de {nome} (R$)
        <input name="preco" inputMode="decimal" required placeholder="0,00" className="campo mt-1" />
      </label>
      <button disabled={enviando} className="botao-primario">Liberar no app</button>
      {estado.erro && <p className="w-full text-sm text-red-600">{estado.erro}</p>}
    </form>
  );
}
