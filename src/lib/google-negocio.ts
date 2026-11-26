import "server-only";
import { TIPOS_NEGOCIO } from "./constantes";

// Link do Google Maps / Google Meu Negócio → dados do cliente (nome, endereço, bairro, CEP, telefone, tipo, posição).
//
// 1. O próprio link já traz o nome e a posição exata do lugar (/maps/place/<nome>/...!3d<lat>!4d<lng>).
//    Link curto (maps.app.goo.gl, share.google, g.co) só é aberto pra ler o redirecionamento: a página do
//    Google em si nunca é lida (raspar o Google vai contra os termos dele).
// 2. Com GOOGLE_PLACES_API_KEY no .env: Places API (New), a fonte oficial. Traz endereço com número, telefone e categoria.
// 3. Sem a chave: OpenStreetMap (Nominatim, o mesmo das Rotas) pela posição e pelo nome. Costuma trazer endereço,
//    CEP e bairro; telefone só quando alguém cadastrou o lugar no OSM.

type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

export type DadosNegocio = {
  nome: string | null;
  tipoNegocio: TipoNegocio | null;
  whatsapp: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  link: string;
  fontes: string[];
  faltou: string[];
};

const AGENTE = "EGGS-Santimelo/1.0 (sistema de entregas)";
const ENCURTADORES = new Set(["maps.app.goo.gl", "goo.gl", "g.page", "g.co", "share.google", "www.share.google"]);
const ehGoogle = (host: string) => /^(www\.|maps\.)?google\.com(\.br)?$/.test(host);

/** Só guarda/abre link https do Google (evita salvar link qualquer que depois vira botão no painel) */
export function linkPermitido(texto: string) {
  try {
    const u = new URL(texto);
    return u.protocol === "https:" && (ENCURTADORES.has(u.hostname) || ehGoogle(u.hostname));
  } catch {
    return false;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "the", "and", "ltda", "me", "eireli"]);

/** Mesmo lugar? Um nome contém o outro, ou metade das palavras bate */
function nomesParecidos(a: string, b: string) {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p)));
  const tb = nb.split(" ").filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p));
  if (!ta.size || !tb.length) return false;
  const iguais = tb.filter((p) => ta.has(p)).length;
  return iguais / Math.min(ta.size, tb.length) >= 0.5;
}

// ---------- tipo de comércio ----------

const POR_NOME: [RegExp, TipoNegocio][] = [
  [/\b(padaria|panificadora|panificacao|paes|boulangerie)\b/, "Padaria"],
  [/\b(confeitaria|doceria|doces|bolos|patisserie|cakes?)\b/, "Confeitaria"],
  [/\b(lancheria|lanchonete|lanches?|burger|hamburgueria|hamburguer|xis|cachorro quente|hot dog|pastelaria|pastel)\b/, "Lancheria"],
  [/\b(restaurante|churrascaria|pizzaria|bistro|cantina|sushi|galeteria|buffet|parrilla|grill|trattoria|cozinha)\b/, "Restaurante"],
  [/\b(supermercado|mercado|mercadinho|minimercado|armazem|fruteira|hortifruti|atacadista|atacadao|emporio|acougue)\b/, "Mercado"],
];

function tipoPeloNome(nome: string | null): TipoNegocio | null {
  if (!nome) return null;
  const n = normalizar(nome);
  return POR_NOME.find(([re]) => re.test(n))?.[1] ?? null;
}

function tipoPeloGoogle(tipos: string[]): TipoNegocio | null {
  for (const t of tipos) {
    if (t === "bakery") return "Padaria";
    if (["confectionery", "dessert_shop", "pastry_shop", "cake_shop", "candy_store", "chocolate_shop"].includes(t)) return "Confeitaria";
    if (["fast_food_restaurant", "hamburger_restaurant", "sandwich_shop", "snack_bar", "hot_dog_stand", "meal_takeaway"].includes(t)) return "Lancheria";
    if (t === "restaurant" || t.endsWith("_restaurant")) return "Restaurante";
    if (["supermarket", "grocery_store", "convenience_store", "market", "food_store", "butcher_shop", "hypermarket", "discount_supermarket", "warehouse_store"].includes(t)) return "Mercado";
  }
  return null;
}

function tipoPeloOsm(categoria?: string, tipo?: string): TipoNegocio | null {
  if (categoria === "shop") {
    if (tipo === "bakery") return "Padaria";
    if (tipo === "pastry" || tipo === "confectionery") return "Confeitaria";
    if (["supermarket", "convenience", "greengrocer", "grocery", "deli", "butcher", "general", "food"].includes(tipo ?? "")) return "Mercado";
  }
  if (categoria === "amenity") {
    if (tipo === "restaurant") return "Restaurante";
    if (tipo === "fast_food") return "Lancheria";
  }
  return null;
}

// ---------- telefone e endereço ----------

/** "+55 51 3311-1055" → "(51) 3311-1055" */
export function formatarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = bruto.split(/[;,/]/)[0].replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return null;
}

const formatarCep = (c?: string | null) => {
  const d = (c ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null;
};

type Endereco = { endereco: string | null; bairro: string | null; cidade: string | null; cep: string | null };

const pareceEndereco = (s: string) =>
  /^(r\.|rua|av\.?|avenida|al\.|alameda|estr\.|estrada|tv\.|travessa|rod\.|rodovia|pç\.|praça|largo|beco)\s/i.test(s.trim()) || /\b\d{5}-?\d{3}\b/.test(s);

/** "R. Henrique Dias, 94 - Bom Fim, Porto Alegre - RS, 90035-100, Brasil" → partes */
export function lerEnderecoGoogle(texto: string): Endereco {
  let t = texto.replace(/,\s*(Brasil|Brazil)\s*$/i, "").trim();
  const cep = formatarCep(t.match(/\b\d{5}-?\d{3}\b/)?.[0]);
  t = t.replace(/,?\s*\b\d{5}-?\d{3}\b/, "").trim();
  const partes = t.split(/,\s*/).filter(Boolean);
  let cidade: string | null = null;
  const ultima = partes[partes.length - 1];
  if (partes.length > 1 && /\s-\s[A-Z]{2}$/.test(ultima)) {
    cidade = ultima.replace(/\s-\s[A-Z]{2}$/, "").trim();
    partes.pop();
  }
  let rua = partes[0] ?? "";
  let numero: string | null = null;
  let bairro: string | null = null;
  const resto = partes.slice(1).join(", ");
  if (resto) {
    const m = resto.match(/^(\d+[A-Za-z]?)(?:\s*-\s*(.+))?$/);
    if (m) {
      numero = m[1];
      bairro = m[2] ?? null;
    } else bairro = resto.replace(/^-\s*/, "") || null;
  }
  if (!numero && rua.includes(" - ")) [rua, bairro] = [rua.split(" - ")[0], rua.split(" - ").slice(1).join(" - ")];
  return { endereco: rua ? (numero ? `${rua}, ${numero}` : rua) : null, bairro: bairro?.trim() || null, cidade, cep };
}

// ---------- link ----------

type DoLink = { nome: string | null; lat: number | null; lng: number | null; enderecoTexto: string | null };

/** Abre só os redirecionamentos do link curto, até chegar no endereço longo do Google */
async function expandir(inicio: URL): Promise<URL> {
  let atual = inicio;
  for (let i = 0; i < 6; i++) {
    if (atual.hostname === "consent.google.com") {
      const destino = atual.searchParams.get("continue");
      if (!destino) break;
      atual = new URL(destino);
      continue;
    }
    if (!ENCURTADORES.has(atual.hostname)) return atual;
    const r = await fetch(atual, { redirect: "manual", headers: { "User-Agent": AGENTE }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    const destino = r.headers.get("location");
    await r.body?.cancel().catch(() => {});
    if (r.status < 300 || r.status >= 400 || !destino) throw new Error("sem redirecionamento");
    atual = new URL(destino, atual);
    if (atual.protocol !== "https:" || !(ENCURTADORES.has(atual.hostname) || ehGoogle(atual.hostname) || atual.hostname === "consent.google.com")) {
      throw new Error("redirecionou pra fora do Google");
    }
  }
  return atual;
}

function decodificar(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s.replace(/\+/g, " ");
  }
}

function lerLink(u: URL): DoLink {
  const href = decodificar(u.href);
  let nome: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  const lugar = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (lugar) nome = decodificar(lugar[1]).trim();

  const exato = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const centro = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const par = exato ?? centro;
  if (par) [lat, lng] = [Number(par[1]), Number(par[2])];

  const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? u.searchParams.get("destination");
  if (q) {
    const coord = q.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    if (coord && lat === null) [lat, lng] = [Number(coord[1]), Number(coord[2])];
    // busca digitada costuma levar a cidade junto: "Padaria Barcelona Porto Alegre" → "Padaria Barcelona"
    else if (!coord && !nome) nome = q.trim().replace(/[\s,-]+(porto alegre|poa)([\s,-]+rs)?$/i, "").replace(/[\s,-]+rs$/i, "").trim();
  }

  let enderecoTexto: string | null = null;
  if (nome && /\d+°/.test(nome)) nome = null; // pino solto no mapa (coordenada em graus), não tem nome
  if (nome && pareceEndereco(nome)) [enderecoTexto, nome] = [nome, null];
  return { nome, lat, lng, enderecoTexto };
}

// ---------- Google Places (oficial, com chave) ----------

type LugarGoogle = {
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  types?: string[];
  primaryType?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
};

async function consultarPlaces(nome: string, lat: number | null, lng: number | null, quantos: number): Promise<{ erro: string } | { lugares: LugarGoogle[] }> {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) return { erro: "Sem a chave do Google." };
  const centro = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : { latitude: -30.0346, longitude: -51.2177 }; // centro de Porto Alegre
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.types,places.primaryType,places.location,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: nome,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: quantos,
        locationBias: { circle: { center: centro, radius: lat !== null ? 300 : 40000 } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error("Places API", r.status, (await r.text()).slice(0, 300));
      return { erro: r.status === 429 ? "O Google pediu uma pausa. Espere um minuto e tente de novo." : `O Google recusou a busca (código ${r.status}). Confira a chave e se a Places API (New) está ativada.` };
    }
    const d = (await r.json()) as { places?: LugarGoogle[] };
    return { lugares: d.places ?? [] };
  } catch (e) {
    console.error("Places API", e);
    return { erro: "Não consegui falar com o Google agora." };
  }
}

async function buscarNoPlaces(nome: string, lat: number | null, lng: number | null): Promise<LugarGoogle | null> {
  const r = await consultarPlaces(nome, lat, lng, 1);
  const lugar = "lugares" in r ? r.lugares[0] : null;
  return lugar?.displayName && nomesParecidos(lugar.displayName.text, nome) ? lugar : null;
}

function enderecoDoPlaces(l: LugarGoogle): Endereco {
  const comp = (tipo: string) => l.addressComponents?.find((c) => c.types.includes(tipo));
  const rua = comp("route")?.longText;
  const numero = comp("street_number")?.longText;
  if (!rua) return l.formattedAddress ? lerEnderecoGoogle(l.formattedAddress) : { endereco: null, bairro: null, cidade: null, cep: null };
  return {
    endereco: numero ? `${rua}, ${numero}` : rua,
    bairro: (comp("sublocality_level_1") ?? comp("sublocality") ?? comp("neighborhood"))?.longText ?? null,
    cidade: (comp("administrative_area_level_2") ?? comp("locality"))?.longText ?? null,
    cep: formatarCep(comp("postal_code")?.longText),
  };
}

// ---------- OpenStreetMap (sem chave) ----------

type LugarOsm = {
  name?: string;
  category?: string;
  type?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
};

let ultimaConsultaOsm = 0;
async function nominatim(caminho: string): Promise<unknown> {
  // regra do Nominatim: no máximo 1 consulta por segundo
  const falta = ultimaConsultaOsm + 1100 - Date.now();
  if (falta > 0) await esperar(falta);
  ultimaConsultaOsm = Date.now();
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/${caminho}`, {
      headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function enderecoDoOsm(a?: Record<string, string>): Endereco {
  if (!a) return { endereco: null, bairro: null, cidade: null, cep: null };
  const rua = a.road ?? a.pedestrian ?? a.footway ?? null;
  return {
    endereco: rua ? (a.house_number ? `${rua}, ${a.house_number}` : rua) : null,
    bairro: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? null,
    cidade: a.city ?? a.town ?? a.municipality ?? a.village ?? null,
    cep: formatarCep(a.postcode),
  };
}

const telefoneOsm = (t?: Record<string, string> | null) =>
  formatarTelefone(t?.["contact:whatsapp"] ?? t?.["contact:mobile"] ?? t?.mobile ?? t?.phone ?? t?.["contact:phone"]);

/** Endereço pela posição; e, se tiver nome, o próprio estabelecimento no OSM (telefone e categoria) */
async function buscarNoOsm(nome: string | null, lat: number | null, lng: number | null) {
  let endereco: Endereco | null = null;
  let lugar: LugarOsm | null = null;
  const params = "format=jsonv2&addressdetails=1&extratags=1";
  if (lat !== null && lng !== null) {
    const r = (await nominatim(`reverse?${params}&zoom=18&lat=${lat}&lon=${lng}`)) as LugarOsm | null;
    if (r?.address) {
      endereco = enderecoDoOsm(r.address);
      if (nome && r.name && nomesParecidos(r.name, nome)) lugar = r;
    }
  }
  if (nome && !lugar) {
    // ~400 m em volta do ponto; sem ponto, Porto Alegre e região metropolitana
    const caixa = lat !== null && lng !== null ? [lng - 0.004, lat + 0.004, lng + 0.004, lat - 0.004] : [-51.6, -29.6, -50.8, -30.4];
    const r = (await nominatim(`search?${params}&limit=3&countrycodes=br&bounded=1&viewbox=${caixa.join(",")}&q=${encodeURIComponent(nome)}`)) as LugarOsm[] | null;
    lugar = r?.find((l) => l.name && nomesParecidos(l.name, nome)) ?? null;
  }
  return { endereco, lugar };
}

// ---------- junta tudo ----------

export async function buscarNegocio(texto: string): Promise<{ erro: string } | { dados: DadosNegocio }> {
  const url = texto.match(/https?:\/\/[^\s<>"']+/)?.[0];
  if (!url) return { erro: "Cole o link do Google Maps ou do perfil no Google (ex: https://maps.app.goo.gl/...)." };
  if (!linkPermitido(url)) return { erro: "Esse link não é do Google Maps. Abra o negócio no Google Maps, toque em Compartilhar e copie o link." };

  // texto que vem junto do link quando compartilha pelo celular: nome numa linha, endereço em outra
  const linhas = texto.replace(url, "\n").split(/\n+/).map((l) => l.trim()).filter((l) => l && l.length <= 160);
  const enderecoDoTexto = linhas.find(pareceEndereco) ?? null;
  const nomeDoTexto = linhas.find((l) => !pareceEndereco(l) && !/https?:/.test(l)) ?? null;

  let final: URL;
  try {
    final = await expandir(new URL(url));
  } catch {
    return { erro: "Não consegui abrir esse link. Confira se copiou ele inteiro, ou copie de novo pelo botão Compartilhar." };
  }
  const doLink = lerLink(final);
  const nomeBase = doLink.nome ?? nomeDoTexto;
  const fontes = ["link do Google"];

  const places = nomeBase ? await buscarNoPlaces(nomeBase, doLink.lat, doLink.lng) : null;
  if (places) fontes.push("Google (oficial)");
  const precisaOsm = !places || !places.nationalPhoneNumber;
  const osm = precisaOsm ? await buscarNoOsm(nomeBase, doLink.lat, doLink.lng) : { endereco: null, lugar: null };
  if (osm.endereco || osm.lugar) fontes.push("OpenStreetMap");

  const vazio: Endereco = { endereco: null, bairro: null, cidade: null, cep: null };
  const camadas: Endereco[] = [
    places ? enderecoDoPlaces(places) : vazio,
    doLink.enderecoTexto ? lerEnderecoGoogle(doLink.enderecoTexto) : vazio,
    enderecoDoTexto ? lerEnderecoGoogle(enderecoDoTexto) : vazio,
    osm.lugar?.address ? enderecoDoOsm(osm.lugar.address) : vazio,
    osm.endereco ?? vazio,
  ];
  // endereço com número ganha de endereço sem número
  const comNumero = camadas.find((c) => c.endereco && /\d/.test(c.endereco));
  const rua = comNumero ?? camadas.find((c) => c.endereco);
  const pegar = (k: keyof Endereco) => (rua?.[k] ? rua[k] : camadas.find((c) => c[k])?.[k] ?? null);

  const nome = places?.displayName?.text ?? nomeBase ?? osm.lugar?.name ?? null;
  const lat = places?.location?.latitude ?? doLink.lat ?? (osm.lugar?.lat ? Number(osm.lugar.lat) : null);
  const lng = places?.location?.longitude ?? doLink.lng ?? (osm.lugar?.lon ? Number(osm.lugar.lon) : null);
  const dados: DadosNegocio = {
    nome,
    tipoNegocio:
      tipoPeloNome(nome) ??
      (places ? tipoPeloGoogle([places.primaryType ?? "", ...(places.types ?? [])]) : null) ??
      tipoPeloOsm(osm.lugar?.category, osm.lugar?.type),
    whatsapp: formatarTelefone(places?.nationalPhoneNumber ?? places?.internationalPhoneNumber) ?? telefoneOsm(osm.lugar?.extratags),
    endereco: rua?.endereco ?? null,
    bairro: pegar("bairro"),
    cidade: pegar("cidade"),
    cep: pegar("cep"),
    lat,
    lng,
    link: url,
    fontes,
    faltou: [],
  };
  if (!dados.nome && !dados.endereco) {
    return { erro: "O link abriu, mas não trouxe nome nem endereço. Use o link do botão Compartilhar do Google Maps, ou preencha à mão." };
  }
  if (!dados.nome) dados.faltou.push("nome");
  if (!dados.endereco) dados.faltou.push("endereço");
  else if (!/\d/.test(dados.endereco)) dados.faltou.push("número do endereço");
  if (!dados.whatsapp) dados.faltou.push("telefone");
  if (!dados.tipoNegocio) dados.faltou.push("tipo de comércio");
  return { dados };
}

// ---------- busca pelo nome (completar cadastros) ----------

/** `parecido`: o nome bate com o do cliente (dá pra já deixar escolhido) */
export type OpcaoCadastro = DadosNegocio & { parecido: boolean };

const CIDADE_NA_BUSCA = /porto alegre|\bpoa\b|canoas|cachoeirinha|gravata|alvorada|viam|esteio|sapucaia|leopoldo|hamburgo|gua[ií]ba|eldorado/i;

/** Lugares com esse nome em Porto Alegre e região (até 3), pra escolher o certo */
export async function buscarPorNome(termo: string, nomeDoCliente: string): Promise<{ erro: string } | { opcoes: OpcaoCadastro[] }> {
  const nome = termo.trim().slice(0, 120);
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const r = await consultarPlaces(CIDADE_NA_BUSCA.test(nome) ? nome : `${nome} Porto Alegre`, null, null, 3);
    if ("erro" in r) return r;
    return {
      opcoes: r.lugares
        .filter((l) => l.displayName)
        .map((l) => ({
          ...enderecoDoPlaces(l),
          nome: l.displayName!.text,
          tipoNegocio: tipoPeloNome(l.displayName!.text) ?? tipoPeloGoogle([l.primaryType ?? "", ...(l.types ?? [])]),
          whatsapp: formatarTelefone(l.nationalPhoneNumber ?? l.internationalPhoneNumber),
          lat: l.location?.latitude ?? null,
          lng: l.location?.longitude ?? null,
          link: l.googleMapsUri ?? "",
          fontes: ["Google"],
          faltou: [],
          parecido: nomesParecidos(l.displayName!.text, nomeDoCliente),
        })),
    };
  }
  const semCidade = nome.replace(/[\s,-]+(porto alegre|poa)([\s,-]+rs)?$/i, "").trim();
  const achados = (await nominatim(`search?format=jsonv2&addressdetails=1&extratags=1&limit=3&countrycodes=br&bounded=1&viewbox=-51.6,-29.6,-50.8,-30.4&q=${encodeURIComponent(semCidade)}`)) as LugarOsm[] | null;
  if (!achados) return { erro: "Não consegui consultar o mapa agora. Tente de novo em instantes." };
  return {
    opcoes: achados
      .filter((l) => l.name && nomesParecidos(l.name, semCidade)) // sem isso o mapa aberto devolve rua e bairro com o nome
      .map((l) => ({
        ...enderecoDoOsm(l.address),
        nome: l.name!,
        tipoNegocio: tipoPeloNome(l.name!) ?? tipoPeloOsm(l.category, l.type),
        whatsapp: telefoneOsm(l.extratags),
        lat: l.lat ? Number(l.lat) : null,
        lng: l.lon ? Number(l.lon) : null,
        link: "",
        fontes: ["OpenStreetMap"],
        faltou: [],
        parecido: nomesParecidos(l.name!, nomeDoCliente),
      })),
  };
}
