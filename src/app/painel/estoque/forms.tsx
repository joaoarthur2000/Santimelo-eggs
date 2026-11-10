"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registrarCompra, registrarContagem, registrarPerda } from "./actions";

export type OpcaoItem = { id: string; nome: string; codigo: string | null; unidade: string; categoria: string };
type Estado = { erro?: string; ok?: number };

const ACOES = { compra: registrarCompra, perda: registrarPerda, contagem: registrarContagem };
const TITULOS = { compra: "Compra (entrada)", perda: "Perda", contagem: "Contagem" };

/** Seletor de item agrupado por categoria, com código */
function SeletorItem({ itens, valor, onChange }: { itens: OpcaoItem[]; valor: string; onChange: (v: string) => void }) {
  const categorias = [...new Set(itens.map((i) => i.categoria))];
  return (
    <select name="itemId" required value={valor} onChange={(e) => onChange(e.target.value)} className="campo">
      <option value="">Produto…</option>
      {categorias.map((c) => (
        <optgroup key={c} label={c}>
          {itens
            .filter((i) => i.categoria === c)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} {i.nome}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Compra, perda ou contagem, em abas */
export type OpcaoFornecedor = { id: string; nome: string };

export function FormMovimento({ itens, fornecedores, itemInicial = "" }: { itens: OpcaoItem[]; fornecedores: OpcaoFornecedor[]; itemInicial?: string }) {
  const [aba, setAba] = useState<keyof typeof ACOES>("compra");
  const [itemId, setItemId] = useState(itemInicial);
  const [estado, acao, enviando] = useActionState<Estado, FormData>(ACOES[aba], {});
  const ref = useRef<HTMLFormElement>(null);
  const unidade = itens.find((i) => i.id === itemId)?.unidade ?? itens[0]?.unidade ?? "caixa";
  const abrev = unidade === "caixa" ? "cx" : unidade;

  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado.ok]);

  return (
    <div>
      <div className="mb-3 flex rounded-lg bg-stone-100 p-1 text-sm">
        {(Object.keys(ACOES) as (keyof typeof ACOES)[]).map((a) => (
          <button key={a} type="button" onClick={() => setAba(a)} className={`flex-1 rounded-md px-2 py-1.5 font-medium ${aba === a ? "bg-white text-marca-900 shadow-sm" : "text-stone-600"}`}>
            {TITULOS[a]}
          </button>
        ))}
      </div>
      <form ref={ref} action={acao} key={aba} className="space-y-3">
        <SeletorItem itens={itens} valor={itemId} onChange={setItemId} />
        {aba === "compra" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-stone-500">
                Quantidade ({abrev})
                <input name="quantidade" inputMode="decimal" required placeholder="0" className="campo mt-1" />
              </label>
              <label className="text-xs text-stone-500">
                Custo por {abrev} (R$)
                <input name="custoUnit" inputMode="decimal" placeholder="0,00" className="campo mt-1" />
              </label>
              <label className="text-xs text-stone-500">
                ou total (R$)
                <input name="custoTotal" inputMode="decimal" placeholder="0,00" className="campo mt-1" />
              </label>
            </div>
            <select name="fornecedorId" required defaultValue="" className="campo">
              <option value="" disabled>Fornecedor…</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
            <input name="observacao" placeholder="Observação (nota, lote...)" className="campo" />
          </>
        )}
        {aba === "perda" && (
          <>
            <label className="block text-xs text-stone-500">
              Quantidade perdida ({abrev})
              <input name="quantidade" inputMode="decimal" required placeholder="0" className="campo mt-1" />
            </label>
            <input name="observacao" required placeholder="Motivo (estragou, amassou, trincou...)" className="campo" />
          </>
        )}
        {aba === "contagem" && (
          <label className="block text-xs text-stone-500">
            Quanto tem de verdade agora ({abrev})
            <input name="contado" inputMode="decimal" required placeholder="0" className="campo mt-1" />
            <span className="mt-1 block">O sistema lança a diferença como ajuste.</span>
          </label>
        )}
        <div className="flex items-center gap-3">
          <button disabled={enviando} className="botao-primario">Registrar</button>
          {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
          {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Registrado.</p>}
        </div>
      </form>
    </div>
  );
}
