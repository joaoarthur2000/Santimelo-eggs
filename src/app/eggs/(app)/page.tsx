import Link from "next/link";
import { ArrowRight, CalendarClock, MessageCircleHeart, Truck, Wallet } from "lucide-react";
import { DIAS_SEMANA, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaDaSemana, diaISO, formatarDia, formatarHora, inicioDoDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { diasEntre, extratoDoCliente } from "@/lib/financeiro";
import { agendaDaRegiao, nomeDoCliente, produtosDoCliente } from "@/lib/eggs";
import { reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { marcarMensagensLidas } from "./actions";
import { Brilho, Faixa, Ovo, SeloPreco, tipoDoOvo } from "./enfeites";
import { GuinhoAnimado } from "./guinho-animado";

const atraso = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function InicioEggs() {
  const { cliente } = await exigirCliente();
  const hoje = diaISO();
  const [mensagens, extrato, proximoPedido, produtos, agenda] = await Promise.all([
    db.mensagem.findMany({ where: { clienteId: cliente.id, lidaEm: null }, orderBy: { criadaEm: "desc" } }),
    extratoDoCliente(cliente.id),
    db.pedido.findFirst({
      where: { clienteId: cliente.id, status: { notIn: ["ENTREGUE", "CANCELADO"] }, dataEntrega: { gte: inicioDoDia(hoje) } },
      include: { janela: true },
      orderBy: { dataEntrega: "asc" },
    }),
    produtosDoCliente(cliente.id),
    agendaDaRegiao(cliente.regiaoId, 7),
  ]);
  const caixas = produtos;
  const proximaEntrega = agenda.find((d) => d.janelas.some((j) => j.livres > 0));
  const proximo = extrato.proximoVencimento;
  const dp = proximo ? diasEntre(hoje, proximo.vencimento) : null;

  return (
    <div className="space-y-5">
      <section className="eggs-entra relative flex items-end justify-between gap-2 pt-2" style={atraso(0)}>
        <Brilho className="-top-1 right-40 text-3xl" />
        <Brilho className="left-1/2 top-12 text-lg [animation-delay:0.8s]" />
        <div className="min-w-0 pb-3">
          <p className="text-sm font-medium text-casca-500 first-letter:uppercase">{formatarDia(hoje)}</p>
          <h1 className="font-eggs text-5xl font-extrabold leading-[0.95] tracking-tight">
            Olá, <span className="text-tomate-500">{nomeDoCliente(cliente)}!</span>
          </h1>
          <p className="mt-2 text-sm font-semibold text-casca-700">O Guinho separou os ovos mais fresquinhos pra você.</p>
        </div>
        <GuinhoAnimado className="-my-4 -mr-2 h-48 w-44 shrink-0 sm:h-56 sm:w-52" />
      </section>

      <Faixa frases={["Ovos fresquinhos", "Direto da granja", "Entrega no seu horário", "Preço sem surpresa"]} />

      {mensagens.length > 0 && (
        <section className="eggs-entra space-y-2" style={atraso(1)}>
          {mensagens.map((m) => (
            <div key={m.id} className="flex gap-3 rounded-3xl bg-gema-400 p-4">
              <MessageCircleHeart className="eggs-balanca mt-0.5 size-7 shrink-0" />
              <div>
                <p className="font-semibold leading-snug">{m.texto}</p>
                <p className="mt-1 text-xs font-medium text-casca-700">{formatarDia(diaISO(m.criadaEm), { day: "2-digit", month: "2-digit" })} · {m.autor}</p>
              </div>
            </div>
          ))}
          <form action={marcarMensagensLidas} className="text-right">
            <button className="text-sm font-semibold text-casca-700 underline-offset-2 hover:underline">Entendi, marcar como lidas</button>
          </form>
        </section>
      )}

      <Link href="/eggs/pedir" className="eggs-entra eggs-toque relative block overflow-hidden rounded-[2rem] bg-casca-900 p-6 text-gema-50" style={atraso(2)}>
        <Ovo tipo="branco" className="absolute -bottom-6 -right-4 size-32 rotate-12 opacity-90" />
        <span className="relative block font-eggs text-4xl font-extrabold leading-none">Bora pedir?</span>
        <span className="relative mt-2 block max-w-[70%] text-sm text-gema-200">
          {proximaEntrega
            ? `Próxima entrega na sua região: ${DIAS_SEMANA[diaDaSemana(proximaEntrega.dia)].toLowerCase()}, ${formatarDia(proximaEntrega.dia, { day: "2-digit", month: "2-digit" })}`
            : "Escolha os ovos e o horário da entrega"}
        </span>
        <span className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-gema-400 px-4 py-2 font-bold text-casca-900">
          Fazer pedido <ArrowRight className="size-4" />
        </span>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="eggs-entra cartao-eggs" style={atraso(3)}>
          <p className="titulo-eggs flex items-center gap-1.5"><Truck className="size-4" /> Próxima entrega</p>
          {proximoPedido ? (
            <Link href="/eggs/pedidos" className="mt-2 block">
              <p className="font-eggs text-2xl font-extrabold first-letter:uppercase">{formatarDia(diaISO(proximoPedido.dataEntrega), { weekday: "long", day: "2-digit", month: "2-digit" })}</p>
              <p className="text-sm text-casca-700">
                {proximoPedido.janela ? `entre ${proximoPedido.janela.inicio} e ${proximoPedido.janela.fim}` : `a partir das ${formatarHora(proximoPedido.dataEntrega)}`} · {STATUS_PEDIDO[proximoPedido.status as StatusPedido]}
              </p>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-casca-700">Nenhum pedido agendado.</p>
          )}
        </section>

        <Link
          href="/eggs/financeiro"
          className={`eggs-entra eggs-toque cartao-eggs block ${extrato.vencido > 0 ? "ring-2 ring-tomate-500" : ""}`}
          style={atraso(4)}
        >
          <p className="titulo-eggs flex items-center gap-1.5"><Wallet className="size-4" /> Valor em aberto</p>
          <p className="tabular mt-2 font-eggs text-2xl font-extrabold">{reais(extrato.emAberto)}</p>
          <p className={`text-sm font-semibold ${extrato.vencido > 0 ? "text-tomate-600" : dp !== null && dp <= 3 ? "text-gema-700" : "text-casca-700"}`}>
            {extrato.vencido > 0
              ? `${reais(extrato.vencido)} vencido`
              : proximo && dp !== null
                ? dp === 0 ? "Vence hoje" : `Próximo vencimento ${formatarDia(proximo.vencimento, { day: "2-digit", month: "2-digit" })}`
                : "Tudo em dia"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-casca-700">
            Ver extrato completo <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </div>

      <section className="eggs-entra cartao-eggs" style={atraso(5)}>
        <div className="flex items-center justify-between">
          <p className="titulo-eggs flex items-center gap-1.5"><CalendarClock className="size-4" /> Preços de hoje</p>
          <Link href="/eggs/precos" className="text-sm font-semibold text-casca-700 hover:underline">Ver todos</Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {caixas.map((p) => (
            <li key={p.id} className="flex flex-col items-center rounded-3xl bg-gema-50 px-2 pb-3 pt-2 text-center">
              <div className="relative">
                <Ovo tipo={tipoDoOvo(p.item)} className="size-16" />
                <span className="absolute -right-14 -top-4 scale-[0.65]">
                  <SeloPreco valor={p.preco} />
                </span>
              </div>
              <p className="mt-1 text-sm font-bold leading-tight">{p.item.replace(/^Ovo /, "")}</p>
              <p className="text-[11px] font-medium text-casca-500">{p.embalagem}</p>
              {p.negociado && <span className="mt-1 rounded-full bg-gema-200 px-2 py-0.5 text-[10px] font-bold">seu preço</span>}
              {p.proximos[0] && (
                <span className="mt-1 text-[11px] font-semibold text-gema-700">
                  {reais(p.proximos[0].preco)} a partir de {formatarDia(p.proximos[0].aPartirDe, { day: "2-digit", month: "2-digit" })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
