// Bot de prospecção pela linha de comando: é o que o Claude roda quando o João pede "traga 50 lancherias da Zona Sul"
// (instruções em ../prospeccao-bot/CLAUDE.md). Grava no mesmo banco da aba Prospecção: pode rodar com o EGGS aberto.
//
// Rodar dentro de eggs/:
//   npx tsx scripts/prospeccao.ts buscar --tipo Lancheria --regiao "Zona Sul" --qtd 50
//   npx tsx scripts/prospeccao.ts sem-cnpj [--lote "10/11 · Lancheria · Zona Sul"]     → JSON dos leads sem CNPJ
//   npx tsx scripts/prospeccao.ts cnpj <id do lead> <cnpj>                             → confere na Receita e grava porte
//   npx tsx scripts/prospeccao.ts listar [--lote "..."] [--status NOVO]
//   npx tsx scripts/prospeccao.ts exportar [--lote "..."]                              → CSV em ../prospeccao-bot/listas/
//   npx tsx scripts/prospeccao.ts importar <arquivo.json|csv> [--tipo Lancheria]
//   npx tsx scripts/prospeccao.ts regioes
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Lead } from "@prisma/client";
import { db } from "../src/lib/db";
import {
  MENSAGEM_PADRAO, REGIOES, acharRegiao, buscarNoGoogle, ehTipoProspeccao, formatarCnpj, gravarCnpjNoLead, lerLista, linkWhatsapp, montarMensagem, nomeDoLote, normalizar, resumoDaBusca, salvarLeads, TIPOS_PROSPECCAO,
} from "../src/lib/prospeccao";

// .env do EGGS (a chave do Google mora lá)
if (existsSync(".env")) {
  for (const linha of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const [comando, ...resto] = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = resto.indexOf(`--${nome}`);
  return i >= 0 ? resto[i + 1] : undefined;
};
const PASTA_LISTAS = path.resolve("..", "prospeccao-bot", "listas");

async function mensagemAtual() {
  return (await db.configuracao.findUnique({ where: { chave: "prospeccao.mensagem" } }))?.valor ?? MENSAGEM_PADRAO;
}

function tabela(leads: Lead[]) {
  console.table(
    leads.map((l) => ({
      nome: l.nome.slice(0, 32),
      whatsapp: l.telefone ?? "",
      tipo: l.celular ? "celular" : "fixo",
      bairro: l.bairro ?? "",
      cnpj: l.cnpj ? formatarCnpj(l.cnpj) : "",
      porte: l.porte ?? "",
      nota: l.nota ? `${l.nota} (${l.avaliacoes ?? 0})` : "",
      status: l.status,
    })),
  );
}

async function exportar(leads: Lead[], nomeArquivo: string) {
  const modelo = await mensagemAtual();
  mkdirSync(PASTA_LISTAS, { recursive: true });
  const cab = ["nome", "tipo", "whatsapp", "celular", "endereco", "bairro", "cidade", "cnpj", "razao_social", "porte", "nota", "avaliacoes", "status", "link_whatsapp", "link_maps", "lote"];
  const cel = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) =>
    [l.nome, l.tipoNegocio, l.telefone, l.celular ? "sim" : "não", l.endereco, l.bairro, l.cidade, l.cnpj ? formatarCnpj(l.cnpj) : "", l.razaoSocial, l.porte, l.nota, l.avaliacoes, l.status, l.whatsapp ? linkWhatsapp(l.whatsapp, montarMensagem(modelo, l)) : "", l.linkMaps, l.lote]
      .map(cel)
      .join(";"),
  );
  const arquivo = path.join(PASTA_LISTAS, nomeArquivo);
  writeFileSync(arquivo, "﻿" + [cab.join(";"), ...linhas].join("\r\n"), "utf8"); // ; e BOM: abre certo no Excel
  return arquivo;
}

const nomeArquivo = (lote: string) => `${new Date().toISOString().slice(0, 10)}-${normalizar(lote.split(" · ").slice(1).join(" ")).replace(/ /g, "-") || "leads"}.csv`;

async function main() {
  switch (comando) {
    case "buscar": {
      const tipoTexto = opcao("tipo") ?? "Lancheria";
      const tipo = TIPOS_PROSPECCAO.find((t) => normalizar(t) === normalizar(tipoTexto));
      const regiao = acharRegiao(opcao("regiao") ?? "Porto Alegre");
      const qtd = Number(opcao("qtd") ?? 50);
      if (!tipo || !ehTipoProspeccao(tipo)) throw new Error(`Tipo inválido. Use: ${TIPOS_PROSPECCAO.join(", ")}`);
      if (!regiao) throw new Error(`Região não encontrada. Use: ${Object.keys(REGIOES).join(", ")}`);
      console.log(`Buscando ${qtd} × ${tipo} em ${regiao}...`);
      const r = await buscarNoGoogle({ tipo, regiao, quantidade: qtd });
      if (r.erro) throw new Error(r.erro);
      const lote = nomeDoLote(tipo, regiao);
      const s = await salvarLeads(r.novos, lote);
      console.log(resumoDaBusca(r, s));
      const leads = await db.lead.findMany({ where: { lote }, orderBy: { criadoEm: "asc" } });
      tabela(leads);
      console.log(`LOTE: ${lote}`);
      console.log(`CSV: ${await exportar(leads, nomeArquivo(lote))}`);
      break;
    }
    case "sem-cnpj": {
      const lote = opcao("lote");
      const leads = await db.lead.findMany({ where: { cnpj: null, ...(lote ? { lote } : {}), status: { not: "SEM_INTERESSE" } }, orderBy: { criadoEm: "asc" } });
      console.log(JSON.stringify(leads.map((l) => ({ id: l.id, nome: l.nome, endereco: l.endereco, bairro: l.bairro, cidade: l.cidade, telefone: l.telefone, site: l.site })), null, 2));
      break;
    }
    case "cnpj": {
      const [id, cnpj] = resto;
      if (!id || !cnpj) throw new Error("Uso: cnpj <id do lead> <cnpj>");
      const lead = await db.lead.findUnique({ where: { id } });
      if (!lead) throw new Error("Lead não encontrado");
      const r = await gravarCnpjNoLead(id, cnpj);
      if ("erro" in r) throw new Error(r.erro);
      const d = r.dados;
      const mesmaCidade = !lead.cidade || !d.cidade || normalizar(lead.cidade) === normalizar(d.cidade);
      console.log(`${lead.nome} → ${formatarCnpj(d.cnpj)} · ${d.razaoSocial ?? ""} · ${d.nomeFantasia ?? "sem nome fantasia"} · porte ${d.porte ?? "?"} · ${d.situacao ?? ""}`);
      console.log(`Receita: ${[d.endereco, d.bairro, d.cidade].filter(Boolean).join(", ")} · ${d.atividade ?? ""}`);
      console.log(`Google:  ${[lead.endereco, lead.bairro, lead.cidade].filter(Boolean).join(", ")}`);
      if (!mesmaCidade) console.log("ATENÇÃO: cidade diferente da do Google. Confira se é o mesmo lugar.");
      if (d.situacao && d.situacao !== "Ativa") console.log(`ATENÇÃO: CNPJ com situação "${d.situacao}".`);
      break;
    }
    case "listar": {
      const lote = opcao("lote");
      const status = opcao("status");
      tabela(await db.lead.findMany({ where: { ...(lote ? { lote } : {}), ...(status ? { status } : {}) }, orderBy: { criadoEm: "desc" }, take: 300 }));
      break;
    }
    case "exportar": {
      const lote = opcao("lote");
      const leads = await db.lead.findMany({ where: lote ? { lote } : {}, orderBy: { criadoEm: "asc" } });
      console.log(`CSV: ${await exportar(leads, nomeArquivo(lote ?? "todas · leads"))} (${leads.length} leads)`);
      break;
    }
    case "importar": {
      const arquivo = resto.find((a) => !a.startsWith("--"));
      if (!arquivo || !existsSync(arquivo)) throw new Error("Uso: importar <arquivo.json|csv>");
      const tipoTexto = opcao("tipo") ?? "Lancheria";
      const tipo = TIPOS_PROSPECCAO.find((t) => normalizar(t) === normalizar(tipoTexto)) ?? "Lancheria";
      const r = lerLista(readFileSync(arquivo, "utf8"), { tipo, regiao: acharRegiao(opcao("regiao") ?? "") });
      if ("erro" in r) throw new Error(r.erro);
      const s = await salvarLeads(r.leads, nomeDoLote("Importado", path.basename(arquivo).replace(/\.(json|csv)$/i, "")));
      console.log(`${s.criados} novos, ${s.atualizados} completados, ${s.repetidos} repetidos, ${s.jaClientes} já clientes, ${r.ignoradas} linhas sem nome.`);
      break;
    }
    case "regioes":
      for (const [nome, r] of Object.entries(REGIOES)) console.log(`${nome}: ${r.bairros.length ? r.bairros.join(", ") : `${r.cidade} inteira`}`);
      break;
    default:
      console.log("Comandos: buscar, sem-cnpj, cnpj, listar, exportar, importar, regioes (ver o topo deste arquivo)");
  }
}

main()
  .catch((e: unknown) => {
    console.error(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
