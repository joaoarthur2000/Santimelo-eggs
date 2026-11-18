/** Cada troca de tela remonta este invólucro: o conteúdo entra suave (CSS .painel-entra) e fica com largura confortável em telas grandes */
export default function TemplatePainel({ children }: { children: React.ReactNode }) {
  return <div className="painel-entra mx-auto w-full max-w-[1440px]">{children}</div>;
}
