"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import type { GraficoBarras as TipoBarras } from "./grafico-barras";
import type { GraficoLinhas as TipoLinhas } from "./grafico-linhas";
import type { GraficoVendas as TipoVendas } from "./grafico-vendas";

// Os gráficos (Recharts, a parte mais pesada do painel) entram depois que a tela já abriu e responde ao toque:
// um por vez e nunca com o dedo rolando a página, pra rolagem não engasgar.
const Barras = dynamic(() => import("./grafico-barras").then((m) => m.GraficoBarras), { ssr: false });
const Linhas = dynamic(() => import("./grafico-linhas").then((m) => m.GraficoLinhas), { ssr: false });
const Vendas = dynamic(() => import("./grafico-vendas").then((m) => m.GraficoVendas), { ssr: false });

const PARADO_MS = 250;
let rolouEm = 0;
let tocando = false;
let rodando = false;
const fila: (() => void)[] = [];
if (typeof window !== "undefined") {
  addEventListener("scroll", () => (rolouEm = performance.now()), { passive: true });
  addEventListener("touchstart", () => (tocando = true), { passive: true });
  for (const e of ["touchend", "touchcancel"]) addEventListener(e, () => (tocando = false), { passive: true });
}
function proximo() {
  if (!fila.length) {
    rodando = false;
    return;
  }
  rodando = true;
  if (!tocando && performance.now() - rolouEm > PARADO_MS) fila.shift()!();
  setTimeout(proximo, 150);
}

function Depois({ altura, children }: { altura: number; children: React.ReactNode }) {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    const entrar = () => setPode(true);
    fila.push(entrar);
    if (!rodando) {
      rodando = true;
      setTimeout(proximo, 400);
    }
    // imprimir ou salvar em PDF: o gráfico precisa estar lá
    addEventListener("beforeprint", entrar);
    return () => {
      const i = fila.indexOf(entrar);
      if (i >= 0) fila.splice(i, 1);
      removeEventListener("beforeprint", entrar);
    };
  }, []);
  return <div style={{ minHeight: altura }}>{pode ? children : <div className="esqueleto" style={{ height: altura }} />}</div>;
}

export function GraficoBarras(p: ComponentProps<typeof TipoBarras>) {
  return (
    <Depois altura={(p.altura ?? 260) + (p.series.length > 1 ? 28 : 0)}>
      <Barras {...p} />
    </Depois>
  );
}

export function GraficoLinhas(p: ComponentProps<typeof TipoLinhas>) {
  return (
    <Depois altura={(p.altura ?? 240) + 28}>
      <Linhas {...p} />
    </Depois>
  );
}

export function GraficoVendas(p: ComponentProps<typeof TipoVendas>) {
  return (
    <Depois altura={(p.altura ?? 280) + 28}>
      <Vendas {...p} />
    </Depois>
  );
}
