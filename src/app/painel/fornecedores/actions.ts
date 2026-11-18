"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { diaISO, inicioDoDia } from "@/lib/datas";
import { FORMAS_PAGAMENTO_FORNECEDOR } from "@/lib/constantes";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/sessao";

export type Estado = { erro?: string; ok?: number };
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

// "185", "185,50", "1.250,00" → número
const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return undefined;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

const esquemaCompra = z.object({
  fornecedorId: z.string().min(1, "Escolha o fornecedor"),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  itemId: z.string().min(1, "Escolha o tipo de ovo"),
  marca: z.string().max(60).nullable(),
  quantidade: z.number("Informe quantas caixas").positive("Informe quantas caixas").max(100000),
  custoUnit: z.number("Informe o valor da caixa").positive("Informe o valor da caixa").max(100000),
});

/** Compra de mercadoria lançada pela tela de Fornecedores: entra no estoque e no custo médio como qualquer compra. */
export async function lancarCompra(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaCompra.safeParse({
    fornecedorId: texto(form.get("fornecedorId")) ?? "",
    dia: texto(form.get("dia")) ?? "",
    itemId: texto(form.get("itemId")) ?? "",
    marca: texto(form.get("marca")),
    quantidade: numero(form.get("quantidade")),
    custoUnit: numero(form.get("custoUnit")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const { dia, ...dados } = r.data;
  if (dia > diaISO()) return { erro: "A data não pode ser no futuro" };
  const fornecedor = await db.fornecedor.findUnique({ where: { id: dados.fornecedorId } });
  if (!fornecedor) return { erro: "Fornecedor não encontrado" };
  await db.movimentoEstoque.create({
    data: {
      ...dados,
      data: new Date(inicioDoDia(dia).getTime() + 12 * 60 * 60 * 1000), // meio-dia: não escorrega de dia por fuso
      fornecedor: fornecedor.nome, // nome também, como no Estoque
      origem: "FORNECEDOR",
      tipo: "COMPRA",
      autor: usuario.nome,
    },
  });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

const esquemaPagamento = z.object({
  valor: z.number("Informe o valor").positive("Informe o valor").max(10000000),
  forma: z.enum(FORMAS_PAGAMENTO_FORNECEDOR, "Escolha se foi Pix ou dinheiro"),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  observacao: z.string().max(120).nullable(),
});

/** Pagamento feito ao fornecedor: abate do "A pagar" dele */
export async function registrarPagamento(fornecedorId: string, _e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquemaPagamento.safeParse({ valor: numero(form.get("valor")), forma: texto(form.get("forma")) ?? "", dia: texto(form.get("dia")) ?? "", observacao: texto(form.get("observacao")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  if (r.data.dia > diaISO()) return { erro: "A data não pode ser no futuro" };
  if (!(await db.fornecedor.findUnique({ where: { id: fornecedorId } }))) return { erro: "Fornecedor não encontrado" };
  await db.pagamentoFornecedor.create({ data: { ...r.data, fornecedorId, autor: usuario.nome } });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

export async function excluirPagamento(id: string) {
  await exigirPapel("DIRETOR");
  await db.pagamentoFornecedor.deleteMany({ where: { id } });
  revalidatePath("/painel", "layout");
}
