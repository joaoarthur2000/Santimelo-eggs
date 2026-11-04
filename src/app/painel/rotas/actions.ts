"use server";

import { revalidatePath } from "next/cache";
import { CONFIG, gravarConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { gerarRotaDoDia, gravarSaida, localizar } from "@/lib/rota";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number; aviso?: string };
const numero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

export async function gerarRota(dia: string): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = await gerarRotaDoDia(dia);
  revalidatePath("/painel/rotas");
  const aviso = r.naoAchou?.length ? `Não achei no mapa: ${r.naoAchou.join(", ")}. Confira o endereço na ficha deles.` : undefined;
  if (r.erro) return { erro: r.erro, aviso };
  return { ok: Date.now(), aviso };
}

/** Km do hodômetro no fim do dia: a conta de combustível passa a usar o real */
export async function salvarKmReal(dia: string, form: FormData) {
  await exigirPapel("DIRETOR");
  const km = numero(form.get("km"));
  await db.rotaDia.update({ where: { dia }, data: { kmReal: km > 0 && km < 2000 ? km : null } });
  revalidatePath("/painel", "layout");
}

/** De onde o carro sai, consumo e preço do litro */
export async function salvarConfigRota(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const consumo = numero(form.get("consumo"));
  const preco = numero(form.get("preco"));
  if (!(consumo > 3 && consumo < 30)) return { erro: "Consumo inválido (km por litro, ex: 10)" };
  if (!(preco > 2 && preco < 20)) return { erro: "Preço do litro inválido (ex: 6,40)" };
  await gravarConfig(CONFIG.ROTA_CONSUMO, String(consumo));
  await gravarConfig(CONFIG.ROTA_PRECO, String(preco));
  const endereco = String(form.get("endereco") ?? "").trim();
  if (endereco) {
    const pos = await localizar(endereco, String(form.get("bairro") ?? "") || null, String(form.get("cidade") ?? "") || "Porto Alegre");
    if (!pos) return { erro: "Não achei esse endereço de saída no mapa. Confira rua e número." };
    await gravarSaida({ endereco: [endereco, form.get("bairro"), form.get("cidade")].filter(Boolean).join(" · "), ...pos });
  }
  revalidatePath("/painel/rotas");
  return { ok: Date.now() };
}
