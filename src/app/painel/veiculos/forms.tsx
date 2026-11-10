"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TIPOS_GASTO_VEICULO } from "@/lib/constantes";
import { lancarGasto, salvarVeiculo } from "./actions";

type Estado = { erro?: string; ok?: number };
type DadosVeiculo = {
  id: string; modelo: string; ano: number; placa: string; consumoKmL: number; precoLitro: number; kmAtual: number | null;
  ipvaAnual: number; seguroAnual: number; licenciamentoAnual: number; outrosFixosAnual: number; manutencaoPorKm: number; pneusPorKm: number;
};
const br = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

function Campo({ nome, rotulo, valor, dica }: { nome: string; rotulo: string; valor: string | number | null; dica?: string }) {
  return (
    <label className="text-xs text-stone-500">
      {rotulo}
      <input name={nome} defaultValue={typeof valor === "number" ? br(valor) : (valor ?? "")} inputMode="decimal" className="campo mt-1" />
      {dica && <span className="mt-0.5 block text-[11px] text-stone-400">{dica}</span>}
    </label>
  );
}

export function FormVeiculo({ v }: { v: DadosVeiculo }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarVeiculo.bind(null, v.id), {});
  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-stone-500 sm:col-span-2">Modelo<input name="modelo" defaultValue={v.modelo} className="campo mt-1" /></label>
        <Campo nome="ano" rotulo="Ano" valor={v.ano} />
        <label className="text-xs text-stone-500">Placa<input name="placa" defaultValue={v.placa} className="campo mt-1 font-mono uppercase" /></label>
        <Campo nome="consumoKmL" rotulo="Consumo (km/l)" valor={v.consumoKmL} dica="na cidade, com carga" />
        <Campo nome="precoLitro" rotulo="Preço do litro (R$)" valor={v.precoLitro} dica="atualiza sozinho ao lançar abastecimento" />
        <Campo nome="kmAtual" rotulo="Hodômetro (km)" valor={v.kmAtual} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Custos fixos por ano</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo nome="ipvaAnual" rotulo="IPVA (R$)" valor={v.ipvaAnual} />
        <Campo nome="seguroAnual" rotulo="Seguro (R$)" valor={v.seguroAnual} />
        <Campo nome="licenciamentoAnual" rotulo="Licenciamento (R$)" valor={v.licenciamentoAnual} />
        <Campo nome="outrosFixosAnual" rotulo="Outros fixos (R$)" valor={v.outrosFixosAnual} dica="rastreador, garagem…" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Desgaste por km rodado</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="manutencaoPorKm" rotulo="Manutenção (R$ por km)" valor={v.manutencaoPorKm} dica="revisão, óleo, freio, suspensão" />
        <Campo nome="pneusPorKm" rotulo="Pneus (R$ por km)" valor={v.pneusPorKm} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Salvar veículo</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Salvo. As rotas novas já usam esses valores.</p>}
      </div>
    </form>
  );
}

export function FormGasto({ veiculoId, hoje }: { veiculoId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(lancarGasto, {});
  const [tipo, setTipo] = useState("ABASTECIMENTO");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) ref.current?.reset(); }, [estado.ok]);
  return (
    <form ref={ref} action={acao} className="space-y-3">
      <input type="hidden" name="veiculoId" value={veiculoId} />
      <div className="grid grid-cols-2 gap-2">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo">
          {Object.entries(TIPOS_GASTO_VEICULO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
        <input name="dia" type="date" required defaultValue={hoje} className="campo" />
        <input name="valor" inputMode="decimal" required placeholder="Valor (R$)" className="campo" />
        {tipo === "ABASTECIMENTO" ? <input name="litros" inputMode="decimal" placeholder="Litros" className="campo" /> : <input name="km" inputMode="numeric" placeholder="Hodômetro (opcional)" className="campo" />}
        {tipo === "ABASTECIMENTO" && <input name="km" inputMode="numeric" placeholder="Hodômetro (opcional)" className="campo col-span-2" />}
      </div>
      <input name="descricao" maxLength={160} placeholder="Detalhe (ex: troca de óleo, posto Ipiranga)" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Lançar gasto</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Lançado.</p>}
      </div>
    </form>
  );
}
