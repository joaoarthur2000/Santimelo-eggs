"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAS_PAGAMENTO } from "@/lib/constantes";
import { criarAcesso, loginUnico, qrDeAcesso, senhaUnica } from "@/lib/acesso";
import { avisosDoCadastro, faltaNoCadastro } from "@/lib/cadastro";
import { diaISO } from "@/lib/datas";
import { db } from "@/lib/db";
import { CONFIG, gravarConfig } from "@/lib/config";
import { linkPermitido } from "@/lib/google-negocio";
import { gerarHash } from "@/lib/senha";
import { exigirPapel } from "@/lib/sessao";
import { enviarProGrupo } from "@/lib/whatsapp";

type Estado = { erro?: string; ok?: number; senha?: string; codigo?: string; campos?: Record<string, string>; avisos?: Record<string, string>; falta?: string[] };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const numero = (v: FormDataEntryValue | null) => (texto(v) === null ? null : Number(String(v).replace(",", ".")));

function atualizar() {
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
}

// Cadastro de cliente: faltar informação nunca impede de salvar (pedido do dono em 2026-11-25). Só o nome é preciso.
// Texto entra como foi digitado; número que não dá pra ler fica de fora (o valor anterior continua) e vira aviso.
const corta = (v: FormDataEntryValue | null, max: number) => texto(v)?.slice(0, max) ?? null;
const tipoOuADefinir = (v: FormDataEntryValue | null) => corta(v, 40) ?? "A definir"; // tipo antigo, fora da lista, continua valendo
const formaOuNada = (v: FormDataEntryValue | null) => FORMAS_PAGAMENTO.find((f) => f === texto(v));

function lerNumero(form: FormData, nome: string, max: number, avisos: Record<string, string>) {
  const t = texto(form.get(nome));
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  if (Number.isFinite(n) && n >= 0 && n <= max) return n;
  avisos[nome] = "Não entendi esse número, então não salvei";
  return undefined; // não mexe no que já estava
}

function lerCondicoes(form: FormData) {
  const prazo = texto(form.get("prazoPagamentoDias"));
  const dias = prazo === null ? null : Number(prazo);
  return {
    regiaoId: texto(form.get("regiaoId")),
    prazoPagamentoDias: dias === null || (Number.isInteger(dias) && dias >= 0 && dias <= 120) ? dias : undefined,
    formaPagamento: formaOuNada(form.get("formaPagamento")),
    notaFiscal: form.get("notaFiscal") === "1",
    negociacao: corta(form.get("negociacao"), 1000),
  };
}

// Dados que a Santimelo guarda do cliente
function lerDados(form: FormData) {
  const textos = {
    razaoSocial: corta(form.get("razaoSocial"), 120),
    cnpj: corta(form.get("cnpj"), 18),
    responsavel: corta(form.get("responsavel"), 80),
    whatsapp: corta(form.get("whatsapp"), 20),
    email: corta(form.get("email"), 120)?.toLowerCase() ?? null,
    bairro: corta(form.get("bairro"), 80),
    cidade: corta(form.get("cidade"), 60),
    cep: corta(form.get("cep"), 9),
    observacoes: corta(form.get("observacoes"), 1000),
  };
  const avisos = avisosDoCadastro(textos);
  const dados = {
    ...textos,
    tipoNegocio: tipoOuADefinir(form.get("tipoNegocio")),
    consumoSemanal: lerNumero(form, "consumoSemanal", 1000, avisos),
    limiteCredito: lerNumero(form, "limiteCredito", 1000000, avisos),
  };
  return { dados, avisos };
}

export type Cadastro = { erro?: string; campos?: Record<string, string>; falta?: string[]; clienteId?: string; nome?: string; responsavel?: string; whatsapp?: string; login?: string; senha?: string; qr?: string };

/** Cadastra o cliente (fica no painel e no app ao mesmo tempo) e, se pedido, já libera o app com login e senha */
export async function cadastrarCliente(_e: Cadastro, form: FormData): Promise<Cadastro> {
  await exigirPapel("DIRETOR");
  const nomeFantasia = corta(form.get("nomeFantasia"), 80);
  if (!nomeFantasia) return { erro: "Escreva pelo menos o nome do cliente.", campos: { nomeFantasia: "Escreva o nome do cliente" } };
  const { dados } = lerDados(form);
  const condicoes = lerCondicoes(form);
  const rua = corta(form.get("rua"), 120);
  const num = corta(form.get("numero"), 10);
  const complemento = corta(form.get("complemento"), 60);
  const endereco = [[rua, num].filter(Boolean).join(", "), complemento].filter(Boolean).join(" - ") || null;

  const cliente = await db.cliente.create({
    data: { ...dados, ...condicoes, nomeFantasia, endereco, razaoSocial: dados.razaoSocial ?? nomeFantasia },
  });
  const acesso = form.get("liberarApp") === "1" ? await criarAcesso(cliente.id) : null;
  atualizar();
  return {
    clienteId: cliente.id, nome: cliente.nomeFantasia, responsavel: cliente.responsavel ?? "", whatsapp: cliente.whatsapp ?? "", falta: faltaNoCadastro(cliente),
    ...acesso, ...(acesso && { qr: await qrDeAcesso(acesso.login) }),
  };
}

/** Libera o app pra um cliente já cadastrado (sem mexer no que foi combinado) */
export async function liberarApp(clienteId: string): Promise<Estado> {
  await exigirPapel("DIRETOR");
  if (await db.usuario.findUnique({ where: { clienteId } })) return { erro: "Esse cliente já tem acesso ao app" };
  const { login, senha } = await criarAcesso(clienteId);
  atualizar();
  return { ok: Date.now(), codigo: login, senha };
}

export async function salvarCondicoes(clienteId: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  await db.cliente.update({ where: { id: clienteId }, data: lerCondicoes(form) });
  atualizar();
  return { ok: Date.now() };
}

/** Posição exata e link do Maps, quando a ficha foi preenchida pelo Google */
function doGoogle(form: FormData) {
  const lat = numero(form.get("lat"));
  const lng = numero(form.get("lng"));
  const link = texto(form.get("linkMaps"));
  return {
    ...(lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {}),
    ...(link && link.length <= 500 && linkPermitido(link) ? { linkMaps: link } : {}),
  };
}

export async function salvarDados(clienteId: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const { dados, avisos } = lerDados(form);
  const endereco = corta(form.get("endereco"), 200);
  const nome = corta(form.get("nomeFantasia"), 80);
  if (!nome) avisos.nomeFantasia = "Deixei o nome que já estava";
  // endereço mudou: apaga a posição e a próxima rota localiza de novo. Não mudou: mantém (pode ser a posição exata do Google)
  const antes = await db.cliente.findUnique({ where: { id: clienteId }, select: { nomeFantasia: true, endereco: true, bairro: true, cidade: true } });
  if (!antes) return { erro: "Esse cliente não existe mais." };
  const mudou = antes.endereco !== endereco || antes.bairro !== dados.bairro || antes.cidade !== dados.cidade;
  const cliente = await db.cliente.update({
    where: { id: clienteId },
    data: { ...dados, endereco, nomeFantasia: nome ?? undefined, razaoSocial: dados.razaoSocial ?? nome ?? antes.nomeFantasia, ...(mudou ? { lat: null, lng: null } : {}), ...doGoogle(form) },
  });
  atualizar();
  return { ok: Date.now(), avisos, falta: faltaNoCadastro(cliente) };
}

/** Senha nova (mostrada uma vez só). Quem não tinha código ganha um; também desbloqueia */
export async function novaSenha(clienteId: string): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const usuario = await db.usuario.findUnique({ where: { clienteId } });
  if (!usuario) return { erro: "Cliente sem acesso" };
  const senha = await senhaUnica(usuario.id);
  const codigo = usuario.codigoAcesso ?? (await loginUnico(usuario.nome));
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

/** Atendimento do chat do Guinho: aberto → em atendimento → resolvido */
export async function mudarAtendimento(id: number, status: "ABERTO" | "ANDAMENTO" | "RESOLVIDO") {
  await exigirPapel("DIRETOR");
  await db.atendimento.update({ where: { id }, data: { status, resolvidoEm: status === "RESOLVIDO" ? new Date() : null } });
  revalidatePath("/painel", "layout");
}

export async function salvarNotaAtendimento(id: number, form: FormData) {
  await exigirPapel("DIRETOR");
  await db.atendimento.update({ where: { id }, data: { nota: (texto(form.get("nota")) ?? "").slice(0, 1000) || null } });
  revalidatePath("/painel/atendimentos");
}

/** Número da Santimelo que o chat do Guinho abre no WhatsApp */
export async function salvarWhatsappAtendimento(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const numero = (texto(form.get("numero")) ?? "").replace(/\D/g, "");
  if (numero && (numero.length < 10 || numero.length > 13)) return { erro: "Número inválido. Use DDD + número, ex: (51) 99999-9999" };
  await gravarConfig(CONFIG.WHATSAPP_ATENDIMENTO, numero);
  atualizar();
  return { ok: Date.now() };
}

/** Equipe responde o cliente no chat do atendimento (aparece no app dele, com aviso) */
export async function enviarMensagemAtendimento(id: number, form: FormData) {
  const usuario = await exigirPapel("DIRETOR");
  const t = (texto(form.get("texto")) ?? "").slice(0, 1000);
  if (!t) return;
  const a = await db.atendimento.findUniqueOrThrow({ where: { id } });
  await db.mensagemAtendimento.create({ data: { atendimentoId: id, de: "EQUIPE", autor: usuario.nome.split(" ")[0], texto: t } });
  if (a.status !== "ANDAMENTO") await db.atendimento.update({ where: { id }, data: { status: "ANDAMENTO", resolvidoEm: null } });
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
}
