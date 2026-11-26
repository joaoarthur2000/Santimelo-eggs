"use client";

import { useEstreito } from "./use-estreito";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Serie = { chave: string; rotulo: string; cor: string };

const FORMATOS = {
  kg: (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`,
  reais: (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
  pct: (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`,
  num: (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
};

type Props = {
  dados: Record<string, string | number>[];
  categoria: string; // campo do eixo de categorias
  series: Serie[];
  formato?: keyof typeof FORMATOS;
  horizontal?: boolean;
  empilhado?: boolean;
  altura?: number;
};

export function GraficoBarras({ dados, categoria, series, formato = "num", horizontal = false, empilhado = false, altura = 260 }: Props) {
  const fmt = FORMATOS[formato];
  const eixoTexto = { fontSize: 12, fill: "#57534e" };
  const estreito = useEstreito();

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600">
          {series.map((s) => (
            <li key={s.chave} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.cor }} />
              {s.rotulo}
            </li>
          ))}
        </ul>
      )}
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={estreito && !horizontal ? dados.slice(-14) : dados} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: estreito ? 4 : 12, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid stroke="#e7e5e4" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={fmt} tick={eixoTexto} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={categoria} width={estreito ? 104 : 150} tick={eixoTexto} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={categoria} tick={eixoTexto} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={eixoTexto} axisLine={false} tickLine={false} width={estreito ? 52 : 72} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "rgba(35,106,72,0.08)" }}
            formatter={(valor, nome) => [fmt(Number(valor)), series.find((s) => s.chave === nome)?.rotulo ?? nome]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
          />
          {series.map((s, i) => {
            const ultima = !empilhado || i === series.length - 1;
            const raio: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
            return (
              <Bar
                key={s.chave}
                dataKey={s.chave}
                name={s.chave}
                fill={s.cor}
                stackId={empilhado ? "pilha" : undefined}
                radius={ultima ? raio : 0}
                stroke="#ffffff"
                strokeWidth={empilhado ? 2 : 0}
                maxBarSize={36}
                isAnimationActive={false}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
