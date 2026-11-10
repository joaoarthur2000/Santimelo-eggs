// Prospecção: estabelecimentos que ainda não são clientes da Santimelo (aba Prospecção + bot em ../prospeccao-bot).
//
// - Busca: Google Places API (New), a fonte oficial do Google Maps, com a mesma chave do "Puxar do Google"
//   (GOOGLE_PLACES_API_KEY no .env). A página do Maps nunca é raspada: isso vai contra os termos do Google.
//   Cada chamada traz até 20 lugares; o Google dá 1.000 chamadas grátis por mês nesse tipo de busca (com telefone).
// - CNPJ e porte: Receita Federal pela BrasilAPI (grátis, sem chave), com a minhareceita.org de reserva.
// - Sem "server-only" de propósito: o bot usa este arquivo pela linha de comando (scripts/prospeccao.ts).

import type { Lead, Prisma } from "@prisma/client";
import { TIPOS_NEGOCIO } from "./constantes";
import { formatarDataCurta } from "./datas";
import { db } from "./db";

// ---------- status e tipos ----------

export const STATUS_LEAD = {
  NOVO: "Novo",
  ENVIADO: "Mensagem enviada",
  RESPONDEU: "Respondeu",
  VISITA: "Visita marcada",
  AMOSTRA: "Amostra entregue",
  CLIENTE: "Virou cliente",
  SEM_INTERESSE: "Sem interesse",
} as const;
export type StatusLead = keyof typeof STATUS_LEAD;
export const ehStatusLead = (s: string): s is StatusLead => s in STATUS_LEAD;
/** Conversa em andamento: já mandou mensagem e ainda não fechou nem desistiu */
export const EM_CONVERSA: StatusLead[] = ["ENVIADO", "RESPONDEU", "VISITA", "AMOSTRA"];

type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];
/** Tipos que dá pra prospectar (consumidor final não) */
export const TIPOS_PROSPECCAO = ["Lancheria", "Restaurante", "Padaria", "Confeitaria", "Mercado"] as const satisfies readonly TipoNegocio[];
export type TipoProspeccao = (typeof TIPOS_PROSPECCAO)[number];
export const ehTipoProspeccao = (s: string): s is TipoProspeccao => (TIPOS_PROSPECCAO as readonly string[]).includes(s);

/** O que digitar no Google pra cada tipo (o segundo termo só entra se o primeiro não bastar) */
const TERMOS: Record<TipoProspeccao, string[]> = {
  Lancheria: ["lancheria", "lanchonete"],
  Restaurante: ["restaurante", "restaurante buffet"],
  Padaria: ["padaria"],
  Confeitaria: ["confeitaria", "doceria"],
  Mercado: ["mercado", "minimercado"],
};

// Grandes redes compram pela central: não adianta chamar a loja
const REDES = ["mcdonald", "burger king", "subway", "bob s", "habib", "giraffas", "kfc", "popeyes", "outback", "starbucks", "spoleto", "china in box", "domino s", "pizza hut", "madero", "jeronimo", "carrefour", "zaffari", "bourbon", "nacional", "big ", "atacadao", "assai", "unidasul", "cia do lanche"];

// ---------- regiões ----------

type Regiao = { cidade: string; bairros: string[] };

// Zonas de Porto Alegre pelo jeito que se fala no dia a dia (ajustar à vontade). Cidade da região: a cidade toda.
export const REGIOES: Record<string, Regiao> = {
  "Zona Sul": {
    cidade: "Porto Alegre",
    bairros: [
      "Tristeza", "Ipanema", "Cavalhada", "Camaquã", "Vila Nova", "Teresópolis", "Nonoai", "Cristal", "Vila Assunção",
      "Hípica", "Espírito Santo", "Guarujá", "Serraria", "Belém Novo", "Belém Velho", "Restinga", "Vila Conceição",
      "Pedra Redonda", "Jardim Isabel", "Campo Novo", "Aberta dos Morros", "Ponta Grossa", "Lami", "Chapéu do Sol",
      "Lageado", "Cascata", "Sétimo Céu",
    ],
  },
  "Zona Norte": {
    cidade: "Porto Alegre",
    bairros: [
      "Sarandi", "Rubem Berta", "Passo das Pedras", "Jardim Lindóia", "São Sebastião", "Cristo Redentor", "Jardim Itu",
      "Vila Ipiranga", "Passo d'Areia", "Higienópolis", "São João", "Navegantes", "Humaitá", "Anchieta", "Farrapos",
      "Jardim São Pedro", "Santa Maria Goretti", "Jardim Floresta", "Costa e Silva", "Parque Santa Fé", "Jardim Europa",
      "Boa Vista", "Jardim Sabará",
    ],
  },
  "Zona Leste": {
    cidade: "Porto Alegre",
    bairros: [
      "Partenon", "Bom Jesus", "Jardim Carvalho", "Lomba do Pinheiro", "Agronomia", "Protásio Alves", "Chácara das Pedras",
      "Três Figueiras", "Vila Jardim", "Jardim do Salso", "Jardim Botânico", "Morro Santana", "São José",
      "Coronel Aparício Borges", "Mário Quintana", "Vila João Pessoa", "Glória",
    ],
  },
  Centro: {
    cidade: "Porto Alegre",
    bairros: [
      "Centro Histórico", "Cidade Baixa", "Bom Fim", "Farroupilha", "Floresta", "Independência", "Moinhos de Vento",
      "Rio Branco", "Santana", "Santa Cecília", "Menino Deus", "Praia de Belas", "Azenha", "Auxiliadora", "Mont'Serrat",
      "Bela Vista", "Petrópolis", "Santo Antônio", "Medianeira", "Santa Tereza",
    ],
  },
  "Porto Alegre (toda)": { cidade: "Porto Alegre", bairros: [] },
  Canoas: { cidade: "Canoas", bairros: [] },
  Viamão: { cidade: "Viamão", bairros: [] },
  Alvorada: { cidade: "Alvorada", bairros: [] },
  Guaíba: { cidade: "Guaíba", bairros: [] },
  Cachoeirinha: { cidade: "Cachoeirinha", bairros: [] },
  Gravataí: { cidade: "Gravataí", bairros: [] },
  Esteio: { cidade: "Esteio", bairros: [] },
  "Sapucaia do Sul": { cidade: "Sapucaia do Sul", bairros: [] },
};
export const NOMES_REGIOES = Object.keys(REGIOES);

/** "zona sul", "ZS", "sul" → "Zona Sul" (o bot recebe do jeito que o João escreve) */
export function acharRegiao(texto: string): string | null {
  const t = normalizar(texto);
  const apelidos: Record<string, string> = { zs: "Zona Sul", sul: "Zona Sul", zn: "Zona Norte", norte: "Zona Norte", zl: "Zona Leste", leste: "Zona Leste", centro: "Centro", poa: "Porto Alegre (toda)", "porto alegre": "Porto Alegre (toda)", cidade: "Porto Alegre (toda)" };
  if (apelidos[t]) return apelidos[t];
  return NOMES_REGIOES.find((r) => normalizar(r) === t) ?? NOMES_REGIOES.find((r) => normalizar(r).includes(t)) ?? null;
}

// ---------- texto, telefone e CNPJ ----------

export const normalizar = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * "+55 51 99999-9999", "(51) 9999-9999" (celular antigo, sem o 9) → telefone formatado + só os dígitos pro link
 * do WhatsApp. Celular quase sempre tem WhatsApp; fixo pode ter WhatsApp Business.
 */
export function normalizarTelefone(bruto: string | null | undefined): { telefone: string | null; whatsapp: string | null; celular: boolean } {
  const nada = { telefone: null, whatsapp: null, celular: false };
  let d = soDigitos((bruto ?? "").split(/[;,/]/)[0]);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (/^0?800/.test(d)) return nada;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (d.length !== 10 && d.length !== 11) return nada;
  const telefone = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return { telefone, whatsapp: d, celular: d.length === 11 && d[2] === "9" };
}

export function cnpjValido(cnpj: string | null | undefined) {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digito = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

export const formatarCnpj = (cnpj: string | null | undefined) => {
  const d = soDigitos(cnpj);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (cnpj ?? "");
};

// ---------- mensagem de WhatsApp ----------

export const CHAVE_MENSAGEM = "prospeccao.mensagem"; // tabela Configuracao
export const MENSAGEM_PADRAO = `Oi, tudo bem? Aqui é o João, da Santimelo 🥚
A gente distribui ovos em Porto Alegre e região e entrega direto no estabelecimento, nas terças e quintas de manhã.
Vi a {nome} e queria saber se vocês teriam interesse numa cotação. Se fizer sentido, passo aí e deixo uma amostra pra vocês testarem.
Se não for o momento, é só avisar que não mando mais mensagem 🙂`;

/** Troca {nome}, {bairro} e {tipo} pelos dados do lead */
export function montarMensagem(modelo: string, lead: Pick<Lead, "nome" | "bairro" | "tipoNegocio">) {
  return modelo
    .replaceAll("{nome}", lead.nome)
    .replaceAll("{bairro}", lead.bairro ?? "sua região")
    .replaceAll("{tipo}", lead.tipoNegocio.toLowerCase())
    .trim();
}

export const linkWhatsapp = (whatsapp: string, texto: string) => `https://wa.me/55${whatsapp}?text=${encodeURIComponent(texto)}`;

// ---------- busca no Google (Places API New) ----------

export type LeadNovo = {
  nome: string;
  tipoNegocio: string;
  telefone: string | null;
  whatsapp: string | null;
  celular: boolean;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  regiao: string | null;
  lat: number | null;
  lng: number | null;
  linkMaps: string | null;
  googlePlaceId: string | null;
  nota: number | null;
  avaliacoes: number | null;
  site: string | null;
  cnpj?: string | null;
  razaoSocial?: string | null;
  porte?: string | null;
  observacoes?: string | null;
};

type LugarPlaces = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
};

const CAMPOS_PLACES =
  ["id", "displayName", "formattedAddress", "addressComponents", "nationalPhoneNumber", "internationalPhoneNumber", "location", "googleMapsUri", "businessStatus", "rating", "userRatingCount", "websiteUri"]
    .map((c) => `places.${c}`)
    .join(",") + ",nextPageToken";

/** Teto de chamadas por busca: uma busca de 50 costuma gastar de 3 a 10 */
const MAX_CHAMADAS = 30;

export const temChaveGoogle = () => !!process.env.GOOGLE_PLACES_API_KEY;

function erroDoGoogle(status: number, corpo: string) {
  if (/API_KEY_INVALID|API key not valid/i.test(corpo)) return "A chave do Google está errada. Confira GOOGLE_PLACES_API_KEY no .env do EGGS.";
  if (/BILLING|billing/i.test(corpo)) return "O projeto do Google está sem faturamento ativado. Ative o faturamento no Google Cloud (a busca continua grátis até o limite do mês).";
  if (status === 403) return "A Places API (New) não está ativada nesse projeto do Google, ou a chave não tem permissão pra ela.";
  if (status === 429) return "Passou do limite de buscas do Google por agora. Tente de novo mais tarde.";
  return `O Google recusou a busca (erro ${status}).`;
}

async function chamarPlaces(chave: string, textQuery: string, pageToken?: string): Promise<{ lugares: LugarPlaces[]; proxima?: string } | { erro: string }> {
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": CAMPOS_PLACES },
      body: JSON.stringify({ textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { erro: erroDoGoogle(r.status, await r.text()) };
    const j = (await r.json()) as { places?: LugarPlaces[]; nextPageToken?: string };
    return { lugares: j.places ?? [], proxima: j.nextPageToken };
  } catch {
    return { erro: "Não consegui falar com o Google agora (sem internet ou demorou demais)." };
  }
}

function enderecoDoLugar(l: LugarPlaces) {
  const comp = (tipo: string) => l.addressComponents?.find((c) => c.types.includes(tipo))?.longText ?? null;
  const rua = comp("route");
  const numero = comp("street_number");
  const cep = soDigitos(comp("postal_code"));
  return {
    endereco: rua ? (numero ? `${rua}, ${numero}` : rua) : (l.formattedAddress?.split(" - ")[0] ?? null),
    bairro: comp("sublocality_level_1") ?? comp("sublocality") ?? comp("neighborhood"),
    cidade: comp("administrative_area_level_2") ?? comp("locality"),
    cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
  };
}

export type ResultadoBusca = {
  novos: LeadNovo[];
  chamadas: number;
  pulados: { semTelefone: number; foraDaRegiao: number; jaNaLista: number; jaCliente: number; fechados: number; redes: number };
  erro?: string;
};

/**
 * Busca no Google até `quantidade` estabelecimentos do tipo na região, bairro por bairro, e já tira:
 * fechados, sem telefone, fora da região, grandes redes, quem já está na lista e quem já é cliente.
 */
export async function buscarNoGoogle({ tipo, regiao, quantidade }: { tipo: TipoProspeccao; regiao: string; quantidade: number }): Promise<ResultadoBusca> {
  const pulados = { semTelefone: 0, foraDaRegiao: 0, jaNaLista: 0, jaCliente: 0, fechados: 0, redes: 0 };
  const vazio = (erro: string): ResultadoBusca => ({ novos: [], chamadas: 0, pulados, erro });
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) return vazio("Falta a chave do Google (GOOGLE_PLACES_API_KEY no .env do EGGS). O passo a passo está em prospeccao-bot/README.md.");
  const reg = REGIOES[regiao];
  if (!reg) return vazio(`Não conheço a região "${regiao}". Use uma destas: ${NOMES_REGIOES.join(", ")}.`);
  const alvo = Math.max(1, Math.min(100, Math.round(quantidade)));

  const [leads, clientes] = await Promise.all([
    db.lead.findMany({ select: { googlePlaceId: true, whatsapp: true } }),
    db.cliente.findMany({ select: { whatsapp: true, nomeFantasia: true } }),
  ]);
  const idsNaLista = new Set(leads.map((l) => l.googlePlaceId));
  const whatsNaLista = new Set(leads.map((l) => l.whatsapp).filter(Boolean));
  const whatsClientes = new Set(clientes.map((c) => normalizarTelefone(c.whatsapp).whatsapp).filter(Boolean));
  const nomesClientes = new Set(clientes.map((c) => normalizar(c.nomeFantasia)));
  const bairrosDaRegiao = reg.bairros.map(normalizar);
  const cidade = normalizar(reg.cidade);
  const locais = reg.bairros.length ? reg.bairros.map((b) => `${b}, ${reg.cidade} - RS`) : [`${reg.cidade} - RS`];

  const novos: LeadNovo[] = [];
  const vistos = new Set<string>();
  let chamadas = 0;

  for (const termo of TERMOS[tipo]) {
    for (const local of locais) {
      let token: string | undefined;
      let paginas = 0;
      do {
        if (novos.length >= alvo || chamadas >= MAX_CHAMADAS) break;
        const r = await chamarPlaces(chave, `${termo} em ${local}`, token);
        chamadas++;
        if ("erro" in r) {
          if (!novos.length) return { novos, chamadas, pulados, erro: r.erro };
          token = undefined;
          break;
        }
        for (const l of r.lugares) {
          if (novos.length >= alvo) break;
          if (vistos.has(l.id)) continue;
          vistos.add(l.id);
          const nome = l.displayName?.text?.trim();
          if (!nome) continue;
          if (l.businessStatus && l.businessStatus !== "OPERATIONAL") { pulados.fechados++; continue; }
          const nomeNorm = ` ${normalizar(nome)} `;
          if (REDES.some((rede) => nomeNorm.includes(` ${rede}`))) { pulados.redes++; continue; }
          const end = enderecoDoLugar(l);
          if (end.cidade && normalizar(end.cidade) !== cidade) { pulados.foraDaRegiao++; continue; }
          if (bairrosDaRegiao.length && end.bairro && !bairrosDaRegiao.some((b) => normalizar(end.bairro).includes(b) || b.includes(normalizar(end.bairro)))) {
            pulados.foraDaRegiao++;
            continue;
          }
          const tel = normalizarTelefone(l.nationalPhoneNumber ?? l.internationalPhoneNumber);
          if (!tel.whatsapp) { pulados.semTelefone++; continue; }
          if (whatsClientes.has(tel.whatsapp) || nomesClientes.has(normalizar(nome))) { pulados.jaCliente++; continue; }
          if (idsNaLista.has(l.id) || whatsNaLista.has(tel.whatsapp)) { pulados.jaNaLista++; continue; }
          whatsNaLista.add(tel.whatsapp);
          novos.push({
            nome,
            tipoNegocio: tipo,
            ...tel,
            ...end,
            cidade: end.cidade ?? reg.cidade,
            regiao,
            lat: l.location?.latitude ?? null,
            lng: l.location?.longitude ?? null,
            linkMaps: l.googleMapsUri ?? null,
            googlePlaceId: l.id,
            nota: l.rating ?? null,
            avaliacoes: l.userRatingCount ?? null,
            site: l.websiteUri ?? null,
          });
        }
        token = r.proxima;
        paginas++;
        // bairro: 1 página (20 lugares) e passa pro próximo bairro; cidade inteira: até 3 páginas por termo
      } while (token && paginas < (reg.bairros.length ? 1 : 3));
    }
    if (novos.length >= alvo || chamadas >= MAX_CHAMADAS) break;
  }
  return { novos, chamadas, pulados };
}

export const nomeDoLote = (tipo: string, regiao: string) => `${formatarDataCurta(new Date())} · ${tipo} · ${regiao}`;

export function resumoDaBusca(r: ResultadoBusca, s: { criados: number }) {
  const p = r.pulados;
  const fora = [
    p.jaNaLista && `${p.jaNaLista} já estavam na lista`,
    p.jaCliente && `${p.jaCliente} já são clientes`,
    p.semTelefone && `${p.semTelefone} sem telefone no Google`,
    p.foraDaRegiao && `${p.foraDaRegiao} fora da região`,
    p.redes && `${p.redes} de grandes redes`,
    p.fechados && `${p.fechados} fechados`,
  ].filter(Boolean);
  return `${s.criados} leads novos na lista (${r.chamadas} ${r.chamadas === 1 ? "busca" : "buscas"} no Google).${fora.length ? ` Ficaram de fora: ${fora.join(", ")}.` : ""}`;
}

// ---------- salvar ----------

const CAMPOS_COMPLETAVEIS = ["telefone", "whatsapp", "endereco", "bairro", "cidade", "cep", "lat", "lng", "linkMaps", "googlePlaceId", "nota", "avaliacoes", "site", "cnpj", "razaoSocial", "porte"] as const;

/** Grava os leads novos. Se o lugar já está na lista, só completa o que faltava (status e anotações ficam como estão). */
export async function salvarLeads(lista: LeadNovo[], lote: string) {
  const clientes = await db.cliente.findMany({ select: { whatsapp: true } });
  const whatsClientes = new Set(clientes.map((c) => normalizarTelefone(c.whatsapp).whatsapp).filter(Boolean));
  let criados = 0, atualizados = 0, repetidos = 0, jaClientes = 0;
  for (const l of lista) {
    if (l.whatsapp && whatsClientes.has(l.whatsapp)) { jaClientes++; continue; }
    const existente =
      (l.googlePlaceId && (await db.lead.findUnique({ where: { googlePlaceId: l.googlePlaceId } }))) ||
      (l.whatsapp && (await db.lead.findFirst({ where: { whatsapp: l.whatsapp } }))) ||
      (await db.lead.findFirst({ where: { nome: l.nome, bairro: l.bairro } }));
    if (existente) {
      const faltando: Record<string, string | number | boolean> = {};
      for (const c of CAMPOS_COMPLETAVEIS) {
        const novo = l[c];
        if ((existente[c] === null || existente[c] === "") && novo !== null && novo !== undefined && novo !== "") faltando[c] = novo;
      }
      if (faltando.whatsapp) faltando.celular = l.celular;
      if (Object.keys(faltando).length) {
        await db.lead.update({ where: { id: existente.id }, data: faltando as Prisma.LeadUncheckedUpdateInput });
        atualizados++;
      } else repetidos++;
      continue;
    }
    await db.lead.create({ data: { ...l, lote } });
    criados++;
  }
  return { criados, atualizados, repetidos, jaClientes };
}

// ---------- importar lista (arquivo do bot ou planilha) ----------

const SINONIMOS: Record<string, keyof LeadNovo> = {
  nome: "nome", name: "nome", nomefantasia: "nome", estabelecimento: "nome", empresa: "nome",
  tipo: "tipoNegocio", tiponegocio: "tipoNegocio", segmento: "tipoNegocio",
  whatsapp: "whatsapp", telefone: "whatsapp", phone: "whatsapp", celular: "whatsapp", fone: "whatsapp",
  endereco: "endereco", address: "endereco", rua: "endereco", logradouro: "endereco",
  bairro: "bairro", cidade: "cidade", municipio: "cidade", cep: "cep", regiao: "regiao", zona: "regiao",
  cnpj: "cnpj", razaosocial: "razaoSocial", porte: "porte",
  linkmaps: "linkMaps", maps: "linkMaps", googlemaps: "linkMaps", placeid: "googlePlaceId", googleplaceid: "googlePlaceId",
  nota: "nota", rating: "nota", avaliacoes: "avaliacoes", site: "site", website: "site",
  observacoes: "observacoes", obs: "observacoes", observacao: "observacoes",
};
const chaveCanonica = (k: string) => SINONIMOS[normalizar(k).replace(/ /g, "")] ?? null;

function lerCsv(texto: string): Record<string, string>[] {
  const primeira = texto.split("\n")[0];
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cabecalho = [], ...resto] = linhas;
  return resto.filter((l) => l.some((v) => v.trim())).map((l) => Object.fromEntries(cabecalho.map((k, i) => [k, (l[i] ?? "").trim()])));
}

/** JSON (lista de objetos, ou { leads: [...] }) ou CSV com cabeçalho (vírgula ou ponto e vírgula, como o Excel salva) */
export function lerLista(texto: string, padrao: { tipo: string; regiao: string | null }): { leads: LeadNovo[]; ignoradas: number } | { erro: string } {
  const t = texto.replace(/^﻿/, "").trim();
  if (!t) return { erro: "O arquivo está vazio." };
  let brutas: Record<string, unknown>[];
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as unknown;
      const lista = Array.isArray(j) ? j : (j as { leads?: unknown }).leads;
      if (!Array.isArray(lista)) return { erro: "O JSON precisa ser uma lista de estabelecimentos." };
      brutas = lista as Record<string, unknown>[];
    } catch {
      return { erro: "O JSON está com erro de formatação." };
    }
  } else brutas = lerCsv(t);

  const tipos = TIPOS_NEGOCIO as readonly string[];
  const leads: LeadNovo[] = [];
  let ignoradas = 0;
  for (const bruta of brutas) {
    const o: Partial<Record<keyof LeadNovo, string>> = {};
    for (const [k, v] of Object.entries(bruta ?? {})) {
      const c = chaveCanonica(k);
      if (c && v !== null && v !== undefined && String(v).trim() && !o[c]) o[c] = String(v).trim();
    }
    if (!o.nome) { ignoradas++; continue; }
    const tel = normalizarTelefone(o.whatsapp);
    const tipo = tipos.find((x) => normalizar(x) === normalizar(o.tipoNegocio)) ?? padrao.tipo;
    const numero = (v?: string) => (v && Number.isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : null);
    const cnpj = soDigitos(o.cnpj);
    leads.push({
      nome: o.nome.slice(0, 120),
      tipoNegocio: tipo,
      ...tel,
      endereco: o.endereco ?? null,
      bairro: o.bairro ?? null,
      cidade: o.cidade ?? "Porto Alegre",
      cep: o.cep ?? null,
      regiao: o.regiao ?? padrao.regiao,
      lat: null,
      lng: null,
      linkMaps: o.linkMaps && /^https:\/\//.test(o.linkMaps) ? o.linkMaps : null,
      googlePlaceId: o.googlePlaceId ?? null,
      nota: numero(o.nota),
      avaliacoes: numero(o.avaliacoes),
      site: o.site && /^https?:\/\//.test(o.site) ? o.site : null,
      cnpj: cnpjValido(cnpj) ? cnpj : null,
      razaoSocial: o.razaoSocial ?? null,
      porte: o.porte ?? null,
      observacoes: o.observacoes ?? null,
    });
  }
  return { leads, ignoradas };
}

// ---------- CNPJ na Receita ----------

export type DadosCnpj = {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  porte: string | null;
  situacao: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  atividade: string | null;
};

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

/** Porte como se fala: MEI, ME, EPP ou Demais (médias e grandes) */
function porteDe(j: Record<string, unknown>) {
  if (j.opcao_pelo_mei === true) return "MEI";
  const p = String(j.porte ?? j.descricao_porte ?? "").toUpperCase();
  if (p.includes("MICRO")) return "ME";
  if (p.includes("PEQUENO")) return "EPP";
  if (p.includes("DEMAIS")) return "Demais";
  return p ? titulo(p) : null;
}

export async function consultarCnpj(cnpj: string): Promise<DadosCnpj | { erro: string }> {
  const d = soDigitos(cnpj);
  if (!cnpjValido(d)) return { erro: "CNPJ inválido: confira os 14 números." };
  for (const url of [`https://brasilapi.com.br/api/cnpj/v1/${d}`, `https://minhareceita.org/${d}`]) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "EGGS-Santimelo/1.0 (prospeccao)" }, signal: AbortSignal.timeout(12000) });
      if (r.status === 404) return { erro: "Esse CNPJ não existe na Receita." };
      if (!r.ok) continue;
      const j = (await r.json()) as Record<string, unknown>;
      const texto = (k: string) => (typeof j[k] === "string" && (j[k] as string).trim() ? (j[k] as string).trim() : null);
      const rua = [texto("descricao_tipo_de_logradouro"), texto("logradouro")].filter(Boolean).join(" ");
      return {
        cnpj: d,
        razaoSocial: texto("razao_social"),
        nomeFantasia: texto("nome_fantasia"),
        porte: porteDe(j),
        situacao: texto("descricao_situacao_cadastral") ? titulo(texto("descricao_situacao_cadastral")!) : null,
        endereco: rua ? titulo([rua, texto("numero")].filter(Boolean).join(", ")) : null,
        bairro: texto("bairro") ? titulo(texto("bairro")!) : null,
        cidade: texto("municipio") ? titulo(texto("municipio")!) : null,
        atividade: texto("cnae_fiscal_descricao"),
      };
    } catch {
      // tenta a próxima fonte
    }
  }
  return { erro: "Não consegui consultar a Receita agora. Tente de novo em alguns minutos." };
}

/** Grava CNPJ, razão social, porte e situação no lead */
export async function gravarCnpjNoLead(id: string, cnpj: string): Promise<{ dados: DadosCnpj } | { erro: string }> {
  const r = await consultarCnpj(cnpj);
  if ("erro" in r) return r;
  await db.lead.update({ where: { id }, data: { cnpj: r.cnpj, razaoSocial: r.razaoSocial, porte: r.porte, situacaoCnpj: r.situacao } });
  return { dados: r };
}
