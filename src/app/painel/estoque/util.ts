import { UNIDADES } from "@/lib/constantes";
import { num } from "@/lib/formato";

/** Caixa = 12 bandejas de 30 = 360 ovos */
export const OVOS_POR_CAIXA = 360;
export const abrev = (unidade: string) => UNIDADES[unidade] ?? unidade;
export const redondo = (v: number) => Math.round(v * 100) / 100;
export const qtd = (v: number, unidade: string) => `${num(redondo(v))} ${abrev(unidade)}`;
