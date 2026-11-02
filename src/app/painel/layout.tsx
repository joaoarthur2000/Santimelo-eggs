import { Marca } from "@/components/marca";
import { exigirPapel } from "@/lib/sessao";
import { sair } from "../login/actions";
import { NavPainel } from "./nav-painel";

export default async function LayoutPainel({ children }: LayoutProps<"/painel">) {
  const usuario = await exigirPapel("DIRETOR");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col bg-marca-900 print:hidden text-white lg:sticky lg:top-0 lg:h-screen lg:w-60">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Marca claro />
          <form action={sair} className="lg:hidden">
            <button className="text-sm text-marca-200 hover:text-white">Sair</button>
          </form>
        </div>
        <NavPainel />
        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="text-sm font-medium">{usuario.nome}</p>
          <form action={sair}>
            <button className="text-xs text-marca-200 hover:text-white">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">{children}</main>
    </div>
  );
}
