// Logo do app EGGS: símbolo da Santimelo (o mesmo ícone da tela do celular, public/eggs/icone.svg) + nome
export function IconeEggs({ className = "size-9" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/eggs/icone.svg?v=2" alt="" aria-hidden className={className} />;
}

export function MarcaEggs({ grande = false }: { grande?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <IconeEggs className={grande ? "size-16" : "size-10"} />
      <span className="flex flex-col leading-none">
        <span className={`font-eggs font-extrabold tracking-tight text-casca-900 ${grande ? "text-5xl" : "text-2xl"}`}>EGGS</span>
        <span className={`font-bold uppercase tracking-[0.2em] text-gema-700 ${grande ? "mt-1 text-xs" : "text-[9px]"}`}>by Santimelo</span>
      </span>
    </span>
  );
}
