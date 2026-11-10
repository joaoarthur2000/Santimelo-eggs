"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number };

/** Dá o primeiro preço a um produto desligado (ex: camarão) e o liga no app */
export async function liberarProduto(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = z
    .object({ produtoId: z.string().min(1), preco: z.number("Informe o preço").positive("Informe o preço").max(100000) })
    .safeParse({ produtoId: String(form.get("produtoId") ?? ""), preco: Number(String(form.get("preco") ?? "").trim().replace(",", ".")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  const produto = await db.produto.findUnique({ where: { id: r.data.produtoId } });
  if (!produto) return { erro: "Produto não encontrado" };
  await db.$transaction([
    db.produto.update({ where: { id: produto.id }, data: { preco: r.data.preco, ativo: true } }),
    db.historicoPreco.create({ data: { produtoId: produto.id, preco: r.data.preco, origem: "PAINEL", autor: usuario.nome } }),
  ]);
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  return { ok: Date.now() };
}
