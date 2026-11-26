"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { regiaoDoBairro } from "@/lib/cadastro";
import { TIPOS_NEGOCIO } from "@/lib/constantes";
import { db } from "@/lib/db";
import { errosDoForm } from "@/lib/erros";
import { buscarNegocio, buscarPorNome, linkPermitido, type OpcaoCadastro } from "@/lib/google-negocio";
import { consultarCnpj, formatarCnpj } from "@/lib/prospeccao";
import { exigirPapel } from "@/lib/sessao";

export type Opcao = OpcaoCadastro & { cnpj?: string | null; razaoSocial?: string | null };

/** Uma busca só pra tudo: nome do lugar, link do Google Maps ou CNPJ. Não salva nada */
export async function buscarCadastro(termo: string, nomeDoCliente: string): Promise<{ erro: string } | { opcoes: Opcao[] }> {
  await exigirPapel("DIRETOR");
  const t = String(termo ?? "").trim().slice(0, 2000);
  const nome = String(nomeDoCliente ?? "").slice(0, 120);
  if (/https?:\/\//.test(t)) {
    const r = await buscarNegocio(t);
    return "erro" in r ? r : { opcoes: [{ ...r.dados, parecido: true }] };
  }
  if (/^[\d\s./-]+$/.test(t) && t.replace(/\D/g, "").length === 14) {
    const r = await consultarCnpj(t);
    if ("erro" in r) return r;
    return {
      opcoes: [
        {
          nome: r.nomeFantasia ?? r.razaoSocial,
          tipoNegocio: null,
          whatsapp: null,
          endereco: r.endereco,
          bairro: r.bairro,
          cidade: r.cidade,
          cep: null,
          lat: null,
          lng: null,
          link: "",
          fontes: [r.situacao ? `Receita · ${r.situacao}` : "Receita"],
          faltou: [],
          parecido: true,
          cnpj: formatarCnpj(r.cnpj),
          razaoSocial: r.razaoSocial,
        },
      ],
    };
  }
  if (t.length < 3) return { erro: "Escreva o nome do lugar, cole o link do Google Maps ou o CNPJ." };
  const r = await buscarPorNome(t, nome);
  if ("erro" in r) return r;
  return r.opcoes.length ? r : { erro: "Não achei com esse nome. Tente com o bairro junto, ou cole o link do Google Maps." };
}

const opcional = (max: number) => z.string().transform((t) => t.trim().slice(0, max)).nullable(); // nada trava: entra como foi digitado
const esquema = z.object({
  endereco: opcional(200),
  bairro: opcional(80),
  cidade: opcional(60),
  cep: opcional(9),
  whatsapp: opcional(20),
  tipoNegocio: z.enum(TIPOS_NEGOCIO, "Escolha o tipo").nullable(),
  responsavel: opcional(80),
  cnpj: opcional(18),
  razaoSocial: opcional(120),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  linkMaps: z.string().max(500).refine(linkPermitido).nullable(),
});
export type DadosCompletar = z.infer<typeof esquema>;

/** Grava só o que foi preenchido (o que ficou vazio continua como está). Sem região, escolhe pelo bairro */
export async function completarCadastro(id: string, dados: DadosCompletar): Promise<{ erro?: string; campos?: Record<string, string> }> {
  await exigirPapel("DIRETOR");
  const r = esquema.safeParse(dados);
  if (!r.success) return errosDoForm(r.error);
  const cliente = await db.cliente.findUnique({ where: { id }, select: { endereco: true, bairro: true, cidade: true, regiaoId: true } });
  if (!cliente) return { erro: "Esse cliente não existe mais." };
  const { lat, lng, ...texto } = r.data;
  const preenchidos = Object.fromEntries(Object.entries(texto).filter(([, v]) => v)) as Partial<typeof texto>;
  const mudouEndereco = (["endereco", "bairro", "cidade"] as const).some((k) => preenchidos[k] && preenchidos[k] !== cliente[k]);
  const regiaoId = cliente.regiaoId ?? regiaoDoBairro(await db.regiao.findMany({ where: { ativo: true }, select: { id: true, bairros: true } }), preenchidos.bairro ?? cliente.bairro);
  await db.cliente.update({
    where: { id },
    data: {
      ...preenchidos,
      tipoNegocio: preenchidos.tipoNegocio ?? undefined,
      razaoSocial: preenchidos.razaoSocial ?? undefined,
      ...(lat !== null && lng !== null ? { lat, lng } : mudouEndereco ? { lat: null, lng: null } : {}),
      ...(regiaoId ? { regiaoId } : {}),
    },
  });
  revalidatePath("/painel", "layout");
  revalidatePath("/eggs", "layout");
  return {};
}
