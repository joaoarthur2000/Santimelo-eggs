"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PAGAMENTOS_RAPIDO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { buscarNegocio, type DadosNegocio } from "@/lib/google-negocio";
import { exigirPapel } from "@/lib/sessao";

export type EstadoCadastro = { erro?: string; ok?: number; id?: string; nome?: string };

const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
// "185", "185,50" e "185.50" valem; vazio = não informado
const valor = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : Number(t.replace(/[^\d,.-]/g, "").replace(",", "."));
};

// Cadastro rápido (pedido do dono em 2026-11-17): só o essencial pra lançar a carteira de uma vez.
// Tipo de comércio, região, valores da caixa e saldo em aberto ficam pra ficha do cliente.
const TIPO_A_DEFINIR = "A definir";

const esquema = z.object({
  nomeFantasia: z.string().min(2, "Informe o nome do cliente").max(80),
  pagamento: z.enum(PAGAMENTOS_RAPIDO, "Escolha a forma de pagamento"),
  endereco: z.string().max(200).nullable(),
  whatsapp: z.string().regex(/^[\d\s()+-]{8,20}$/, "Telefone inválido").nullable(),
});

export async function cadastrarClienteRapido(_e: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  await exigirPapel("DIRETOR");
  const r = esquema.safeParse({
    nomeFantasia: texto(form.get("nomeFantasia")) ?? "",
    pagamento: texto(form.get("pagamento")),
    endereco: texto(form.get("endereco")),
    whatsapp: texto(form.get("whatsapp")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const { nomeFantasia, pagamento, endereco, whatsapp } = r.data;

  if (await db.cliente.findFirst({ where: { nomeFantasia } })) return { erro: `Já existe um cliente chamado ${nomeFantasia}` };

  const nf = pagamento === "NF";
  const cliente = await db.cliente.create({
    data: {
      nomeFantasia,
      razaoSocial: nomeFantasia,
      tipoNegocio: TIPO_A_DEFINIR, // a ficha pede o tipo certo na primeira edição
      endereco,
      whatsapp,
      formaPagamento: nf ? null : pagamento,
      notaFiscal: nf,
    },
  });
  revalidatePath("/painel", "layout");
  return { ok: Date.now(), id: cliente.id, nome: cliente.nomeFantasia };
}

/** Caixa do ovo branco: o valor de venda do cliente vira o preço combinado dela */
async function produtoCaixaBranco() {
  return db.produto.findFirst({ where: { unidade: "caixa", ativo: true, item: { nome: "Ovo branco" } } });
}

export type ResultadoBusca = { erro?: string; dados?: DadosNegocio; existente?: { id: string; nome: string } | null };

/** Link do Google Maps / Meu Negócio → dados pra preencher o cadastro (não salva nada) */
export async function buscarNoGoogle(texto: string): Promise<ResultadoBusca> {
  await exigirPapel("DIRETOR");
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000) return { erro: "Cole o link do Google Maps." };
  const r = await buscarNegocio(texto);
  if ("erro" in r) return { erro: r.erro };
  const existente = r.dados.nome
    ? await db.cliente.findFirst({ where: { nomeFantasia: r.dados.nome }, select: { id: true, nomeFantasia: true } })
    : null;
  return { dados: r.dados, existente: existente ? { id: existente.id, nome: existente.nomeFantasia } : null };
}

/** Na ficha do cliente: ajusta o valor de venda e de custo da caixa */
export async function salvarValoresCaixa(clienteId: string, _e: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  await exigirPapel("DIRETOR");
  const r = z
    .object({ valorVenda: z.number().positive("Valor de venda inválido").max(100000).nullable(), valorCusto: z.number().positive("Valor de custo inválido").max(100000).nullable() })
    .safeParse({ valorVenda: valor(form.get("valorVenda")), valorCusto: valor(form.get("valorCusto")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  const caixa = await produtoCaixaBranco();
  await db.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id: clienteId }, data: r.data });
    if (caixa) {
      if (r.data.valorVenda) await tx.precoCliente.upsert({ where: { clienteId_produtoId: { clienteId, produtoId: caixa.id } }, update: { preco: r.data.valorVenda }, create: { clienteId, produtoId: caixa.id, preco: r.data.valorVenda } });
      else await tx.precoCliente.deleteMany({ where: { clienteId, produtoId: caixa.id } });
    }
  });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}

/** Lança um valor em aberto avulso (ex: venda antiga, sem pedido no sistema) */
export async function lancarEmAberto(clienteId: string, _e: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  const usuario = await exigirPapel("DIRETOR");
  const r = z
    .object({ valor: z.number("Informe o valor").positive("Informe o valor").max(1000000), vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento"), descricao: z.string().max(120).nullable() })
    .safeParse({ valor: valor(form.get("valor")), vencimento: texto(form.get("vencimento")) ?? "", descricao: texto(form.get("descricao")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.cobranca.create({ data: { clienteId, valor: r.data.valor, vencimento: r.data.vencimento, descricao: r.data.descricao ?? `Lançado por ${usuario.nome}` } });
  revalidatePath("/painel", "layout");
  return { ok: Date.now() };
}
