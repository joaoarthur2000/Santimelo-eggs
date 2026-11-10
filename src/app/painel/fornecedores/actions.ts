"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome").max(60),
  contato: z.string().max(60).nullable(),
  produtos: z.string().max(120).nullable(),
});

export async function cadastrarFornecedor(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = esquema.safeParse({ nome: texto(form.get("nome")) ?? "", contato: texto(form.get("contato")), produtos: texto(form.get("produtos")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  if (await db.fornecedor.findUnique({ where: { nome: r.data.nome } })) return { erro: "Já existe um fornecedor com esse nome" };
  const ordem = (await db.fornecedor.count()) + 1;
  await db.fornecedor.create({ data: { ...r.data, ordem } });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

/** Desativar some da lista de compra, mas mantém o histórico */
export async function alternarFornecedor(id: string) {
  await exigirPapel("DIRETOR");
  const f = await db.fornecedor.findUnique({ where: { id } });
  if (!f) return;
  await db.fornecedor.update({ where: { id }, data: { ativo: !f.ativo } });
  revalidatePath("/painel", "layout");
}
