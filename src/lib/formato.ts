import { UNIDADES } from "./constantes";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const reais = (valor: number) => moeda.format(valor);
export const num = (valor: number) => numero.format(valor);
export const pct = (valor: number) => `${numero.format(valor * 100)}%`;

export function quantidade(valor: number, unidade: string) {
  return `${numero.format(valor)} ${UNIDADES[unidade] ?? unidade}`;
}

/** Nome legível de um produto: "Ovo branco · Caixa (12 bandejas de 30)" */
export function nomeProduto(p: { embalagem: string; item: { nome: string } }) {
  return `${p.item.nome} · ${p.embalagem}`;
}
