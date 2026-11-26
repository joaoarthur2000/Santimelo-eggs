"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { diaISO, inicioDoDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { errosDoForm } from "@/lib/erros";
import { saldos } from "@/lib/estoque";
import { exigirPapel } from "@/lib/sessao";

type Estado = { erro?: string; ok?: number; campos?: Record<string, string> };
// "130", "130,50", "1.250,00" → número
const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return undefined;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// Data escolhida no formulário (compra/perda antiga), gravada ao meio-dia pra não escorregar de dia por fuso
function dataDoDia(v: FormDataEntryValue | null): Date | { erro: string } {
  const dia = String(v ?? "").trim();
  if (!dia) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(inicioDoDia(dia).getTime())) return { erro: "Data inválida" };
  if (dia > diaISO()) return { erro: "A data não pode ser no futuro" };
  if (dia < "2020-01-01") return { erro: "Data muito antiga" };
  return dia === diaISO() ? new Date() : new Date(inicioDoDia(dia).getTime() + 12 * 3600 * 1000);
}

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
  if (!r.success) return errosDoForm(r.error);
  const data = dataDoDia(form.get("dia"));
  if ("erro" in data) return data;
  const fornecedor = await db.fornecedor.findUnique({ where: { id: r.data.fornecedorId } });
  if (!fornecedor) return { erro: "Fornecedor não encontrado" };
  // guarda também o nome: lançamentos antigos e telas que mostram texto continuam funcionando
  await db.movimentoEstoque.create({ data: { ...r.data, data, fornecedor: fornecedor.nome, origem: "FORNECEDOR", tipo: "COMPRA", autor: usuario.nome } });
  atualizar();
  return { ok: Date.now() };
}

const esquemaPerda = z.object({
  itemId: z.string().min(1, "Escolha o item"),
  quantidade: z.number("Informe a quantidade").positive("Informe a quantidade").max(100000),
  observacao: z.string().min(2, "Diga o motivo (estragou, amassou, vencido...)").max(300),
  fornecedorId: z.string().nullable(),
});

export async function registrarPerda(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaPerda.safeParse({
    itemId: texto(form.get("itemId")) ?? "",
    quantidade: numero(form.get("quantidade")),
    observacao: texto(form.get("observacao")) ?? "",
    fornecedorId: texto(form.get("fornecedorId")),
  });
  if (!r.success) return errosDoForm(r.error);
  const data = dataDoDia(form.get("dia"));
  if ("erro" in data) return data;
  // saiu de um fornecedor? baixa também o estoque dele
  const fornecedor = r.data.fornecedorId ? await db.fornecedor.findUnique({ where: { id: r.data.fornecedorId } }) : null;
  if (r.data.fornecedorId && !fornecedor) return { erro: "Fornecedor não encontrado" };
  await db.movimentoEstoque.create({
    data: { ...r.data, data, quantidade: -r.data.quantidade, tipo: "PERDA", fornecedor: fornecedor?.nome ?? null, autor: usuario.nome },
  });
  atualizar();
  return { ok: Date.now() };
}

/** Contagem física: o sistema lança a diferença entre o contado e o saldo como ajuste */
export async function registrarContagem(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = z
    .object({ itemId: z.string().min(1, "Escolha o item"), contado: z.number("Informe quanto tem").min(0, "Quantidade inválida").max(100000) })
    .safeParse({ itemId: texto(form.get("itemId")) ?? "", contado: numero(form.get("contado")) });
  if (!r.success) return errosDoForm(r.error);
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

/**
 * Zera o estoque (de um tipo de ovo ou de todos) com ajustes no extrato, sem apagar histórico.
 * Zera também o que está em nome de cada fornecedor, pra o estoque por fornecedor bater.
 * Desfaz: excluir os ajustes "Estoque zerado" no extrato.
 */
async function zerar(itemId: string | null, autor: string) {
  const onde = itemId ? { itemId } : {};
  const [porFornecedor, porItem] = await Promise.all([
    db.movimentoEstoque.groupBy({ by: ["itemId", "fornecedorId"], where: { ...onde, fornecedorId: { not: null } }, _sum: { quantidade: true } }),
    db.movimentoEstoque.groupBy({ by: ["itemId"], where: onde, _sum: { quantidade: true } }),
  ]);
  const nomes = new Map((await db.fornecedor.findMany({ select: { id: true, nome: true } })).map((f) => [f.id, f.nome]));
  const redondo = (v: number) => Math.round(v * 1000) / 1000;
  const ajustes: { itemId: string; quantidade: number; fornecedorId: string | null; fornecedor: string | null; observacao: string }[] = [];
  const restante = new Map(porItem.map((g) => [g.itemId, g._sum.quantidade ?? 0]));
  for (const g of porFornecedor) {
    const saldo = redondo(g._sum.quantidade ?? 0);
    if (saldo === 0) continue;
    ajustes.push({ itemId: g.itemId, quantidade: -saldo, fornecedorId: g.fornecedorId, fornecedor: nomes.get(g.fornecedorId!) ?? null, observacao: `Estoque zerado (era ${num(saldo)})` });
    restante.set(g.itemId, (restante.get(g.itemId) ?? 0) - saldo);
  }
  for (const [id, saldo] of restante) {
    const s = redondo(saldo);
    if (s !== 0) ajustes.push({ itemId: id, quantidade: -s, fornecedorId: null, fornecedor: null, observacao: `Estoque zerado (era ${num(s)})` });
  }
  if (ajustes.length) await db.movimentoEstoque.createMany({ data: ajustes.map((a) => ({ ...a, tipo: "AJUSTE", autor })) });
  return ajustes.length;
}
const num = (v: number) => String(v).replace(".", ",");

export async function zerarItem(itemId: string) {
  const usuario = await exigirPapel("DIRETOR");
  await zerar(itemId, usuario.nome);
  atualizar();
}

export async function zerarEstoque() {
  const usuario = await exigirPapel("DIRETOR");
  await zerar(null, usuario.nome);
  atualizar();
}
