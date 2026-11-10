"use server";

import { revalidatePath } from "next/cache";
import { gravarConfig } from "@/lib/config";
import { diaValido } from "@/lib/datas";
import { db } from "@/lib/db";
import {
  CHAVE_MENSAGEM, buscarNoGoogle, cnpjValido, ehStatusLead, ehTipoProspeccao, gravarCnpjNoLead, lerLista, nomeDoLote, resumoDaBusca, salvarLeads, REGIOES,
} from "@/lib/prospeccao";
import { exigirPapel } from "@/lib/sessao";

export type Estado = { erro?: string; ok?: number; resumo?: string };
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** "Buscar no Google": tipo + região + quantidade → leads novos na lista */
export async function buscarLeads(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const tipo = texto(form.get("tipo"));
  const regiao = texto(form.get("regiao"));
  const quantidade = Number(texto(form.get("quantidade")) || 50);
  if (!ehTipoProspeccao(tipo)) return { erro: "Escolha o tipo de estabelecimento" };
  if (!REGIOES[regiao]) return { erro: "Escolha a região" };
  if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 100) return { erro: "Quantidade de 1 a 100" };

  const r = await buscarNoGoogle({ tipo, regiao, quantidade });
  if (r.erro) return { erro: r.erro };
  const s = await salvarLeads(r.novos, nomeDoLote(tipo, regiao));
  revalidatePath("/painel/prospeccao");
  return { ok: Date.now(), resumo: resumoDaBusca(r, s) };
}

/** Lista que o bot gerou ou planilha (JSON ou CSV) */
export async function importarLista(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) return { erro: "Escolha o arquivo" };
  if (arquivo.size > 2_000_000) return { erro: "Arquivo grande demais (máximo 2 MB)" };
  const tipo = texto(form.get("tipo"));
  const r = lerLista(await arquivo.text(), { tipo: ehTipoProspeccao(tipo) ? tipo : "Lancheria", regiao: null });
  if ("erro" in r) return { erro: r.erro };
  if (!r.leads.length) return { erro: "Não achei nenhum estabelecimento com nome no arquivo" };
  const lote = `${nomeDoLote("Importado", arquivo.name.replace(/\.(json|csv)$/i, ""))}`;
  const s = await salvarLeads(r.leads, lote);
  revalidatePath("/painel/prospeccao");
  const extra = [s.atualizados && `${s.atualizados} completados`, s.repetidos && `${s.repetidos} já estavam na lista`, s.jaClientes && `${s.jaClientes} já são clientes`, r.ignoradas && `${r.ignoradas} linhas sem nome`].filter(Boolean);
  return { ok: Date.now(), resumo: `${s.criados} leads novos importados.${extra.length ? ` ${extra.join(", ")}.` : ""}` };
}

/** Ficha do lead: status, próximo passo, CNPJ (puxa razão social e porte da Receita) e anotações */
export async function atualizarLead(id: string, _e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return { erro: "Lead não encontrado" };
  const status = texto(form.get("status"));
  if (!ehStatusLead(status)) return { erro: "Status inválido" };
  const proximo = texto(form.get("proximoPasso"));
  const observacoes = texto(form.get("observacoes")).slice(0, 2000) || null;
  const cnpj = texto(form.get("cnpj")).replace(/\D/g, "");
  if (cnpj && !cnpjValido(cnpj)) return { erro: "CNPJ inválido: confira os 14 números" };

  await db.lead.update({
    where: { id },
    data: {
      status,
      observacoes,
      proximoPasso: proximo ? diaValido(proximo) : null,
      contatadoEm: lead.contatadoEm ?? (status !== "NOVO" ? new Date() : null),
      ...(cnpj ? {} : { cnpj: null, razaoSocial: null, porte: null, situacaoCnpj: null }),
    },
  });
  if (cnpj && cnpj !== lead.cnpj) {
    const r = await gravarCnpjNoLead(id, cnpj);
    revalidatePath("/painel/prospeccao");
    if ("erro" in r) return { erro: `Salvo, mas o CNPJ não foi conferido: ${r.erro}` };
    return { ok: Date.now(), resumo: `Salvo. Receita: ${[r.dados.razaoSocial, r.dados.porte, r.dados.situacao, r.dados.cidade].filter(Boolean).join(" · ")}` };
  }
  revalidatePath("/painel/prospeccao");
  return { ok: Date.now(), resumo: "Salvo." };
}

/** Clicou no WhatsApp: lead novo passa pra "Mensagem enviada" */
export async function marcarEnviado(id: string) {
  await exigirPapel("DIRETOR");
  await db.lead.updateMany({ where: { id, status: "NOVO" }, data: { status: "ENVIADO", contatadoEm: new Date() } });
  revalidatePath("/painel/prospeccao");
}

export async function excluirLead(id: string) {
  await exigirPapel("DIRETOR");
  await db.lead.deleteMany({ where: { id } });
  revalidatePath("/painel/prospeccao");
}

export async function salvarMensagem(_e: Estado, form: FormData): Promise<Estado> {
  await exigirPapel("DIRETOR");
  const mensagem = texto(form.get("mensagem"));
  if (mensagem.length < 20) return { erro: "Mensagem curta demais" };
  if (mensagem.length > 1500) return { erro: "Mensagem longa demais (máximo 1.500 letras)" };
  await gravarConfig(CHAVE_MENSAGEM, mensagem);
  revalidatePath("/painel/prospeccao");
  return { ok: Date.now(), resumo: "Mensagem salva." };
}
