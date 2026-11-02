"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { diaISO } from "@/lib/datas";
import { db } from "@/lib/db";
import { CONFIG, gravarConfig } from "@/lib/config";
import { gerarHash } from "@/lib/senha";
import { exigirPapel } from "@/lib/sessao";
import { enviarProGrupo } from "@/lib/whatsapp";

type Estado = { erro?: string; ok?: number; senha?: string; codigo?: string };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const numero = (v: FormDataEntryValue | null) => (texto(v) === null ? null : Number(String(v).replace(",", ".")));

function atualizar() {
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
}

const SEM_CONFUSAO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const sortear = (letras: string, n: number) => Array.from({ length: n }, () => letras[randomInt(letras.length)]).join("");

/** Senha fácil de ditar por telefone (sem letras e números que se confundem) */
const senhaInicial = () => sortear(SEM_CONFUSAO.toLowerCase(), 8);

/** Código de acesso único do cliente no app: EGG-7K3P */
async function novoCodigo() {
  for (;;) {
    const codigo = `EGG-${sortear(SEM_CONFUSAO, 4)}`;
    if (!(await db.usuario.findUnique({ where: { codigoAcesso: codigo } }))) return codigo;
  }
}

const opcional = (max: number) => z.string().max(max).nullable();
const esquemaCondicoes = z.object({
  regiaoId: z.string().nullable(),
  prazoPagamentoDias: z.number("Prazo inválido").int("Prazo inválido").min(0, "Prazo inválido").max(120, "Prazo inválido").nullable(),
  formaPagamento: opcional(60),
  negociacao: opcional(1000),
});

// Dados que a Santimelo precisa do cliente
const esquemaDados = z.object({
  nomeFantasia: z.string("Informe o nome do estabelecimento").min(2, "Informe o nome do estabelecimento").max(80),
  razaoSocial: opcional(120),
  cnpj: z.string().regex(/^[\d./-]{11,18}$/, "CNPJ/CPF inválido").nullable(),
  tipoNegocio: opcional(40),
  responsavel: z.string("Informe o responsável").min(2, "Informe o responsável").max(80),
  whatsapp: z.string("Informe o WhatsApp").regex(/^[\d\s()+-]{10,20}$/, "WhatsApp inválido"),
  email: z.email("E-mail inválido").nullable(),
  endereco: z.string("Informe o endereço de entrega").min(5, "Informe o endereço de entrega").max(200),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").nullable(),
  consumoSemanal: z.number("Consumo inválido").min(0).max(1000).nullable(),
  limiteCredito: z.number("Limite inválido").min(0).max(1000000).nullable(),
  observacoes: opcional(1000),
});

const lerCondicoes = (form: FormData) =>
  esquemaCondicoes.safeParse({
    regiaoId: texto(form.get("regiaoId")),
    prazoPagamentoDias: numero(form.get("prazoPagamentoDias")),
    formaPagamento: texto(form.get("formaPagamento")),
    negociacao: texto(form.get("negociacao")),
  });

const lerDados = (form: FormData) =>
  esquemaDados.safeParse({
    nomeFantasia: texto(form.get("nomeFantasia")),
    razaoSocial: texto(form.get("razaoSocial")),
    cnpj: texto(form.get("cnpj")),
    tipoNegocio: texto(form.get("tipoNegocio")),
    responsavel: texto(form.get("responsavel")),
    whatsapp: texto(form.get("whatsapp")),
    email: texto(form.get("email"))?.toLowerCase() ?? null,
    endereco: texto(form.get("endereco")),
    cep: texto(form.get("cep")),
    consumoSemanal: numero(form.get("consumoSemanal")),
    limiteCredito: numero(form.get("limiteCredito")),
    observacoes: texto(form.get("observacoes")),
  });

/** Libera o app EGGS pra um cliente (já cadastrado ou novo): gera código de acesso + senha */
export async function darAcesso(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const condicoes = lerCondicoes(form);
  if (!condicoes.success) return { erro: condicoes.error.issues[0].message };

  let clienteId = texto(form.get("clienteId"));
  if (clienteId) {
    if (await db.usuario.findUnique({ where: { clienteId } })) return { erro: "Esse cliente já tem acesso ao EGGS" };
    await db.cliente.update({ where: { id: clienteId }, data: condicoes.data });
  } else {
    const dados = lerDados(form);
    if (!dados.success) return { erro: dados.error.issues[0].message };
    const d = dados.data;
    const novo = await db.cliente.create({
      data: { ...d, ...condicoes.data, razaoSocial: d.razaoSocial ?? d.nomeFantasia, tipoNegocio: d.tipoNegocio ?? "Outro" },
    });
    clienteId = novo.id;
  }

  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  const [codigo, senha] = [await novoCodigo(), senhaInicial()];
  await db.usuario.create({
    data: { nome: cliente.responsavel ?? cliente.nomeFantasia, email: `${codigo.toLowerCase()}@eggs.app`, codigoAcesso: codigo, senhaHash: gerarHash(senha), papel: "CLIENTE", clienteId },
  });
  atualizar();
  return { ok: Date.now(), senha, codigo };
}

export async function salvarCondicoes(clienteId: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = lerCondicoes(form);
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.cliente.update({ where: { id: clienteId }, data: r.data });
  atualizar();
  return { ok: Date.now() };
}

export async function salvarDados(clienteId: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = lerDados(form);
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.cliente.update({ where: { id: clienteId }, data: { ...r.data, razaoSocial: r.data.razaoSocial ?? r.data.nomeFantasia, tipoNegocio: r.data.tipoNegocio ?? "Outro" } });
  atualizar();
  return { ok: Date.now() };
}

/** Senha nova (mostrada uma vez só). Quem não tinha código ganha um; também desbloqueia */
export async function novaSenha(clienteId: string): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const usuario = await db.usuario.findUnique({ where: { clienteId } });
  if (!usuario) return { erro: "Cliente sem acesso" };
  const senha = senhaInicial();
  const codigo = usuario.codigoAcesso ?? (await novoCodigo());
  await db.usuario.update({ where: { id: usuario.id }, data: { senhaHash: gerarHash(senha), codigoAcesso: codigo, falhas: 0, bloqueadoAte: null } });
  return { ok: Date.now(), senha, codigo };
}

export async function desbloquear(clienteId: string) {
  await exigirPapel("DIRETOR");
  await db.usuario.updateMany({ where: { clienteId }, data: { falhas: 0, bloqueadoAte: null } });
  atualizar();
}

export async function alternarAcesso(clienteId: string) {
  await exigirPapel("DIRETOR");
  const usuario = await db.usuario.findUnique({ where: { clienteId } });
  if (!usuario) return;
  await db.usuario.update({ where: { id: usuario.id }, data: { ativo: !usuario.ativo } });
  atualizar();
}

/** Preço combinado com o cliente; vazio volta pro preço de tabela */
export async function salvarPrecoEspecial(clienteId: string, produtoId: string, form: FormData) {
  await exigirPapel("DIRETOR");
  const preco = numero(form.get("preco"));
  if (preco === null) await db.precoCliente.deleteMany({ where: { clienteId, produtoId } });
  else if (Number.isFinite(preco) && preco >= 0) {
    await db.precoCliente.upsert({ where: { clienteId_produtoId: { clienteId, produtoId } }, update: { preco }, create: { clienteId, produtoId, preco } });
  }
  atualizar();
}

export async function enviarMensagem(clienteId: string, _e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const t = texto(form.get("texto"));
  if (!t || t.length < 3) return { erro: "Escreva a mensagem" };
  await db.mensagem.create({ data: { clienteId, tipo: "AVISO", texto: t.slice(0, 600), autor: texto(form.get("assinatura")) ?? usuario.nome } });
  atualizar();
  return { ok: Date.now() };
}

// Regiões e horários de entrega

export async function criarRegiao(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const nome = texto(form.get("nome"));
  if (!nome) return { erro: "Informe o nome da região" };
  if (await db.regiao.findUnique({ where: { nome } })) return { erro: "Essa região já existe" };
  await db.regiao.create({ data: { nome, bairros: texto(form.get("bairros")) } });
  atualizar();
  return { ok: Date.now() };
}

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário no formato 07:00");

export async function criarJanela(regiaoId: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = z
    .object({ diaSemana: z.number().int().min(0).max(6), inicio: hora, fim: hora, capacidade: z.number("Capacidade inválida").int().min(1, "Capacidade inválida").max(200) })
    .safeParse({ diaSemana: numero(form.get("diaSemana")), inicio: texto(form.get("inicio")), fim: texto(form.get("fim")), capacidade: numero(form.get("capacidade")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  if (r.data.fim <= r.data.inicio) return { erro: "O fim tem que ser depois do início" };
  if (await db.janelaEntrega.findUnique({ where: { regiaoId_diaSemana_inicio: { regiaoId, diaSemana: r.data.diaSemana, inicio: r.data.inicio } } })) return { erro: "Já existe esse horário nesse dia" };
  await db.janelaEntrega.create({ data: { ...r.data, regiaoId } });
  atualizar();
  return { ok: Date.now() };
}

export async function alternarJanela(id: string) {
  await exigirPapel("DIRETOR");
  const j = await db.janelaEntrega.findUniqueOrThrow({ where: { id } });
  await db.janelaEntrega.update({ where: { id }, data: { ativo: !j.ativo } });
  atualizar();
}

// Cobranças

export async function marcarPago(id: string) {
  await exigirPapel("DIRETOR");
  await db.cobranca.update({ where: { id }, data: { pagoEm: new Date() } });
  atualizar();
}

export async function desfazerPago(id: string) {
  await exigirPapel("DIRETOR");
  await db.cobranca.update({ where: { id }, data: { pagoEm: null } });
  atualizar();
}

// Preço agendado (previsibilidade pro cliente)

export async function agendarPreco(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const r = z
    .object({ produtoId: z.string().min(1, "Escolha o produto"), preco: z.number("Informe o preço").positive("Informe o preço"), aPartirDe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data") })
    .safeParse({ produtoId: texto(form.get("produtoId")) ?? "", preco: numero(form.get("preco")), aPartirDe: texto(form.get("aPartirDe")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  if (r.data.aPartirDe <= diaISO()) return { erro: "A data tem que ser a partir de amanhã (pra hoje, edite o preço no catálogo)" };
  await db.precoAgendado.create({ data: { ...r.data, autor: usuario.nome } });
  atualizar();
  return { ok: Date.now() };
}

export async function cancelarAgendado(id: string) {
  await exigirPapel("DIRETOR");
  await db.precoAgendado.deleteMany({ where: { id, aplicadoEm: null } });
  atualizar();
}

// Controle do app

/** Mesma mensagem pra todos os clientes com acesso ativo */
export async function avisarTodos(_e: Estado, form: FormData): Promise<Estado> {
  const usuario = await exigirPapel("DIRETOR");
  const t = texto(form.get("texto"));
  if (!t || t.length < 3) return { erro: "Escreva o aviso" };
  const clientes = await db.cliente.findMany({ where: { usuario: { ativo: true } }, select: { id: true } });
  await db.mensagem.createMany({ data: clientes.map((c) => ({ clienteId: c.id, tipo: "AVISO", texto: t.slice(0, 600), autor: texto(form.get("assinatura")) ?? usuario.nome })) });
  atualizar();
  return { ok: Date.now() };
}

export async function salvarManutencao(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  await gravarConfig(CONFIG.MANUTENCAO, form.get("ligada") === "1" ? "1" : "0");
  await gravarConfig(CONFIG.MANUTENCAO_TEXTO, texto(form.get("texto")) ?? "");
  atualizar();
  return { ok: Date.now() };
}

export async function salvarNovidades(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  await gravarConfig(CONFIG.NOVIDADES, (texto(form.get("texto")) ?? "").slice(0, 400));
  atualizar();
  return { ok: Date.now() };
}

export async function testarWhatsapp(): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const r = await enviarProGrupo("✅ Teste do EGGS: os pedidos do app vão chegar aqui no grupo.");
  revalidatePath("/painel/aplicativo");
  return r.ok ? { ok: Date.now() } : { erro: `Não foi: ${r.erro}` };
}
