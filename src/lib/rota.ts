import "server-only";
import { CONFIG, gravarConfig, lerConfig } from "./config";
import { fimDoDia, formatarHora, inicioDoDia } from "./datas";
import { db } from "./db";
import { quantidade } from "./formato";

// Rota de entregas do dia, com km e combustível.
// Endereço → posição: Nominatim (OpenStreetMap, grátis, 1 consulta por segundo).
// Ordem e km: OSRM (OpenStreetMap). Respeita os horários: entrega das 7h vem antes da das 9h,
// e dentro de cada horário a ordem é a mais curta. Serviços públicos de teste: na nuvem, trocar por um com chave.

const AGENTE = "EGGS-Santimelo/1.0 (sistema de entregas)";
const OSRM = "https://router.project-osrm.org";

// Fiorino 2021 1.4 Hardworking 8v (flex): ~10 km/l na gasolina rodando em cidade carregada. Ajustável no painel.
export const CONSUMO_PADRAO = 10;
export const PRECO_LITRO_PADRAO = 6.4;

type Ponto = { lat: number; lng: number };
export type Saida = Ponto & { endereco: string };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Endereço → posição. Tenta completo, depois sem bairro, depois só a rua */
export async function localizar(endereco: string, bairro?: string | null, cidade?: string | null): Promise<Ponto | null> {
  const semComplemento = endereco.split(" - ")[0].trim();
  const rua = semComplemento.replace(/,\s*\d+.*$/, "");
  const cid = cidade || "Porto Alegre";
  const tentativas = [
    [semComplemento, bairro, cid, "RS", "Brasil"],
    [semComplemento, cid, "RS", "Brasil"],
    [rua, bairro, cid, "RS", "Brasil"],
  ].map((partes) => partes.filter(Boolean).join(", "));
  for (const [i, q] of tentativas.entries()) {
    if (i) await esperar(1100);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR" },
        cache: "no-store",
      });
      const d = (await r.json()) as { lat: string; lon: string }[];
      if (d[0]) return { lat: Number(d[0].lat), lng: Number(d[0].lon) };
    } catch {}
  }
  return null;
}

export async function configRota() {
  const [saida, consumo, preco] = await Promise.all([lerConfig(CONFIG.ROTA_SAIDA), lerConfig(CONFIG.ROTA_CONSUMO), lerConfig(CONFIG.ROTA_PRECO)]);
  return {
    saida: saida ? (JSON.parse(saida) as Saida) : null,
    consumo: Number(consumo) || CONSUMO_PADRAO,
    precoLitro: Number(preco) || PRECO_LITRO_PADRAO,
  };
}

export async function gravarSaida(saida: Saida) {
  await gravarConfig(CONFIG.ROTA_SAIDA, JSON.stringify(saida));
}

/** Paradas do dia: um ponto por cliente (junta os pedidos dele), com caixas e horário */
export async function paradasDoDia(dia: string) {
  const pedidos = await db.pedido.findMany({
    where: { dataEntrega: { gte: inicioDoDia(dia), lt: fimDoDia(dia) }, status: { not: "CANCELADO" } },
    include: { cliente: true, janela: true, itens: { include: { produto: { include: { item: true } } } } },
    orderBy: { dataEntrega: "asc" },
  });
  const porCliente = new Map<string, {
    clienteId: string; nome: string; endereco: string; bairro: string | null; cidade: string | null; lat: number | null; lng: number | null;
    whatsapp: string | null; horario: string; caixas: number; itens: string[]; pedidos: number[]; status: string[]; total: number;
  }>();
  for (const p of pedidos) {
    const c = p.cliente;
    const parada = porCliente.get(c.id) ?? {
      clienteId: c.id, nome: c.nomeFantasia, endereco: c.endereco ?? "", bairro: c.bairro, cidade: c.cidade, lat: c.lat, lng: c.lng,
      whatsapp: c.whatsapp, horario: p.janela ? `${p.janela.inicio}–${p.janela.fim}` : formatarHora(p.dataEntrega),
      caixas: 0, itens: [], pedidos: [], status: [], total: 0,
    };
    for (const i of p.itens) {
      parada.caixas += i.quantidade * (i.produto.fatorEstoque ?? 0);
      parada.itens.push(`${quantidade(i.quantidade, i.produto.unidade)} ${i.produto.item.nome.replace(/^Ovo /, "")}`);
    }
    parada.pedidos.push(p.id);
    parada.status.push(p.status);
    parada.total += p.total;
    porCliente.set(c.id, parada);
  }
  return [...porCliente.values()].sort((a, b) => a.horario.localeCompare(b.horario));
}
export type Parada = Awaited<ReturnType<typeof paradasDoDia>>[number];

type Trecho = { distance: number; duration: number };

async function trip(pontos: Ponto[]) {
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(";");
  const r = await fetch(`${OSRM}/trip/v1/driving/${coords}?source=first&roundtrip=true&overview=false`, { headers: { "User-Agent": AGENTE }, cache: "no-store" });
  const d = (await r.json()) as { code: string; trips: (Trecho & { legs: Trecho[] })[]; waypoints: { waypoint_index: number }[] };
  if (d.code !== "Ok") throw new Error("rota");
  return d;
}

async function trecho(a: Ponto, b: Ponto): Promise<Trecho> {
  const r = await fetch(`${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { headers: { "User-Agent": AGENTE }, cache: "no-store" });
  const d = (await r.json()) as { code: string; routes: Trecho[] };
  if (d.code !== "Ok") throw new Error("rota");
  return d.routes[0];
}

/**
 * Gera e salva a rota do dia. Localiza quem ainda não tem posição (e guarda no cadastro).
 * Volta { erro } se não der pra calcular, ou a lista de quem não foi localizado.
 */
export async function gerarRotaDoDia(dia: string) {
  const { saida, consumo, precoLitro } = await configRota();
  const paradas = await paradasDoDia(dia);
  if (!paradas.length) return { erro: "Nenhuma entrega nesse dia." };

  const naoAchou: string[] = [];
  for (const p of paradas) {
    if (p.lat !== null && p.lng !== null) continue;
    const pos = await localizar(p.endereco, p.bairro, p.cidade);
    await esperar(1100);
    if (!pos) {
      naoAchou.push(p.nome);
      continue;
    }
    Object.assign(p, pos);
    await db.cliente.update({ where: { id: p.clienteId }, data: pos });
  }
  const comPosicao = paradas.filter((p) => p.lat !== null && p.lng !== null) as (Parada & Ponto)[];
  if (!comPosicao.length) return { erro: "Não achei nenhum endereço no mapa. Confira os endereços na ficha dos clientes.", naoAchou };

  // Blocos por horário (7h antes das 9h); dentro do bloco, a ordem mais curta a partir de onde o carro está
  const blocos = new Map<string, (Parada & Ponto)[]>();
  for (const p of comPosicao) blocos.set(p.horario, [...(blocos.get(p.horario) ?? []), p]);

  try {
    let atual: Ponto | null = saida;
    let metros = 0;
    let segundos = 0;
    const ordem: string[] = [];
    for (const [, grupo] of [...blocos.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const inicio: Ponto = atual ?? grupo[0];
      const resto = atual ? grupo : grupo.slice(1);
      if (!atual) ordem.push(grupo[0].clienteId);
      if (resto.length) {
        const d = await trip([inicio, ...resto]);
        const t = d.trips[0];
        // Tira a volta pro começo (o trip fecha o circuito): o carro segue pro próximo horário
        metros += t.distance - t.legs[t.legs.length - 1].distance;
        segundos += t.duration - t.legs[t.legs.length - 1].duration;
        const ordenados = resto.map((p, i) => ({ p, pos: d.waypoints[i + 1].waypoint_index })).sort((a, b) => a.pos - b.pos).map((x) => x.p);
        ordem.push(...ordenados.map((p) => p.clienteId));
        atual = ordenados[ordenados.length - 1];
      } else atual = grupo[0];
    }
    // Volta pra base
    if (saida && atual) {
      const volta = await trecho(atual, saida);
      metros += volta.distance;
      segundos += volta.duration;
    }
    const dados = { ordem: ordem.join(","), kmPlanejado: Math.round(metros / 100) / 10, minutos: Math.round(segundos / 60), consumoKmL: consumo, precoLitro };
    await db.rotaDia.upsert({ where: { dia }, update: dados, create: { dia, ...dados } });
    return { ok: true, naoAchou };
  } catch {
    return { erro: "O serviço de mapas não respondeu. Tenta de novo em alguns segundos.", naoAchou };
  }
}

/** Km, litros e gasto do dia: km real (hodômetro) se anotado, senão o da rota calculada */
export function custoDaRota(r: { kmPlanejado: number; kmReal: number | null; consumoKmL: number; precoLitro: number }) {
  const km = r.kmReal ?? r.kmPlanejado;
  const litros = km / r.consumoKmL;
  return { km, litros, custo: litros * r.precoLitro, real: r.kmReal !== null };
}

/** Link do Google Maps com as paradas na ordem (abre a navegação no celular do motorista) */
export function linkGoogleMaps(saida: Ponto | null, paradas: Ponto[]) {
  if (!paradas.length) return null;
  const p = (x: Ponto) => `${x.lat},${x.lng}`;
  const origem = saida ?? paradas[0];
  const meio = saida ? paradas : paradas.slice(1);
  const destino = saida ?? meio.pop() ?? paradas[0];
  const params = new URLSearchParams({ api: "1", origin: p(origem), destination: p(destino), travelmode: "driving" });
  if (meio.length) params.set("waypoints", meio.map(p).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

