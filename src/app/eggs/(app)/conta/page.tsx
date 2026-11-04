import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Handshake, LifeBuoy, LogOut, MessageCircle, Receipt } from "lucide-react";
import { diaISO, formatarDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { extratoDoCliente } from "@/lib/financeiro";
import { nomeProduto, reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { sairEggs } from "../../../login/actions";
import { DicaInstalar } from "../../dica-instalar";
import { marcarMensagensLidas } from "../actions";
import { TituloEggs } from "../../guinho";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaEggs() {
  const { cliente, usuario } = await exigirCliente();
  const [{ emAberto: totalAberto }, especiais, mensagens] = await Promise.all([
    extratoDoCliente(cliente.id),
    db.precoCliente.findMany({ where: { clienteId: cliente.id }, include: { produto: { include: { item: true } } } }),
    db.mensagem.findMany({ where: { clienteId: cliente.id }, orderBy: { criadaEm: "desc" }, take: 30 }),
  ]);
  const naoLidas = mensagens.filter((m) => !m.lidaEm).length;

  return (
    <div className="space-y-5">
      <section>
        <TituloEggs pose="acenando">{cliente.nomeFantasia}</TituloEggs>
        <p className="text-sm text-casca-700">
          {usuario.nome}
          {cliente.regiao && ` · região ${cliente.regiao.nome}`}
        </p>
      </section>

      <section className="cartao-eggs">
        <h2 className="titulo-eggs flex items-center gap-1.5"><Handshake className="size-4" /> Nossa negociação</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-casca-500">Prazo de pagamento</dt>
            <dd className="font-bold">{cliente.prazoPagamentoDias ? `${cliente.prazoPagamentoDias} dias após a entrega` : "Na entrega"}</dd>
          </div>
          <div>
            <dt className="text-casca-500">Forma de pagamento</dt>
            <dd className="font-bold">{cliente.formaPagamento ?? "A combinar"}</dd>
          </div>
        </dl>
        {especiais.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-casca-100 pt-3 text-sm">
            {especiais.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{nomeProduto(e.produto)}</span>
                <span className="tabular font-bold">{reais(e.preco)}</span>
              </li>
            ))}
          </ul>
        )}
        {cliente.negociacao && <p className="mt-3 whitespace-pre-line rounded-2xl bg-gema-50 p-3 text-sm">{cliente.negociacao}</p>}
      </section>

      <Link href="/eggs/financeiro" className="eggs-toque cartao-eggs flex items-center justify-between gap-3">
        <span>
          <span className="titulo-eggs flex items-center gap-1.5"><Receipt className="size-4" /> Financeiro</span>
          <span className="mt-1 block text-sm text-casca-700">Pedidos, pagamentos, vencimentos e o que está em aberto</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-right">
          <span className="tabular font-bold">{reais(totalAberto)}</span>
          <ChevronRight className="size-4 text-casca-500" />
        </span>
      </Link>

      <Link href="/eggs/ajuda" className="eggs-toque cartao-eggs flex items-center justify-between gap-3">
        <span>
          <span className="titulo-eggs flex items-center gap-1.5"><LifeBuoy className="size-4" /> Ajuda</span>
          <span className="mt-1 block text-sm text-casca-700">Pedido, entrega, pagamento, vendas ou problema no app: fala com o Guinho</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-casca-500" />
      </Link>

      <section className="cartao-eggs">
        <div className="flex items-baseline justify-between">
          <h2 className="titulo-eggs flex items-center gap-1.5"><MessageCircle className="size-4" /> Mensagens</h2>
          {naoLidas > 0 && (
            <form action={marcarMensagensLidas}>
              <button className="text-sm font-semibold text-casca-700 hover:underline">Marcar {naoLidas} como lidas</button>
            </form>
          )}
        </div>
        <ul className="mt-3 space-y-3 text-sm">
          {mensagens.map((m) => (
            <li key={m.id} className={m.lidaEm ? "" : "rounded-2xl bg-gema-100 p-3"}>
              <p>{m.texto}</p>
              <p className="mt-0.5 text-xs text-casca-500">{formatarDia(diaISO(m.criadaEm), { day: "2-digit", month: "2-digit" })} · {m.autor}</p>
            </li>
          ))}
          {mensagens.length === 0 && <li className="text-casca-700">Nenhuma mensagem.</li>}
        </ul>
      </section>

      <div className="flex justify-center">
        <DicaInstalar />
      </div>

      <form action={sairEggs}>
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-casca-700 hover:bg-casca-100">
          <LogOut className="size-4" /> Sair
        </button>
      </form>
    </div>
  );
}
