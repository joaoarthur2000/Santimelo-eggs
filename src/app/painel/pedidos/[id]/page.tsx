import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { AcoesContato } from "@/components/contato";
import { BotaoConfirma, BotaoEnviar } from "@/components/botao-enviar";
import { Cabecalho, Etiqueta } from "@/components/ui";
import { ORIGENS_PEDIDO, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { db } from "@/lib/db";
import { diaISO, formatarDia, formatarHora, formatarDataCurta } from "@/lib/datas";
import { diasEntre } from "@/lib/financeiro";
import { quantidade, reais } from "@/lib/formato";
import { CONDICOES_DO_PEDIDO, FORMAS_DO_PEDIDO, pagamentoDoPedido } from "@/lib/pagamento";
import { desfazerPago, marcarPago } from "../../actions";
import { mudarStatus } from "../actions";
import { FornecedorDoItem } from "./fornecedor-item";
import { MudarPagamento } from "./mudar-pagamento";
import { BotaoImprimir } from "./botao-imprimir";
import { ExcluirPedido } from "../excluir-pedido";

export async function generateMetadata({ params }: PageProps<"/painel/pedidos/[id]">) {
  return { title: `Pedido #${(await params).id}` };
}

export default async function Pedido({ params }: PageProps<"/painel/pedidos/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [pedido, fornecedores] = await Promise.all([
    db.pedido.findUnique({
      where: { id },
      include: {
        cliente: { include: { regiao: true } },
        janela: true,
        cobranca: true,
        itens: { include: { produto: { include: { item: true } }, fornecedor: true } },
      },
    }),
    db.fornecedor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!pedido) notFound();

  const status = pedido.status as StatusPedido;
  const aberto = status !== "ENTREGUE" && status !== "CANCELADO";
  const semFornecedor = pedido.itens.filter((i) => i.produto.fatorEstoque && !i.fornecedorId).length;
  const itensOrdenados = [...pedido.itens].sort(
    (a, b) => a.produto.item.ordem - b.produto.item.ordem || b.precoUnit - a.precoUnit,
  );
  const c = pedido.cliente;
  const cobranca = status === "CANCELADO" ? null : pedido.cobranca;
  const hoje = diaISO();
  const entrega = diaISO(pedido.dataEntrega);
  const pag = pagamentoDoPedido(pedido, c);
  const situacao = !cobranca ? null : cobranca.pagoEm ? "PAGO" : cobranca.vencimento < hoje ? "VENCIDO" : "ABERTO";
  const diaCurto = (d: string) => formatarDia(d, { day: "2-digit", month: "2-digit" });
  const emDias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

  return (
    <>
      <Link data-voltar href={`/painel/pedidos?dia=${diaISO(pedido.dataEntrega)}`} className="mb-3 hidden items-center gap-1 text-sm text-stone-500 hover:text-marca-700 lg:inline-flex print:hidden">
        <ArrowLeft className="size-4" /> Pedidos do dia
      </Link>
      <Cabecalho
        titulo={`Pedido #${pedido.id} · ${c.nomeFantasia}`}
        subtitulo={`Entrega ${formatarDia(diaISO(pedido.dataEntrega))} · feito em ${formatarDataCurta(pedido.criadoEm)} às ${formatarHora(pedido.criadoEm)} via ${ORIGENS_PEDIDO[pedido.origem as keyof typeof ORIGENS_PEDIDO]}`}
      >
        <Etiqueta status={status}>{STATUS_PEDIDO[status]}</Etiqueta>
        {cobranca && (
          <span className={`etiqueta ring-1 ring-inset print:hidden ${situacao === "PAGO" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : situacao === "VENCIDO" ? "bg-red-50 text-red-700 ring-red-600/15" : "bg-amber-50 text-amber-800 ring-amber-600/20"}`}>
            {situacao === "PAGO" ? "Pago" : situacao === "VENCIDO" ? "Em aberto, venceu" : "Em aberto"}
          </span>
        )}
        <span className="contents max-lg:[&>*]:hidden print:hidden">
          {aberto && (
            <form action={mudarStatus.bind(null, pedido.id, "ENTREGUE")}>
              <button className="botao-primario">Marcar “Entregue”</button>
            </form>
          )}
          {status !== "CANCELADO" && status !== "ENTREGUE" && (
            <form action={mudarStatus.bind(null, pedido.id, "CANCELADO")}>
              <button className="botao-secundario text-red-700">Cancelar</button>
            </form>
          )}
          {status === "CANCELADO" && (
            <form action={mudarStatus.bind(null, pedido.id, "NOVO")}>
              <button className="botao-secundario">Reabrir</button>
            </form>
          )}
          {status !== "CANCELADO" && (
            <Link href={`/painel/pedidos/${pedido.id}/editar`} className="botao-secundario">
              <Pencil className="size-4" /> Editar
            </Link>
          )}
          <ExcluirPedido id={pedido.id} pagina />
          <BotaoImprimir />
        </span>
      </Cabecalho>

      <AcoesContato cliente={c} className="mb-4" />

      {semFornecedor > 0 && status !== "CANCELADO" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden" role="status">
          Falta o fornecedor de {semFornecedor} {semFornecedor === 1 ? "item" : "itens"}: escolha abaixo pra baixar o estoque do fornecedor certo.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          <table className="lista-cel w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {itensOrdenados.map((i) => (
                <tr key={i.id}>
                  <td data-c="t" className="px-4 py-2.5">
                    <span className="font-medium">{i.produto.item.nome}</span>
                    <span className="block text-xs font-normal text-stone-500">
                      {i.produto.embalagem}
                      <span className="tabular lg:hidden"> · {quantidade(i.quantidade, i.produto.unidade)} × {reais(i.precoUnit)}</span>
                    </span>
                  </td>
                  <td data-c="a" className="px-4 py-2.5">
                    {status === "CANCELADO" ? (
                      (i.fornecedor?.nome ?? "—")
                    ) : (
                      <FornecedorDoItem itemId={i.id} atual={i.fornecedorId} nomeAtual={i.fornecedor?.nome ?? null} opcoes={fornecedores} />
                    )}
                  </td>
                  <td data-c="x" className="tabular px-4 py-2.5 text-right">{quantidade(i.quantidade, i.produto.unidade)}</td>
                  <td data-c="x" className="tabular px-4 py-2.5 text-right text-stone-500">{reais(i.precoUnit)}</td>
                  <td data-c="v" className="tabular px-4 py-2.5 text-right">{reais(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-stone-200 font-semibold">
              <tr>
                <td data-c="t" colSpan={4} className="px-4 py-3 text-right">Total · frete grátis</td>
                <td data-c="v" className="tabular px-4 py-3 text-right">{reais(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
          {pedido.observacao && <p className="border-t border-stone-100 px-4 py-3 text-sm"><strong>Obs:</strong> {pedido.observacao}</p>}
        </div>

        <div className="grid h-fit gap-4 [&>*]:min-w-0 xl:gap-6">
        {cobranca && (
          <section className="cartao space-y-3 p-5 text-sm">
            <h2 className="font-semibold text-marca-950">Pagamento</h2>
            <div className={`rounded-xl px-4 py-3 ${situacao === "PAGO" ? "bg-emerald-50" : situacao === "VENCIDO" ? "bg-red-50" : "bg-amber-50"}`}>
              <p className={`font-medium ${situacao === "PAGO" ? "text-emerald-800" : situacao === "VENCIDO" ? "text-red-800" : "text-amber-900"}`}>{situacao === "PAGO" ? "Pago" : "Em aberto"}</p>
              <p className={`tabular text-2xl leading-tight font-bold tracking-tight ${situacao === "PAGO" ? "text-emerald-800" : situacao === "VENCIDO" ? "text-red-700" : "text-amber-900"}`}>{reais(cobranca.valor)}</p>
              <p className={situacao === "PAGO" ? "text-emerald-800" : situacao === "VENCIDO" ? "text-red-700" : "text-amber-900"}>
                {cobranca.pagoEm
                  ? `recebido em ${formatarDataCurta(cobranca.pagoEm)}`
                  : cobranca.vencimento < hoje
                    ? `venceu ${diaCurto(cobranca.vencimento)}, há ${emDias(diasEntre(cobranca.vencimento, hoje))}`
                    : cobranca.vencimento === hoje
                      ? "vence hoje"
                      : `vence ${diaCurto(cobranca.vencimento)}, em ${emDias(diasEntre(hoje, cobranca.vencimento))}`}
              </p>
            </div>
            <Linha rotulo="Forma" valor={pag.forma ?? "não informada"} />
            <Linha rotulo="Condição" valor={`${CONDICOES_DO_PEDIDO[pag.condicao]}${pag.condicao === "PRAZO" ? ` até ${diaCurto(cobranca.vencimento)}` : ""}`} />
            <div className="space-y-3 print:hidden">
              {cobranca.pagoEm ? (
                <form action={desfazerPago.bind(null, cobranca.id)}>
                  <BotaoConfirma className="toque text-sm font-medium text-stone-500 hover:text-red-600" confirmar="Toque de novo pra desfazer" enviando="Desfazendo…">
                    Desfazer pagamento
                  </BotaoConfirma>
                </form>
              ) : (
                <>
                  <form action={marcarPago.bind(null, cobranca.id)} className="max-lg:hidden">
                    <BotaoEnviar className="botao-primario w-full">Recebi o pagamento</BotaoEnviar>
                  </form>
                  <MudarPagamento
                    pedidoId={pedido.id}
                    entrega={entrega}
                    atual={{ forma: FORMAS_DO_PEDIDO.find((f) => f === pag.forma) ?? "", condicao: pag.condicao, dias: pag.condicao === "PRAZO" ? null : 7, data: pag.condicao === "PRAZO" ? cobranca.vencimento : "" }}
                  />
                </>
              )}
            </div>
          </section>
        )}
        <aside className="cartao h-fit space-y-2 p-5 text-sm">
          <h2 className="font-semibold text-marca-950">Entrega</h2>
          <Linha rotulo="Cliente" valor={<Link href={`/painel/clientes/${c.id}`} className="text-marca-700 hover:underline">{c.nomeFantasia}</Link>} />
          <Linha rotulo="Endereço" valor={[c.endereco, c.bairro, c.cidade].filter(Boolean).join(" · ")} />
          <Linha rotulo="Região" valor={c.regiao?.nome} />
          <Linha rotulo="Horário" valor={pedido.janela ? `${pedido.janela.inicio}–${pedido.janela.fim}` : null} />
          <Linha rotulo="Responsável" valor={c.responsavel} />
          <Linha rotulo="WhatsApp" valor={c.whatsapp} />
          <Linha rotulo="Nota fiscal" valor={pedido.notaFiscal ? "Com NF" : "Sem NF"} />
        </aside>
        </div>
      </div>

      {/* Celular: o que se faz pouco fica no fim da tela, longe do polegar */}
      <div className="mt-6 grid gap-2 lg:hidden print:hidden">
        {status !== "CANCELADO" && (
          <Link href={`/painel/pedidos/${pedido.id}/editar`} className="botao-secundario w-full">
            <Pencil className="size-4" /> Editar pedido
          </Link>
        )}
        {aberto && (
          <form action={mudarStatus.bind(null, pedido.id, "CANCELADO")}>
            <BotaoConfirma className="botao-secundario w-full text-red-700" confirmar="Toque de novo pra cancelar" enviando="Cancelando…">Cancelar pedido</BotaoConfirma>
          </form>
        )}
        <div className="flex justify-center"><ExcluirPedido id={pedido.id} pagina /></div>
      </div>

      {/* Celular: o próximo passo do pedido, fixo embaixo */}
      {aberto ? (
        <form key="entregar" action={mudarStatus.bind(null, pedido.id, "ENTREGUE")} className="acao-fixa lg:hidden print:hidden">
          <span className="tabular text-lg font-bold text-marca-950">{reais(pedido.total)}</span>
          <BotaoConfirma className="botao-primario flex-1" confirmar="Confirmar entrega">Marcar entregue</BotaoConfirma>
        </form>
      ) : status === "CANCELADO" ? (
        <form key="reabrir" action={mudarStatus.bind(null, pedido.id, "NOVO")} className="acao-fixa lg:hidden print:hidden">
          <BotaoEnviar className="botao-secundario flex-1">Reabrir pedido</BotaoEnviar>
        </form>
      ) : cobranca && !cobranca.pagoEm ? (
        <form key="receber" action={marcarPago.bind(null, cobranca.id)} className="acao-fixa lg:hidden print:hidden">
          <span className="tabular text-lg font-bold text-marca-950">{reais(cobranca.valor)}</span>
          <BotaoConfirma className="botao-primario flex-1" confirmar="Confirmar pagamento">Recebi o pagamento</BotaoConfirma>
        </form>
      ) : null}
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (!valor) return null;
  return (
    <p className="flex justify-between gap-4">
      <span className="text-stone-500">{rotulo}</span>
      <span className="text-right">{valor}</span>
    </p>
  );
}
