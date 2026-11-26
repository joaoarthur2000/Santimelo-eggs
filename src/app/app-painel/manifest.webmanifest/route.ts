import { COR_TOPO, VERSAO_ICONE } from "@/lib/app-painel";

// Manifest do painel na tela inicial. O escopo é o site todo: o login fica em /login, e com escopo /painel
// o iPhone abriria o login com a barra do Safari por cima.
export function GET() {
  return Response.json(
    {
      id: "/painel",
      name: "Santimelo · Gestão",
      short_name: "Santimelo",
      description: "Pedidos, entregas e caixa da Santimelo",
      start_url: "/painel",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: COR_TOPO,
      theme_color: COR_TOPO,
      lang: "pt-BR",
      icons: [
        { src: `/app-painel/icone-192.png?v=${VERSAO_ICONE}`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: `/app-painel/icone-512.png?v=${VERSAO_ICONE}`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
