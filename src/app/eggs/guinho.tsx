// Guinho, o mascote do EGGS: cartoon retrô (anos 30), nas cores da Santimelo.
// PNGs das poses em public/eggs/guinho/; SVGs e o gerador em clientes/Santimelo/Logo/eggs/guinho/.
// Na aba Início ele é animado: (app)/guinho-animado.tsx.

export const POSES_GUINHO = ["acenando", "joinha", "paz", "comemorando"] as const;
export type PoseGuinho = (typeof POSES_GUINHO)[number];

export function Guinho({ pose = "acenando", className = "size-24" }: { pose?: PoseGuinho; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/eggs/guinho/guinho-${pose}.png`} alt="" aria-hidden className={`pointer-events-none select-none object-contain ${className}`} />
  );
}

/** Título de aba com o Guinho do lado, gingando */
export function TituloEggs({ children, pose }: { children: React.ReactNode; pose: PoseGuinho }) {
  return (
    <div className="eggs-entra flex items-end justify-between gap-3">
      <h1 className="font-eggs text-4xl font-extrabold tracking-tight">{children}</h1>
      <Guinho pose={pose} className="eggs-ginga -mb-2 -mt-6 h-24 w-22 shrink-0" />
    </div>
  );
}
