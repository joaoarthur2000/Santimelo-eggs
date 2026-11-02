"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Serie } from "./grafico-barras";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Linhas em degrau (preço vale até mudar), com legenda e tooltip. Valores em R$ */
export function GraficoLinhas({ dados, categoria, series, altura = 240 }: { dados: Record<string, string | number | null>[]; categoria: string; series: Serie[]; altura?: number }) {
  const eixoTexto = { fontSize: 12, fill: "#57534e" };
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600">
        {series.map((s) => (
          <li key={s.chave} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.cor }} />
            {s.rotulo}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey={categoria} tick={eixoTexto} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={reais} tick={eixoTexto} axisLine={false} tickLine={false} width={72} domain={[0, "auto"]} />
          <Tooltip
            formatter={(valor, nome) => [reais(Number(valor)), series.find((s) => s.chave === nome)?.rotulo ?? nome]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
          />
          {series.map((s) => (
            <Line
              key={s.chave}
              dataKey={s.chave}
              name={s.chave}
              type="stepAfter"
              stroke={s.cor}
              strokeWidth={2}
              dot={{ r: 4, fill: s.cor, stroke: "#ffffff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
