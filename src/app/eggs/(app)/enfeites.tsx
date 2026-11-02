// Enfeites do EGGS (inspirados em embalagem de mercado): ovo desenhado, selo de preço e faixa correndo

const CASCA: Record<string, { cor: string; pintas?: boolean }> = {
  branco: { cor: "#FFFDF7" },
  vermelho: { cor: "#D08A5C" },
  caipira: { cor: "#B9773F", pintas: true },
  solto: { cor: "#FFF3D6" },
};

/** Tipo do ovo pelo nome do item ("Ovo branco" → branco) */
export function tipoDoOvo(item: string) {
  const n = item.toLowerCase();
  return n.includes("caipira") ? "caipira" : n.includes("vermelho") ? "vermelho" : n.includes("solto") ? "solto" : "branco";
}

export function Ovo({ tipo, className = "size-14" }: { tipo: string; className?: string }) {
  const c = CASCA[tipo] ?? CASCA.branco;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <ellipse cx="32" cy="58" rx="16" ry="3.5" fill="#3d2614" opacity=".1" />
      <path d="M32 6C44 6 52 26 52 38C52 50 43 57 32 57C21 57 12 50 12 38C12 26 20 6 32 6Z" fill={c.cor} stroke="#3d2614" strokeOpacity=".18" strokeWidth="1.5" />
      <ellipse cx="25" cy="22" rx="3.5" ry="7" transform="rotate(22 25 22)" fill="#fff" opacity=".7" />
      {c.pintas && (
        <g fill="#7a4a22" opacity=".45">
          <circle cx="38" cy="30" r="1.4" />
          <circle cx="30" cy="42" r="1.1" />
          <circle cx="41" cy="44" r="1.6" />
          <circle cx="24" cy="36" r="1" />
        </g>
      )}
      {tipo === "solto" && <path d="M18 40l5-3 4 4 5-4 4 4 5-4 5 3" fill="none" stroke="#3d2614" strokeOpacity=".35" strokeWidth="1.5" strokeLinejoin="round" />}
    </svg>
  );
}

/** Preço num selo estourado de oferta, levemente torto */
export function SeloPreco({ valor, unidade, tamanho = "md" }: { valor: number; unidade?: string; tamanho?: "md" | "lg" }) {
  const [inteiro, centavos] = valor.toFixed(2).split(".");
  return (
    <span className={`selo-preco inline-flex shrink-0 rotate-[-8deg] flex-col items-center justify-center bg-tomate-500 text-white ${tamanho === "lg" ? "size-32" : "size-24"}`}>
      <span className="text-[10px] font-bold leading-none">R$</span>
      <span className={`font-eggs font-extrabold leading-none tracking-tight ${tamanho === "lg" ? "text-3xl" : "text-xl"}`}>
        {Number(inteiro).toLocaleString("pt-BR")}
        <span className="align-top text-[0.55em]">,{centavos}</span>
      </span>
      {unidade && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{unidade}</span>}
    </span>
  );
}

/**
 * Faixa correndo (fita de mercado): fita marrom na frente e fita amarela atrás, cruzadas e indo em
 * sentidos opostos. Duas cópias do texto em cada uma pra emendar sem pulo. Corre sempre, mesmo com
 * "reduzir movimento" ligado: é a identidade do app e o movimento é lento e contínuo.
 */
export function Faixa({ frases }: { frases: string[] }) {
  const linha = (cor: string) => (
    <span className="flex shrink-0 items-center">
      {[...frases, ...frases, ...frases].map((f, i) => (
        <span key={i} className="flex items-center">
          <span className="px-3">{f}</span>
          <span className={cor}>✦</span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="relative -mx-4 h-24 overflow-hidden" aria-hidden>
      <div className="absolute inset-x-[-10%] top-1/2 -translate-y-1/2 rotate-[5deg] bg-gema-400 py-1.5 text-casca-900">
        <div className="eggs-faixa-volta flex w-max whitespace-nowrap font-eggs text-xs font-extrabold uppercase tracking-widest">
          {linha("text-tomate-500")}
          {linha("text-tomate-500")}
        </div>
      </div>
      <div className="absolute inset-x-[-10%] top-1/2 -translate-y-1/2 -rotate-[3deg] bg-casca-900 py-2.5 text-gema-200 shadow-[0_6px_0_rgb(61_38_20/0.15)]">
        <div className="eggs-faixa flex w-max whitespace-nowrap font-eggs text-sm font-extrabold uppercase tracking-widest">
          {linha("text-gema-400")}
          {linha("text-gema-400")}
        </div>
      </div>
    </div>
  );
}

export function Brilho({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`eggs-brilho pointer-events-none absolute select-none text-gema-400 ${className}`}>
      ✦
    </span>
  );
}
