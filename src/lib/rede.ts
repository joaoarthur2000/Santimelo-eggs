import "server-only";
import { hostname, networkInterfaces } from "node:os";

/** Endereço do sistema no celular. Na nuvem vem de APP_URL; no PC é o IP do computador no Wi-Fi (mesma rede) */
function base() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  const ip = ips.find((a) => a.startsWith("192.168.")) ?? ips.find((a) => a.startsWith("10.")) ?? ips[0] ?? "localhost";
  return `http://${ip}:${process.env.PORT ?? 3001}`;
}

/** App dos clientes */
export const linkDoApp = () => `${base()}/eggs`;

/**
 * Painel da equipe no celular. No PC usa o nome dele na rede (nome.local), que não muda quando o IP muda:
 * o ícone da tela inicial guarda o endereço, e com IP ele pararia de abrir.
 */
export const linkDoPainel = () =>
  `${(process.env.PAINEL_URL || process.env.APP_URL)?.replace(/\/$/, "") || `http://${hostname().toLowerCase()}.local:${process.env.PORT ?? 3001}`}/painel`;

/** Reserva, se o celular não achar o PC pelo nome */
export const linkDoPainelPeloIp = () => `${base()}/painel`;
