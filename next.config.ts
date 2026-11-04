import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Celular no mesmo Wi-Fi (http://<IP do PC>:3001): em `next dev` o Next bloqueia o JavaScript pra
// outros endereços, e aí nenhum botão funciona. Libera os IPs da rede local deste PC (o IP muda).
const ipsDaRede = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: ipsDaRede,
  // Sistema interno atrás de login, com dados ao vivo: tudo renderiza por requisição.
  // Por isso Cache Components / Partial Prefetching ficam desligados.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
