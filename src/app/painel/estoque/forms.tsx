"use client";

import { CampoData } from "@/components/campo-data";
import { useActionState, useEffect, useRef, useState } from "react";
import { reais } from "@/lib/formato";
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

// "130", "130,50", "1.250,00" → número; vazio ou inválido = null
const numero = (v: string) => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

/** Data do lançamento: calendário ou digitada (dd/mm/aaaa). Serve pra lançar compra/perda antiga. */
function DataDoLancamento({ hoje, rotulo, valor, onChange }: { hoje: string; rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-stone-500">
      {rotulo}
      <CampoData name="dia" required value={valor} onChange={onChange} max={hoje} min="2020-01-01" className="campo mt-1" />
    </label>
  );
}

/** Quantidade × custo da caixa, com o total calculado sozinho */
function ValoresCompra({ abrev }: { abrev: string }) {
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const q = numero(qtd);
  const c = numero(custo);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">
          Quantidade ({abrev})
          <input name="quantidade" inputMode="decimal" required placeholder="0" value={qtd} onChange={(e) => setQtd(e.target.value)} className="campo mt-1" />
        </label>
        <label className="text-xs text-stone-500">
          Valor por {abrev} (R$)
          <input name="custoUnit" inputMode="decimal" required placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} className="campo mt-1" />
        </label>
      </div>
      <p className="flex items-baseline justify-between rounded-xl bg-gema-400/15 px-4 py-3">
        <span className="text-sm text-stone-600">Total da compra</span>
        <span className="tabular text-xl font-extrabold text-marca-950">{q && c ? reais(q * c) : "R$ 0,00"}</span>
      </p>
    </>
  );
}

/** Compra, perda ou contagem, em abas */
export type OpcaoFornecedor = { id: string; nome: string };

export function FormMovimento({ itens, fornecedores, hoje, itemInicial = "" }: { itens: OpcaoItem[]; fornecedores: OpcaoFornecedor[]; hoje: string; itemInicial?: string }) {
  const [aba, setAba] = useState<keyof typeof ACOES>("compra");
  const [itemId, setItemId] = useState(itemInicial);
  const [dia, setDia] = useState(hoje); // fica entre um lançamento e outro: facilita lançar várias compras antigas
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
            <DataDoLancamento hoje={hoje} rotulo="Data da compra" valor={dia} onChange={setDia} />
            <ValoresCompra key={estado.ok ?? 0} abrev={abrev} />
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
            <DataDoLancamento hoje={hoje} rotulo="Data da perda" valor={dia} onChange={setDia} />
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
