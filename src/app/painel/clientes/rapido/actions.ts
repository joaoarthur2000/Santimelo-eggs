"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAS_PAGAMENTO, PRAZOS_PAGAMENTO, TIPOS_NEGOCIO } from "@/lib/constantes";
import { diaISO } from "@/lib/datas";
import { db } from "@/lib/db";
import { buscarNegocio, linkPermitido, type DadosNegocio } from "@/lib/google-negocio";
import { exigirPapel } from "@/lib/sessao";

export type EstadoCadastro = { erro?: string; ok?: number; id?: string; nome?: string };

const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
// "185", "185,50" e "185.50" valem; vazio = não informado
const valor = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : Number(t.replace(/[^\d,.-]/g, "").replace(",", "."));
};

const esquema = z.object({
  nomeFantasia: z.string().min(2, "Informe o nome do cliente").max(80),
  tipoNegocio: z.enum(TIPOS_NEGOCIO, "Escolha o tipo de comércio"),
  whatsapp: z.string().regex(/^[\d\s()+-]{8,20}$/, "Telefone inválido"),
  responsavel: z.string().max(80).nullable(),
  endereco: z.string().min(3, "Informe o endereço").max(200),
  bairro: z.string().max(80).nullable(),
  cidade: z.string().min(2, "Informe a cidade").max(60),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido (ex: 90035-100)").nullable(),
  lat: z.number().min(-34).max(6).nullable(),
  lng: z.number().min(-75).max(-28).nullable(),
  linkMaps: z.string().max(500).refine(linkPermitido, "Link do Google inválido").nullable(),
  regiaoId: z.string().nullable(),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, "Escolha a forma de pagamento"),
  prazoPagamentoDias: z.number().int().refine((n) => (PRAZOS_PAGAMENTO as readonly number[]).includes(n), "Prazo inválido"),
  notaFiscal: z.boolean(),
  valorVenda: z.number("Valor de venda inválido").positive("Valor de venda inválido").max(100000).nullable(),
  valorCusto: z.number("Valor de custo inválido").positive("Valor de custo inválido").max(100000).nullable(),
  saldoAberto: z.number("Valor em aberto inválido").min(0, "Valor em aberto inválido").max(1000000).nullable(),
  vencimentoSaldo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  observacoes: z.string().max(1000).nullable(),
});

/** Caixa do ovo branco: o valor de venda do cliente vira o preço combinado dela */
async function produtoCaixaBranco() {
  return db.produto.findFirst({ where: { unidade: "caixa", ativo: true, item: { nome: "Ovo branco" } } });
}

export async function cadastrarClienteRapido(_e: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  const usuario = await exigirPapel("DIRETOR");
  const r = esquema.safeParse({
    nomeFantasia: texto(form.get("nomeFantasia")) ?? "",
    tipoNegocio: texto(form.get("tipoNegocio")),
    whatsapp: texto(form.get("whatsapp")) ?? "",
    responsavel: texto(form.get("responsavel")),
    endereco: texto(form.get("endereco")) ?? "",
    bairro: texto(form.get("bairro")),
    cidade: texto(form.get("cidade")) ?? "Porto Alegre",
    cep: texto(form.get("cep")),
    lat: valor(form.get("lat")),
    lng: valor(form.get("lng")),
    linkMaps: texto(form.get("linkMaps")),
    regiaoId: texto(form.get("regiaoId")),
    formaPagamento: texto(form.get("formaPagamento")),
    prazoPagamentoDias: Number(form.get("prazoPagamentoDias") ?? 0),
    notaFiscal: form.get("notaFiscal") === "1",
    valorVenda: valor(form.get("valorVenda")),
    valorCusto: valor(form.get("valorCusto")),
    saldoAberto: valor(form.get("saldoAberto")),
    vencimentoSaldo: texto(form.get("vencimentoSaldo")),
    observacoes: texto(form.get("observacoes")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const { saldoAberto, vencimentoSaldo, ...dados } = r.data;
  if (dados.lat === null || dados.lng === null) [dados.lat, dados.lng] = [null, null];

  if (await db.cliente.findFirst({ where: { nomeFantasia: dados.nomeFantasia } })) return { erro: `Já existe um cliente chamado ${dados.nomeFantasia}` };

  const caixa = dados.valorVenda ? await produtoCaixaBranco() : null;
  const cliente = await db.$transaction(async (tx) => {
    const c = await tx.cliente.create({ data: { ...dados, razaoSocial: dados.nomeFantasia, prazoPagamentoDias: dados.prazoPagamentoDias || null } });
    if (caixa && dados.valorVenda) await tx.precoCliente.create({ data: { clienteId: c.id, produtoId: caixa.id, preco: dados.valorVenda } });
    if (saldoAberto) {
      await tx.cobranca.create({ data: { clienteId: c.id, valor: saldoAberto, vencimento: vencimentoSaldo ?? diaISO(), descricao: `Saldo em aberto lançado no cadastro por ${usuario.nome}` } });
    }
    return c;
  });
  revalidatePath("/painel", "layout");
  return { ok: Date.now(), id: cliente.id, nome: cliente.nomeFantasia };
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
