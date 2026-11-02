import "server-only";
import { networkInterfaces } from "node:os";

/**
 * Endereço do app EGGS pra abrir no celular. Na nuvem vem de APP_URL; rodando no PC,
 * é o IP do computador na rede Wi-Fi (o celular precisa estar na mesma rede).
 */
export function linkDoApp() {
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, "")}/eggs`;
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  const ip = ips.find((a) => a.startsWith("192.168.")) ?? ips.find((a) => a.startsWith("10.")) ?? ips[0] ?? "localhost";
  return `http://${ip}:${process.env.PORT ?? 3001}/eggs`;
}
