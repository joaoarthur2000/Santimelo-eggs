// Guinho, o mascote do EGGS: imagens estáticas (PNG) em public/eggs/guinho/.
// O 3D (só na aba Início) fica em (app)/guinho-3d.tsx.

export type PoseGuinho = "acenando" | "joinha" | "paz" | "comemorando";

export function Guinho({ pose = "acenando", className = "size-24" }: { pose?: PoseGuinho; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/eggs/guinho/guinho-${pose}.png`} alt="" aria-hidden className={`pointer-events-none select-none object-contain ${className}`} />
  );
}

/** Título de aba com o Guinho do lado, balançando de leve */
export function TituloEggs({ children, pose }: { children: React.ReactNode; pose: PoseGuinho }) {
  return (
    <div className="eggs-entra flex items-end justify-between gap-3">
      <h1 className="font-eggs text-4xl font-extrabold tracking-tight">{children}</h1>
      <Guinho pose={pose} className="eggs-balanca -mb-2 -mt-6 h-24 w-22 shrink-0" />
    </div>
  );
}
