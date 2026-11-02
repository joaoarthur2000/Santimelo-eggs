import "server-only";
import { gravarConfig } from "./config";

/**
 * Mensagem automática no grupo de WhatsApp da equipe (EGGS-ADM).
 *
 * O WhatsApp não deixa um site mandar mensagem em grupo sozinho: precisa de um número "robô"
 * conectado num provedor de API (Z-API ou Evolution API), e esse número entra no grupo.
 * Sem as variáveis no .env nada é enviado, e o pedido aparece no painel do mesmo jeito.
 *
 *   WHATSAPP_PROVEDOR = zapi | evolution
 *   WHATSAPP_GRUPO    = id do grupo (Z-API: 1203...-group · Evolution: 1203...@g.us)
 *   Z-API:     WHATSAPP_INSTANCIA, WHATSAPP_TOKEN, WHATSAPP_CLIENT_TOKEN (token de segurança da conta)
 *   Evolution: WHATSAPP_URL (ex: https://evo.seudominio.com), WHATSAPP_INSTANCIA, WHATSAPP_TOKEN (apikey)
 */

export const ULTIMO_ENVIO = "whatsapp.ultimoEnvio";

function configuracao(): { provedor: string; url: string; cabecalhos: Record<string, string>; corpo: (texto: string) => object } | null {
  const e = process.env;
  const provedor = e.WHATSAPP_PROVEDOR?.toLowerCase();
  if (!e.WHATSAPP_GRUPO || !e.WHATSAPP_INSTANCIA || !e.WHATSAPP_TOKEN) return null;
  if (provedor === "zapi") {
    return {
      provedor,
      url: `https://api.z-api.io/instances/${e.WHATSAPP_INSTANCIA}/token/${e.WHATSAPP_TOKEN}/send-text`,
      cabecalhos: e.WHATSAPP_CLIENT_TOKEN ? { "Client-Token": e.WHATSAPP_CLIENT_TOKEN } : {},
      corpo: (texto: string) => ({ phone: e.WHATSAPP_GRUPO, message: texto }),
    };
  }
  if (provedor === "evolution" && e.WHATSAPP_URL) {
    return {
      provedor,
      url: `${e.WHATSAPP_URL.replace(/\/$/, "")}/message/sendText/${e.WHATSAPP_INSTANCIA}`,
      cabecalhos: { apikey: e.WHATSAPP_TOKEN },
      corpo: (texto: string) => ({ number: e.WHATSAPP_GRUPO, text: texto }),
    };
  }
  return null;
}

export function whatsappConectado() {
  const c = configuracao();
  return c ? c.provedor : null;
}

/** Manda o texto pro grupo. Nunca lança erro: o pedido do cliente não pode falhar por causa do WhatsApp */
export async function enviarProGrupo(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const c = configuracao();
  if (!c) return { ok: false, erro: "WhatsApp não configurado" };
  let resultado: { ok: boolean; erro?: string };
  try {
    const r = await fetch(c.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...c.cabecalhos },
      body: JSON.stringify(c.corpo(texto)),
      signal: AbortSignal.timeout(10_000),
    });
    resultado = r.ok ? { ok: true } : { ok: false, erro: `${r.status} ${(await r.text()).slice(0, 160)}` };
  } catch (e) {
    resultado = { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
  // Painel → Ovos → Aplicativo mostra se o último envio deu certo
  await gravarConfig(ULTIMO_ENVIO, JSON.stringify({ em: new Date().toISOString(), ...resultado })).catch(() => {});
  if (!resultado.ok) console.error("[whatsapp] falhou:", resultado.erro);
  return resultado;
}
