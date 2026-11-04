import Link from "next/link";
import { UserRound } from "lucide-react";
import { CONFIG, lerConfig, versaoDoApp } from "@/lib/config";
import { db } from "@/lib/db";
import { gerarAvisosDePagamento } from "@/lib/eggs";
import { exigirCliente } from "@/lib/sessao";
import { BotaoInstalar } from "../dica-instalar";
import { IconeEggs, MarcaEggs } from "../marca-eggs";
import { AvisoAtualizacao } from "./aviso-atualizacao";
import { Avisador } from "./avisador";
import { BotaoAjuda } from "./botao-ajuda";
import { NavEggs } from "./nav-eggs";

export default async function LayoutAppEggs({ children }: LayoutProps<"/eggs">) {
  const { cliente } = await exigirCliente();
  // Manutenção ligada no painel: ninguém pede, só vê o aviso
  if ((await lerConfig(CONFIG.MANUTENCAO)) === "1") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <IconeEggs className="eggs-balanca size-20" />
        <h1 className="mt-5 font-eggs text-4xl font-extrabold">Já voltamos!</h1>
        <p className="mt-2 max-w-xs text-casca-700">{(await lerConfig(CONFIG.MANUTENCAO_TEXTO)) || "O EGGS está em manutenção rapidinho. Tente de novo em alguns minutos."}</p>
      </main>
    );
  }
  // Aviso de pagamento (faltando até 3 dias) é criado quando o cliente abre o app
  await gerarAvisosDePagamento(cliente);
  const naoLidas = await db.mensagem.count({ where: { clienteId: cliente.id, lidaEm: null } });

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-casca-100 bg-gema-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link href="/eggs" aria-label="Início" className="mr-auto shrink-0">
            <MarcaEggs />
          </Link>
          <BotaoInstalar automatico />
          <Link href="/eggs/conta" aria-label={`Minha conta · ${cliente.nomeFantasia}`} className="relative flex shrink-0 items-center gap-2 rounded-full bg-white p-1.5 text-sm sm:pr-3 font-medium shadow-sm ring-1 ring-casca-100">
            <span className="flex size-7 items-center justify-center rounded-full bg-gema-100">
              <UserRound className="size-4 text-casca-700" />
            </span>
            <span className="hidden max-w-40 truncate sm:inline">{cliente.nomeFantasia}</span>
            {naoLidas > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white" aria-label={`${naoLidas} mensagens novas`}>
                {naoLidas}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5">{children}</main>
      <BotaoAjuda />
      <Avisador />
      <NavEggs />
      <AvisoAtualizacao versao={versaoDoApp().id} />
    </>
  );
}
