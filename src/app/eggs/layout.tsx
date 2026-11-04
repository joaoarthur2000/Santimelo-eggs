import type { Metadata, Viewport } from "next";

// App EGGS: exclusivo dos clientes da Santimelo. Instala no celular como app (manifest abaixo)
export const metadata: Metadata = {
  title: { default: "EGGS", template: "%s · EGGS" },
  description: "Pedidos de ovos da Santimelo",
  manifest: "/eggs/manifest.webmanifest",
  icons: { icon: "/eggs/icone.svg?v=2", apple: "/eggs/apple-touch-icon.png?v=2" },
  appleWebApp: { capable: true, title: "EGGS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFBD52",
};

export default function LayoutEggs({ children }: LayoutProps<"/eggs">) {
  return <div className={`flex min-h-screen flex-1 flex-col bg-gema-50 text-casca-900`}>{children}</div>;
}
