"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CONFIG, gravarConfig } from "@/lib/config";
import { TIPOS_GASTO_VEICULO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const num = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : Number(t.replace(",", "."));
};

const esquemaVeiculo = z.object({
  modelo: z.string().min(2, "Informe o modelo").max(80),
  ano: z.number("Ano inválido").int().min(1990).max(2100),
  placa: z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Placa inválida (ex: QXX1J55)"),
  consumoKmL: z.number("Informe o consumo").positive("Consumo inválido").max(40),
  precoLitro: z.number("Informe o preço do litro").positive("Preço do litro inválido").max(30),
  kmAtual: z.number().int().min(0).max(2_000_000).nullable(),
  ipvaAnual: z.number().min(0).max(100000),
  seguroAnual: z.number().min(0).max(100000),
  licenciamentoAnual: z.number().min(0).max(10000),
  outrosFixosAnual: z.number().min(0).max(100000),
  manutencaoPorKm: z.number().min(0).max(10),
  pneusPorKm: z.number().min(0).max(10),
});

export async function salvarVeiculo(id: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = esquemaVeiculo.safeParse({
    modelo: texto(form.get("modelo")) ?? "",
    ano: num(form.get("ano")),
    placa: (texto(form.get("placa")) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    consumoKmL: num(form.get("consumoKmL")),
    precoLitro: num(form.get("precoLitro")),
    kmAtual: num(form.get("kmAtual")),
    ipvaAnual: num(form.get("ipvaAnual")) ?? 0,
    seguroAnual: num(form.get("seguroAnual")) ?? 0,
    licenciamentoAnual: num(form.get("licenciamentoAnual")) ?? 0,
    outrosFixosAnual: num(form.get("outrosFixosAnual")) ?? 0,
    manutencaoPorKm: num(form.get("manutencaoPorKm")) ?? 0,
    pneusPorKm: num(form.get("pneusPorKm")) ?? 0,
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.veiculo.update({ where: { id }, data: r.data });
  // as Rotas usam o mesmo consumo e preço do litro
  await gravarConfig(CONFIG.ROTA_CONSUMO, String(r.data.consumoKmL));
  await gravarConfig(CONFIG.ROTA_PRECO, String(r.data.precoLitro));
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

const esquemaGasto = z.object({
  veiculoId: z.string().min(1),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  tipo: z.enum(Object.keys(TIPOS_GASTO_VEICULO) as [string, ...string[]], "Escolha o tipo"),
  valor: z.number("Informe o valor").positive("Informe o valor").max(1_000_000),
  litros: z.number().positive("Litros inválidos").max(200).nullable(),
  km: z.number().int().min(0).max(2_000_000).nullable(),
  descricao: z.string().max(160).nullable(),
});

export async function lancarGasto(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaGasto.safeParse({
    veiculoId: texto(form.get("veiculoId")) ?? "",
    dia: texto(form.get("dia")) ?? "",
    tipo: texto(form.get("tipo")),
    valor: num(form.get("valor")),
    litros: num(form.get("litros")),
    km: num(form.get("km")),
    descricao: texto(form.get("descricao")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const v = await db.veiculo.findUnique({ where: { id: r.data.veiculoId } });
  if (!v) return { erro: "Veículo não encontrado" };
  await db.gastoVeiculo.create({ data: { ...r.data, autor: usuario.nome } });
  // hodômetro mais novo e preço real do litro (abastecimento com litros) atualizam o veículo e as Rotas
  const atualiza: { kmAtual?: number; precoLitro?: number } = {};
  if (r.data.km && r.data.km > (v.kmAtual ?? 0)) atualiza.kmAtual = r.data.km;
  if (r.data.tipo === "ABASTECIMENTO" && r.data.litros) atualiza.precoLitro = Math.round((r.data.valor / r.data.litros) * 100) / 100;
  if (Object.keys(atualiza).length) await db.veiculo.update({ where: { id: v.id }, data: atualiza });
  if (atualiza.precoLitro) await gravarConfig(CONFIG.ROTA_PRECO, String(atualiza.precoLitro));
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

export async function excluirGasto(id: string) {
  await exigirPapel("DIRETOR");
  await db.gastoVeiculo.delete({ where: { id } }).catch(() => null);
  revalidatePath("/painel", "layout");
}
