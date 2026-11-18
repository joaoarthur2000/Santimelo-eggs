"use client";

import { CampoData } from "@/components/campo-data";
import { useActionState, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { FORMAS_PAGAMENTO_FORNECEDOR } from "@/lib/constantes";
import { reais } from "@/lib/formato";
import { lancarCompra, registrarPagamento, type Estado } from "./actions";

type Opcao = { id: string; nome: string };

// "185", "185,50", "1.250,00" → número; vazio ou inválido = null
const numero = (v: string) => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

/** Quantidade × valor da caixa, com o total na hora. Nasce vazio a cada compra salva. */
function Valores() {
  const [caixas, setCaixas] = useState("");
  const [valor, setValor] = useState("");
  const q = numero(caixas);
  const v = numero(valor);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-stone-600">
          Caixas
          <input name="quantidade" required inputMode="decimal" placeholder="Ex: 30" value={caixas} onChange={(e) => setCaixas(e.target.value)} className="campo mt-1" />
        </label>
        <label className="text-xs font-medium text-stone-600">
          Valor da caixa (R$)
          <input name="custoUnit" required inputMode="decimal" placeholder="Ex: 140,00" value={valor} onChange={(e) => setValor(e.target.value)} className="campo mt-1" />
        </label>
      </div>
      <p className="flex items-baseline justify-between rounded-xl bg-gema-400/15 px-4 py-3">
        <span className="text-sm whitespace-nowrap text-stone-600">Total</span>
        <span className="tabular text-xl font-extrabold text-marca-950">{q && v ? reais(q * v) : "R$ 0,00"}</span>
      </p>
    </>
  );
}

export function FormCompra({ fornecedores, itens, marcas, hoje }: { fornecedores: Opcao[]; itens: Opcao[]; marcas: string[]; hoje: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(lancarCompra, {});
  const rotulo = "text-xs font-medium text-stone-600";
  if (fornecedores.length === 0) return <p className="text-sm text-stone-500">Cadastre um fornecedor primeiro.</p>;
  return (
    <form action={acao} className="space-y-3">
      <label className={`${rotulo} block`}>
        Fornecedor
        <select name="fornecedorId" required defaultValue={fornecedores[0].id} className="campo mt-1">
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3">
        <label className={rotulo}>
          Data que pegou
          <CampoData name="dia" required defaultValue={hoje} max={hoje} className="campo mt-1" />
        </label>
        <label className={rotulo}>
          Tipo de ovo
          <select name="itemId" required defaultValue={itens[0]?.id} className="campo mt-1">
            {itens.map((i) => (
              <option key={i.id} value={i.id}>{i.nome}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={`${rotulo} block`}>
        Marca dos ovos
        <input name="marca" list="marcas-ovo" maxLength={60} placeholder="Ex: Granja Boa Vista" className="campo mt-1" />
        <datalist id="marcas-ovo">
          {marcas.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <Valores key={estado.ok ?? 0} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={enviando} className="botao-primario">{enviando ? "Salvando…" : "Lançar compra"}</button>
        {estado.erro && <p className="text-sm text-red-600" role="alert">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700" role="status">Compra lançada.</p>}
      </div>
    </form>
  );
}

/** No cartão do fornecedor: registra quanto foi pago a ele (abate do "A pagar") */
export function FormPagamento({ fornecedorId, hoje }: { fornecedorId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(registrarPagamento.bind(null, fornecedorId), {});
  return (
    <form key={estado.ok ?? 0} action={acao} className="space-y-1.5">
      <p className="text-xs font-medium text-stone-600">Registrar pagamento a ele</p>
      {/* sem padrão marcado: obriga a escolher, pra não lançar Pix que foi dinheiro */}
      <div role="radiogroup" aria-label="Como foi pago" className="grid grid-cols-2 gap-1 rounded-[10px] bg-stone-100 p-1">
        {FORMAS_PAGAMENTO_FORNECEDOR.map((f) => {
          const Icone = f === "Pix" ? QrCode : Banknote;
          return (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="forma" value={f} required className="peer sr-only" />
              <span className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm text-stone-500 transition-[background-color,color,box-shadow] duration-150 peer-checked:bg-white peer-checked:font-semibold peer-checked:text-marca-950 peer-checked:shadow-[0_1px_2px_rgb(41_28_18/0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-marca-500/30 hover:text-marca-950">
                <Icone className="size-4" strokeWidth={1.75} /> {f}
              </span>
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <input name="valor" required inputMode="decimal" placeholder="Valor (R$)" aria-label="Valor pago" className="campo py-1.5" />
        <CampoData name="dia" required defaultValue={hoje} max={hoje} aria-label="Data do pagamento" className="campo py-1.5" />
      </div>
      <button disabled={enviando} className="botao-secundario w-full py-1.5">{enviando ? "Salvando…" : "Registrar pagamento"}</button>
      {estado.erro && <p className="text-xs text-red-600" role="alert">{estado.erro}</p>}
      {estado.ok && !estado.erro && <p className="text-xs text-marca-700" role="status">Pagamento registrado.</p>}
    </form>
  );
}
