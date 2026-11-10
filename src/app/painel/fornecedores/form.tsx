"use client";

import { useActionState, useEffect, useRef } from "react";
import { cadastrarFornecedor } from "./actions";

export function FormFornecedor() {
  const [estado, acao, enviando] = useActionState(cadastrarFornecedor, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado.ok]);

  return (
    <form ref={ref} action={acao} className="space-y-3">
      <input name="nome" required maxLength={60} placeholder="Nome do fornecedor" className="campo" />
      <input name="contato" maxLength={60} placeholder="Telefone ou WhatsApp (opcional)" className="campo" />
      <input name="produtos" maxLength={120} placeholder="O que vende (ex: ovo branco, camarão)" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Cadastrar</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Cadastrado.</p>}
      </div>
    </form>
  );
}
