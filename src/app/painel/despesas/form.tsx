"use client";

import { CampoData } from "@/components/campo-data";
import { useActionState, useEffect, useRef } from "react";
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from "@/lib/constantes";
import { lancarDespesa } from "./actions";

export function FormDespesa({ hoje }: { hoje: string }) {
  const [estado, acao, enviando] = useActionState(lancarDespesa, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado.ok]);

  return (
    <form ref={ref} action={acao} className="space-y-3">
      <input name="descricao" required maxLength={120} placeholder="O que foi (ex: bandejas de papelão)" className="campo" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">
          Valor (R$)
          <input name="valor" inputMode="decimal" required placeholder="0,00" className="campo mt-1" />
        </label>
        <label className="text-xs text-stone-500">
          Data
          <CampoData name="dia" required defaultValue={hoje} className="campo mt-1" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="categoria" required defaultValue="" className="campo">
          <option value="" disabled>Categoria…</option>
          {CATEGORIAS_DESPESA.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="formaPagamento" defaultValue="" className="campo">
          <option value="">Pago como? (opcional)</option>
          {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Lançar despesa</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Lançada.</p>}
      </div>
    </form>
  );
}
