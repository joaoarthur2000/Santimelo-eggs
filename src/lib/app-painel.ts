import type { Metadata, Viewport } from "next";
import telas from "./telas-iphone.json";

// Painel como app na tela inicial do celular: ícone próprio, tela cheia e abertura na cor do topo.
// Vale no painel e no login (quem instala pela tela de login também cai no painel).

/** Subir ao trocar a arte (scripts/gerar-icone-painel.mjs): senão o celular mostra o ícone guardado */
export const VERSAO_ICONE = 1;
export const COR_TOPO = "#2b1c15";

export const metadadosDoPainel: Metadata = {
  manifest: "/app-painel/manifest.webmanifest",
  icons: { icon: `/app-painel/icone.svg?v=${VERSAO_ICONE}`, apple: `/app-painel/apple-touch-icon.png?v=${VERSAO_ICONE}` },
  appleWebApp: {
    capable: true,
    title: "Santimelo",
    statusBarStyle: "black-translucent", // o topo escuro do painel vai até atrás do relógio
    startupImage: telas.map(([w, h, d]) => ({
      url: `/app-painel/abertura-${w}x${h}-${d}x.png?v=${VERSAO_ICONE}`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
    })),
  },
  // o Next só escreve "mobile-web-app-capable"; a tela de abertura e o topo do iPhone pedem o nome da Apple
  other: { "apple-mobile-web-app-capable": "yes" },
  // número de pedido e valor não viram link azul de telefone
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

export const viewportDoPainel: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: COR_TOPO,
};
