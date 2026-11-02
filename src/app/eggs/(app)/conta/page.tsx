import type { Metadata } from "next";
import { Handshake, LogOut, MessageCircle, Receipt } from "lucide-react";
import { diaISO, formatarDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { nomeProduto, reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { sairEggs } from "../../../login/actions";
import { DicaInstalar } from "../../dica-instalar";
import { marcarMensagensLidas } from "../actions";
import { TituloEggs } from "../../guinho";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaEggs() {
  const { cliente, usuario } = await exigirCliente();
  const hoje = diaISO();
  const [abertas, pagas, especiais, mensagens] = await Promise.all([
    db.cobranca.findMany({ where: { clienteId: cliente.id, pagoEm: null }, include: { pedido: true }, orderBy: { vencimento: "asc" } }),
    db.cobranca.findMany({ where: { clienteId: cliente.id, pagoEm: { not: null } }, include: { pedido: true }, orderBy: { pagoEm: "desc" }, take: 8 }),
    db.precoCliente.findMany({ where: { clienteId: cliente.id }, include: { produto: { include: { item: true } } } }),
    db.mensagem.findMany({ where: { clienteId: cliente.id }, orderBy: { criadaEm: "desc" }, take: 30 }),
  ]);
  const totalAberto = abertas.reduce((s, c) => s + c.valor, 0);
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

      <section className="cartao-eggs">
        <div className="flex items-baseline justify-between">
          <h2 className="titulo-eggs flex items-center gap-1.5"><Receipt className="size-4" /> Pagamentos</h2>
          {totalAberto > 0 && <span className="tabular text-sm font-bold">{reais(totalAberto)} em aberto</span>}
        </div>
        <ul className="mt-3 divide-y divide-casca-100 text-sm">
          {abertas.map((c) => {
            const vencida = c.vencimento < hoje;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">Pedido #{c.pedidoId}</span>
                  <span className={`block text-xs font-semibold ${vencida ? "text-red-700" : "text-casca-500"}`}>
                    {vencida ? "Vencida em " : "Vence "}
                    {formatarDia(c.vencimento, { day: "2-digit", month: "2-digit" })}
                  </span>
                </span>
                <span className="tabular font-bold">{reais(c.valor)}</span>
              </li>
            );
          })}
          {pagas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-casca-500">
              <span>
                Pedido #{c.pedidoId}
                <span className="block text-xs">pago em {formatarDia(diaISO(c.pagoEm!), { day: "2-digit", month: "2-digit" })}</span>
              </span>
              <span className="tabular">{reais(c.valor)}</span>
            </li>
          ))}
          {abertas.length + pagas.length === 0 && <li className="py-2 text-casca-700">Nenhum pagamento ainda.</li>}
        </ul>
      </section>

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
