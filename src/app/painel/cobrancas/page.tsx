import type { Metadata } from "next";
import Link from "next/link";
import { BotaoConfirma, BotaoEnviar } from "@/components/botao-enviar";
import { Cabecalho, Indicador } from "@/components/ui";
import { AVISO_PAGAMENTO_DIAS } from "@/lib/constantes";
import { diaISO, formatarDataCurta, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, reais } from "@/lib/formato";
import { pagamentoDoPedido } from "@/lib/pagamento";
import { desfazerPago, marcarPago } from "../actions";

export const metadata: Metadata = { title: "Cobranças de ovos" };

const data = (dia: string) => formatarDataCurta(new Date(`${dia}T12:00:00-03:00`));

export default async function CobrancasOvos() {
  const hoje = diaISO();
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const [abertas, pagas] = await Promise.all([
    db.cobranca.findMany({ where: { pagoEm: null }, include: { cliente: true, pedido: true }, orderBy: { vencimento: "asc" } }),
    db.cobranca.findMany({ where: { pagoEm: { gte: inicioDoDia(somarDias(hoje, -30)) } }, include: { cliente: true }, orderBy: { pagoEm: "desc" } }),
  ]);
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const aviso = abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= somarDias(hoje, AVISO_PAGAMENTO_DIAS));
  const recebidoMes = pagas.filter((c) => diaISO(c.pagoEm!) >= inicioMes).reduce((s, c) => s + c.valor, 0);
  const soma = (l: typeof abertas) => l.reduce((s, c) => s + c.valor, 0);
  const dias = (dia: string) => Math.round((inicioDoDia(dia).getTime() - inicioDoDia(hoje).getTime()) / 864e5);

  return (
    <>
      <Cabecalho titulo="Cobranças" explica subtitulo={`Cada pedido de cliente EGGS vira uma cobrança no prazo combinado. ${AVISO_PAGAMENTO_DIAS} dias antes, o app avisa o cliente sozinho.`} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Indicador rotulo="Em aberto" valor={reais(soma(abertas))} detalhe={`${num(abertas.length)} cobranças`} />
        <Indicador rotulo="Vencidas" valor={reais(soma(vencidas))} detalhe={`${num(vencidas.length)} cobranças`} />
        <Indicador rotulo="Vencem em até 3 dias" valor={reais(soma(aviso))} detalhe="cliente já foi avisado no app" />
        <Indicador rotulo="Recebido no mês" valor={reais(recebidoMes)} />
      </section>

      <section className="mt-5 cartao overflow-x-auto lg:mt-6">
        <h2 className="px-4 pt-4 font-semibold text-marca-950">Em aberto</h2>
        <table className="lista-cel mt-2 w-full text-sm">
          <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Vencimento</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Pedido</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {abertas.map((c) => {
              const d = dias(c.vencimento);
              return (
                <tr key={c.id}>
                  <td data-c="s" className="px-4 py-2">
                    <span className={`lg:hidden ${d < 0 ? "font-medium text-red-700" : ""}`}>{d < 0 ? `venceu ${data(c.vencimento)}, há ${-d} ${-d === 1 ? "dia" : "dias"}` : d === 0 ? "vence hoje" : `vence ${data(c.vencimento)}`}{c.pedido && <span className="font-normal text-stone-500"> · {pagamentoDoPedido(c.pedido, c.cliente).forma ?? "sem forma"}</span>}</span>
                    <span className="max-lg:hidden">{data(c.vencimento)}</span>
                    <span className={`block text-xs max-lg:hidden ${d < 0 ? "font-semibold text-red-700" : d <= AVISO_PAGAMENTO_DIAS ? "text-amber-700" : "text-stone-500"}`}>
                      {d < 0 ? `vencida há ${-d} ${-d === 1 ? "dia" : "dias"}` : d === 0 ? "vence hoje" : `em ${d} ${d === 1 ? "dia" : "dias"}`}
                    </span>
                  </td>
                  <td data-c="t" className="order-first px-4 py-2">
                    <Link href={`/painel/clientes/${c.clienteId}`} className="hover:underline">{c.cliente.nomeFantasia}</Link>
                  </td>
                  <td data-c="x" className="px-4 py-2">{c.pedidoId ? <><Link href={`/painel/pedidos/${c.pedidoId}`} className="text-marca-700 hover:underline">#{c.pedidoId}</Link>{c.pedido && <span className="text-xs text-stone-500"> · {pagamentoDoPedido(c.pedido, c.cliente).forma ?? "sem forma"}</span>}</> : <span className="text-xs text-stone-500">{c.descricao ?? "lançado à mão"}</span>}</td>
                  <td data-c="v" className="tabular px-4 py-2 text-right font-semibold">{reais(c.valor)}</td>
                  <td data-c="l" className="px-4 py-2 text-right">
                    <form action={marcarPago.bind(null, c.id)}>
                      <BotaoConfirma className="botao-secundario px-2 py-1 text-xs" confirmar="Confirmar" enviando="…">
                        <span className="max-lg:hidden">Marcar pago</span><span className="lg:hidden">Recebi</span>
                      </BotaoConfirma>
                    </form>
                  </td>
                </tr>
              );
            })}
            {abertas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">Nada em aberto.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6 cartao p-5">
        <h2 className="mb-3 font-semibold text-marca-950">Pagas nos últimos 30 dias</h2>
        <ul className="divide-y divide-stone-100 text-sm">
          {pagas.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {c.cliente.nomeFantasia} · {c.pedidoId ? `pedido #${c.pedidoId}` : (c.descricao ?? "lançado à mão")}
                <span className="block text-xs text-stone-500">pago {formatarDataCurta(c.pagoEm!)} · vencia {data(c.vencimento)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular">{reais(c.valor)}</span>
                <form action={desfazerPago.bind(null, c.id)}>
                  <BotaoEnviar className="toque text-xs text-stone-500 hover:text-red-600" enviando="…">desfazer</BotaoEnviar>
                </form>
              </span>
            </li>
          ))}
          {pagas.length === 0 && <li className="py-2 text-stone-500">Nenhum pagamento registrado.</li>}
        </ul>
      </section>
    </>
  );
}
