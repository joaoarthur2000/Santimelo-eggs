"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { errosDoForm } from "@/lib/erros";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number; campos?: Record<string, string> };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
// "140,50" e "140.50" valem 140,5 (igual ao estoque)
const numero = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? undefined : Number(String(v).trim().replace(",", ".")));

const esquema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  descricao: z.string().min(2, "Descreva a despesa").max(120),
  categoria: z.enum(CATEGORIAS_DESPESA, "Escolha a categoria"),
  valor: z.number("Informe o valor").positive("Informe o valor").max(1_000_000),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
});

export async function lancarDespesa(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquema.safeParse({
    dia: texto(form.get("dia")) ?? "",
    descricao: texto(form.get("descricao")) ?? "",
    categoria: texto(form.get("categoria")),
    valor: numero(form.get("valor")),
    formaPagamento: texto(form.get("formaPagamento")),
  });
  if (!r.success) return errosDoForm(r.error);
  await db.despesa.create({ data: { ...r.data, autor: usuario.nome } });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

export async function excluirDespesa(id: string) {
  await exigirPapel("DIRETOR");
  await db.despesa.delete({ where: { id } }).catch(() => null);
  revalidatePath("/painel", "layout");
}
