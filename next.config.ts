import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
