"use client";

import { useActionState } from "react";
import { LoaderCircle, Route } from "lucide-react";
import { gerarRota, salvarConfigRota } from "./actions";

type Estado = { erro?: string; ok?: number; aviso?: string };

export function BotaoGerarRota({ dia, jaTem }: { dia: string; jaTem: boolean }) {
  const [estado, acao, gerando] = useActionState<Estado>(gerarRota.bind(null, dia), {});
  return (
    <form action={acao} className="space-y-2">
      <button disabled={gerando} className="botao-primario">
        {gerando ? <LoaderCircle className="size-4 animate-spin" /> : <Route className="size-4" />}
        {gerando ? "Calculando a rota… (localiza endereço novo, leva uns segundos)" : jaTem ? "Gerar a rota de novo" : "Gerar a rota do dia"}
      </button>
      {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      {estado.aviso && <p className="text-sm text-amber-700">{estado.aviso}</p>}
    </form>
  );
}

export function FormConfigRota({ saida, consumo, preco }: { saida: string | null; consumo: number; preco: number }) {
  const [estado, acao, salvando] = useActionState<Estado, FormData>(salvarConfigRota, {});
  const rotulo = "block text-xs text-stone-500";
  return (
    <form action={acao} className="space-y-3">
      <p className="text-sm">
        <b>Saída:</b> {saida ?? <span className="text-amber-700">não definida (a rota começa na primeira entrega e não conta a volta)</span>}
      </p>
      <label className={rotulo}>
        Endereço de saída e volta (galpão da Santimelo) · deixe vazio pra manter
        <input name="endereco" placeholder="Rua e número" className="campo mt-1" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={rotulo}>
          Bairro
          <input name="bairro" className="campo mt-1" />
        </label>
        <label className={rotulo}>
          Cidade
          <input name="cidade" defaultValue="Porto Alegre" className="campo mt-1" />
        </label>
        <label className={rotulo}>
          Consumo da Fiorino (km/l)
          <input name="consumo" inputMode="decimal" defaultValue={String(consumo).replace(".", ",")} className="campo mt-1" />
        </label>
        <label className={rotulo}>
          Preço do litro (R$)
          <input name="preco" inputMode="decimal" defaultValue={preco.toFixed(2).replace(".", ",")} className="campo mt-1" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={salvando} className="botao-secundario">{salvando ? "Salvando…" : "Salvar"}</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Salvo.</p>}
      </div>
    </form>
  );
}
