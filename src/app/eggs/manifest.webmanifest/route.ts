// Manifest do app EGGS (instalar na tela inicial do celular). Só vale dentro de /eggs.
// Ícone = símbolo da Santimelo; ao trocar a arte, subir o ?v= pra o celular não usar o ícone guardado
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
      theme_color: "#FFBD52",
      lang: "pt-BR",
      icons: [
        { src: "/eggs/icone-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/eggs/icone-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "/eggs/icone.svg?v=2", sizes: "any", type: "image/svg+xml" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
