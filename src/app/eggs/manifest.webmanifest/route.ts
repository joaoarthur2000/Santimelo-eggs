// Manifest do app EGGS (instalar na tela inicial do celular). Só vale dentro de /eggs
export function GET() {
  return Response.json(
    {
      name: "EGGS · by Santimelo",
      short_name: "EGGS",
      description: "Pedidos de ovos da Santimelo",
      start_url: "/eggs",
      scope: "/eggs",
      display: "standalone",
      background_color: "#FFF9EC",
      theme_color: "#F5A800",
      lang: "pt-BR",
      icons: [
        { src: "/eggs/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/eggs/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "/eggs/icone.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
