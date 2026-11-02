"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COR_CUSTO, COR_LUCRO } from "@/lib/cores";

export type LinhaVendas = { rotulo: string; faturamento: number; custo: number; lucro: number; semCusto?: number };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

/** Dica ao passar o mouse/dedo: faturamento, custo, lucro e margem daquela barra */
function Dica({ active, payload }: { active?: boolean; payload?: { payload: LinhaVendas }[] }) {
  if (!active || !payload?.length) return null;
  const l = payload[0].payload;
  const base = l.faturamento - (l.semCusto ?? 0);
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-stone-900">{l.rotulo}</p>
      <p className="flex justify-between gap-6"><span className="text-stone-500">Faturamento</span><b className="tabular">{reais(l.faturamento)}</b></p>
      <p className="flex justify-between gap-6"><span className="flex items-center gap-1.5 text-stone-500"><i className="size-2 rounded-sm" style={{ background: COR_CUSTO }} />Custo</span><span className="tabular">{reais(l.custo)}</span></p>
      <p className="flex justify-between gap-6"><span className="flex items-center gap-1.5 text-stone-500"><i className="size-2 rounded-sm" style={{ background: COR_LUCRO }} />{l.lucro < 0 ? "Prejuízo" : "Lucro"}</span><b className="tabular">{reais(l.lucro)}</b></p>
      {base > 0 && <p className="mt-1 text-stone-500">Margem {pct(l.lucro / base)}</p>}
      {!!l.semCusto && <p className="text-amber-700">{reais(l.semCusto)} sem custo lançado</p>}
    </div>
  );
}

/**
 * Barra = faturamento, dividida em custo (laranja) + lucro (azul). Lucro negativo desce abaixo do zero.
 * `destaque`: índice da barra do período escolhido (as outras ficam mais claras, só de contexto).
 */
export function GraficoVendas({ dados, horizontal = false, destaque, altura = 280 }: { dados: LinhaVendas[]; horizontal?: boolean; destaque?: number; altura?: number }) {
  const eixoTexto = { fontSize: 12, fill: "#57534e" };
  const opacidade = (i: number) => (destaque === undefined || destaque === i ? 1 : 0.35);
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600">
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: COR_CUSTO }} />Custo dos ovos</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: COR_LUCRO }} />Lucro</li>
        <li className="text-stone-500">barra inteira = faturamento</li>
      </ul>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} layout={horizontal ? "vertical" : "horizontal"} stackOffset="sign" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="#ece7e1" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={reais} tick={eixoTexto} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="rotulo" width={170} tick={eixoTexto} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="rotulo" tick={eixoTexto} axisLine={false} tickLine={false} minTickGap={8} />
              <YAxis tickFormatter={reais} tick={eixoTexto} axisLine={false} tickLine={false} width={76} />
            </>
          )}
          <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke="#a8a29e" />
          <Tooltip content={<Dica />} cursor={{ fill: "rgba(61,38,20,0.06)" }} />
          <Bar dataKey="custo" stackId="v" fill={COR_CUSTO} stroke="#ffffff" strokeWidth={2} maxBarSize={40} isAnimationActive={false}>
            {dados.map((_, i) => <Cell key={i} fillOpacity={opacidade(i)} />)}
          </Bar>
          <Bar dataKey="lucro" stackId="v" fill={COR_LUCRO} stroke="#ffffff" strokeWidth={2} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {dados.map((_, i) => <Cell key={i} fillOpacity={opacidade(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
