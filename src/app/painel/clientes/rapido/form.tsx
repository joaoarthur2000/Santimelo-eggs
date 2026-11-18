"use client";

import { CampoData } from "@/components/campo-data";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { PAGAMENTOS_RAPIDO } from "@/lib/constantes";
import { cadastrarClienteRapido, lancarEmAberto, salvarValoresCaixa, type EstadoCadastro } from "./actions";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d,.-]/g, "").replace(",", ".")));
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Margem e markup na hora, enquanto digita os valores da caixa */
function MargemAoVivo({ venda, custo }: { venda: string; custo: string }) {
  const v = num(venda), c = num(custo);
  if (!v || !c) return <p className="text-xs text-stone-500">Preencha venda e custo pra ver a margem.</p>;
  const lucro = v - c;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${lucro >= 0 ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>
      Lucro de <b className="tabular">{brl.format(lucro)}</b> por caixa · margem <b className="tabular">{pctFmt.format(lucro / v)}</b> · markup <b className="tabular">{pctFmt.format(lucro / c)}</b>
    </p>
  );
}

export function FormClienteRapido() {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(cadastrarClienteRapido, {});
  // a cada cliente salvo o formulário nasce de novo, vazio, pronto pro próximo
  return <CamposCliente key={estado.ok ?? 0} estado={estado} acao={acao} enviando={enviando} />;
}

function CamposCliente({ estado, acao, enviando }: { estado: EstadoCadastro; acao: (f: FormData) => void; enviando: boolean }) {
  const rotulo = "block text-sm font-medium text-stone-700";
  return (
    <form action={acao} className="space-y-4">
      {estado.ok && estado.id && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
          <b>{estado.nome}</b> cadastrado. <Link href={`/painel/clientes/${estado.id}`} className="font-semibold underline">Abrir ficha</Link> ou continue com o próximo.
        </p>
      )}

      <label className={rotulo}>
        Nome do cliente
        <input name="nomeFantasia" required autoFocus maxLength={80} placeholder="Ex: Padaria Pão Quente" className="campo mt-1" />
      </label>

      <fieldset>
        <legend className={rotulo}>Forma de pagamento</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {PAGAMENTOS_RAPIDO.map((f, i) => (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="pagamento" value={f} defaultChecked={i === 0} required className="peer sr-only" />
              <span className="block rounded-xl border border-stone-300 py-2.5 text-center font-semibold text-stone-600 transition peer-checked:border-marca-700 peer-checked:bg-marca-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-marca-600">
                {f === "NF" ? "Nota fiscal" : f}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={rotulo}>
        Endereço <span className="font-normal text-stone-400">(opcional)</span>
        <input name="endereco" maxLength={200} placeholder="Rua, número e bairro" className="campo mt-1" />
      </label>

      <label className={rotulo}>
        Telefone / WhatsApp <span className="font-normal text-stone-400">(opcional)</span>
        <input name="whatsapp" inputMode="tel" placeholder="(51) 99999-9999" className="campo mt-1" />
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button disabled={enviando} className="botao-primario px-6 py-2.5">{enviando ? "Salvando…" : "Salvar e cadastrar o próximo"}</button>
        {estado.erro && <p className="text-sm text-red-600" role="alert">{estado.erro}</p>}
      </div>
    </form>
  );
}

/** Ficha do cliente: valores da caixa */
export function FormValoresCaixa({ clienteId, venda, custo }: { clienteId: string; venda: number | null; custo: number | null }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(salvarValoresCaixa.bind(null, clienteId), {});
  const f = (v: number | null) => (v ? String(v.toFixed(2)).replace(".", ",") : "");
  const [v, setV] = useState(f(venda));
  const [c, setC] = useState(f(custo));
  return (
    <form action={acao} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">Venda da caixa (R$)<input name="valorVenda" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className="campo mt-1" /></label>
        <label className="text-xs text-stone-500">Custo da caixa (R$)<input name="valorCusto" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} className="campo mt-1" /></label>
      </div>
      <MargemAoVivo venda={v} custo={c} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Salvar valores</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Salvo.</p>}
      </div>
    </form>
  );
}

/** Ficha do cliente: lançar valor em aberto avulso */
export function FormEmAberto({ clienteId, hoje }: { clienteId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(lancarEmAberto.bind(null, clienteId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) ref.current?.reset(); }, [estado.ok]);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input name="valor" inputMode="decimal" required placeholder="Valor (R$)" className="campo" />
        <CampoData name="vencimento" required defaultValue={hoje} className="campo" />
      </div>
      <input name="descricao" maxLength={120} placeholder="Do que é (ex: entrega de 04/11)" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-secundario">Lançar em aberto</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Lançado.</p>}
      </div>
    </form>
  );
}
