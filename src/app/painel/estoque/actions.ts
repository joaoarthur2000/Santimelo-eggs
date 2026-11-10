"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { saldos } from "@/lib/estoque";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number };
const numero = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? undefined : Number(String(v).replace(",", ".")));
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function atualizar() {
  revalidatePath("/painel", "layout");
}

const esquemaCompra = z.object({
  itemId: z.string().min(1, "Escolha o item"),
  quantidade: z.number("Informe a quantidade").positive("Informe a quantidade").max(100000),
  custoUnit: z.number("Informe o custo").nonnegative("Custo inválido").max(100000),
  fornecedorId: z.string().min(1, "Escolha o fornecedor"),
  observacao: z.string().max(300).nullable(),
});

export async function registrarCompra(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  // Aceita custo por unidade ou o total da nota
  const quantidade = numero(form.get("quantidade"));
  const total = numero(form.get("custoTotal"));
  const unit = numero(form.get("custoUnit")) ?? (total !== undefined && quantidade ? total / quantidade : undefined);
  const r = esquemaCompra.safeParse({
    itemId: texto(form.get("itemId")) ?? "",
    quantidade,
    custoUnit: unit,
    fornecedorId: texto(form.get("fornecedorId")) ?? "",
    observacao: texto(form.get("observacao")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const fornecedor = await db.fornecedor.findUnique({ where: { id: r.data.fornecedorId } });
  if (!fornecedor) return { erro: "Fornecedor não encontrado" };
  // guarda também o nome: lançamentos antigos e telas que mostram texto continuam funcionando
  await db.movimentoEstoque.create({ data: { ...r.data, fornecedor: fornecedor.nome, origem: "FORNECEDOR", tipo: "COMPRA", autor: usuario.nome } });
  atualizar();
  return { ok: Date.now() };
}

const esquemaPerda = z.object({
  itemId: z.string().min(1, "Escolha o item"),
  quantidade: z.number("Informe a quantidade").positive("Informe a quantidade").max(100000),
  observacao: z.string().min(2, "Diga o motivo (estragou, amassou, vencido...)").max(300),
});

export async function registrarPerda(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaPerda.safeParse({ itemId: texto(form.get("itemId")) ?? "", quantidade: numero(form.get("quantidade")), observacao: texto(form.get("observacao")) ?? "" });
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.movimentoEstoque.create({ data: { ...r.data, quantidade: -r.data.quantidade, tipo: "PERDA", autor: usuario.nome } });
  atualizar();
  return { ok: Date.now() };
}

/** Contagem física: o sistema lança a diferença entre o contado e o saldo como ajuste */
export async function registrarContagem(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = z
    .object({ itemId: z.string().min(1, "Escolha o item"), contado: z.number("Informe quanto tem").min(0, "Quantidade inválida").max(100000) })
    .safeParse({ itemId: texto(form.get("itemId")) ?? "", contado: numero(form.get("contado")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  const saldo = (await saldos(new Date())).get(r.data.itemId) ?? 0;
  const diferenca = Math.round((r.data.contado - saldo) * 1000) / 1000;
  if (diferenca === 0) return { ok: Date.now() };
  await db.movimentoEstoque.create({
    data: {
      itemId: r.data.itemId,
      tipo: "AJUSTE",
      quantidade: diferenca,
      autor: usuario.nome,
      observacao: `Contagem: ${String(r.data.contado).replace(".", ",")} (sistema dizia ${String(Math.round(saldo * 100) / 100).replace(".", ",")})`,
    },
  });
  atualizar();
  return { ok: Date.now() };
}

/** Só apaga lançamento manual (compra, perda, ajuste); a venda se desfaz pelo pedido */
export async function excluirMovimento(id: string) {
  await exigirPapel("DIRETOR");
  const m = await db.movimentoEstoque.findUnique({ where: { id } });
  if (!m || !["COMPRA", "PERDA", "AJUSTE"].includes(m.tipo)) return;
  await db.movimentoEstoque.delete({ where: { id } });
  atualizar();
}
