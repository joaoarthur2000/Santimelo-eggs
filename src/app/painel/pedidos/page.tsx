import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Cabecalho, Codigo, Etiqueta, SeletorDia, Vazio } from "@/components/ui";
import { FLUXO_PEDIDO, ORIGENS_PEDIDO, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { listaDeSeparacao } from "@/lib/consultas";
import { db } from "@/lib/db";
import { diaISO, diaValido, fimDoDia, formatarDia, inicioDoDia } from "@/lib/datas";
import { quantidade, reais } from "@/lib/formato";
import { AtualizaSozinho } from "@/components/atualiza-sozinho";
import { SituacaoPagamento } from "@/components/situacao-pagamento";
import { PedidosQueChegaram, porDataDeEntrega } from "./chegaram";
import { ExcluirPedido } from "./excluir-pedido";

// filtros do topo: o fluxo do painel (Novo → Entregue) + Cancelado
const FILTROS: StatusPedido[] = [...FLUXO_PEDIDO, "CANCELADO"];

export const metadata: Metadata = { title: "Pedidos" };

export default async function Pedidos({ searchParams }: PageProps<"/painel/pedidos">) {
  const { dia: diaParam, status } = await searchParams;
  const dia = diaValido(diaParam);
  const filtroStatus = typeof status === "string" && status in STATUS_PEDIDO ? status : undefined;

  const pedidos = await db.pedido.findMany({
    where: { dataEntrega: { gte: inicioDoDia(dia), lt: fimDoDia(dia) }, ...(filtroStatus && { status: filtroStatus }) },
    include: {
      cliente: { include: { regiao: true } },
      janela: true,
      cobranca: true,
      itens: { include: { produto: { include: { item: true } } } },
    },
  });
  pedidos.sort(porDataDeEntrega); // horário de entrega, depois número

  // Dia vazio: atalho pros dias vizinhos que têm pedido
  const vivo = { status: { not: "CANCELADO" } };
  const [antes, depois] = pedidos.length
    ? [null, null]
    : await Promise.all([
        db.pedido.findFirst({ where: { ...vivo, dataEntrega: { lt: inicioDoDia(dia) } }, orderBy: { dataEntrega: "desc" }, select: { dataEntrega: true } }),
        db.pedido.findFirst({ where: { ...vivo, dataEntrega: { gte: fimDoDia(dia) } }, orderBy: { dataEntrega: "asc" }, select: { dataEntrega: true } }),
      ]);
  const vizinhos = [
    ["Último dia com pedido", antes],
    ["Próximo dia com pedido", depois],
  ].flatMap(([rotulo, p]) => (p && typeof p !== "string" ? [{ rotulo: rotulo as string, dia: diaISO(p.dataEntrega) }] : []));

  // O que separar pras entregas do dia
  const separar = listaDeSeparacao(pedidos);

  const rota = "/painel/pedidos";
  const total = pedidos.filter((p) => p.status !== "CANCELADO").reduce((s, p) => s + p.total, 0);

  return (
    <>
      <Cabecalho titulo="Pedidos" subtitulo={`Entrega ${formatarDia(dia)} · ${pedidos.length} pedidos · ${reais(total)}`}>
        <span className="max-lg:hidden"><AtualizaSozinho segundos={20} /></span>
        <div className="flex items-stretch gap-2 max-lg:w-full">
          <SeletorDia dia={dia} rota={rota} />
          <Link href={`/painel/pedidos/novo?dia=${dia}`} className="botao-primario max-lg:w-12 max-lg:px-0" aria-label="Novo pedido">
            <Plus className="size-4 max-lg:size-6" /> <span className="max-lg:hidden">Novo pedido</span>
          </Link>
        </div>
      </Cabecalho>

      <PedidosQueChegaram />

      {/* filtro em controle segmentado: só os status que o painel usa hoje + os antigos que ainda existirem no dia */}
      <nav className="sem-rolagem mb-4 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-stone-200/50 p-1 text-sm max-lg:flex">
        {([["", "Todos"], ...FILTROS.map((c) => [c, STATUS_PEDIDO[c]])] as [string, string][]).map(([chave, rotulo]) => {
          const ativo = (filtroStatus ?? "") === chave;
          return (
            <Link
              key={chave || "todos"}
              href={chave ? `${rota}?dia=${dia}&status=${chave}` : `${rota}?dia=${dia}`}
              className={`rounded-lg px-3.5 py-1.5 text-center whitespace-nowrap max-lg:flex-1 max-lg:px-1 max-lg:py-2.5 transition-[background-color,color,box-shadow] duration-150 ${ativo ? "bg-white font-medium text-marca-950 shadow-[0_1px_2px_rgb(41_28_18/0.1)]" : "text-stone-600 hover:text-marca-950"}`}
            >
              {rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 2xl:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          {pedidos.length === 0 ? (
            <div className="p-5">
              <Vazio>Nenhum pedido com entrega nesse dia.</Vazio>
              {vizinhos.length > 0 && (
                <div className="mt-3 grid gap-2 lg:hidden">
                  {vizinhos.map((v) => (
                    <Link key={v.rotulo} href={`${rota}?dia=${v.dia}`} className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-concha px-4 active:bg-stone-100">
                      <span className="text-stone-600">{v.rotulo}</span>
                      <b className="text-marca-950 first-letter:uppercase">{formatarDia(v.dia, { weekday: "short", day: "2-digit", month: "2-digit" })}</b>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <table className="lista-cel w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-right">Itens</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-px px-4 py-3"><span className="sr-only">Excluir</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td data-c="x" className="px-4 py-3">
                      <Link href={`/painel/pedidos/${p.id}`} className="font-medium text-marca-700 hover:underline">#{p.id}</Link>
                    </td>
                    <td data-c="t" className="px-4 py-3">
                      <Link href={`/painel/pedidos/${p.id}`} className="linha-toque hover:underline">{p.cliente.nomeFantasia}</Link>
                      <span className="block text-sm font-normal text-stone-600 lg:hidden">{p.itens.map((i) => `${quantidade(i.quantidade, i.produto.unidade)} ${i.produto.item.nome.replace(/^Ovo /, "")}`).join(" · ")}</span>
                      <span className="block text-xs font-normal text-stone-500"><span className="lg:hidden">#{p.id} · </span>{p.janela ? `${p.janela.inicio}–${p.janela.fim}` : "sem horário"}{p.cliente.regiao && ` · ${p.cliente.regiao.nome}`}</span>
                    </td>
                    <td data-c="x" className="px-4 py-3 text-stone-600">{ORIGENS_PEDIDO[p.origem as keyof typeof ORIGENS_PEDIDO]}</td>
                    <td data-c="x" className="tabular px-4 py-3 text-right">{p.itens.length}</td>
                    <td data-c="v" className="tabular px-4 py-3 text-right">
                      {reais(p.total)}
                      <span className="mt-1 block lg:hidden"><Etiqueta status={p.status}>{STATUS_PEDIDO[p.status as StatusPedido]}</Etiqueta></span>
                      <span className="mt-1 block text-sm font-normal lg:hidden"><SituacaoPagamento pedido={p} /></span>
                    </td>
                    <td data-c="x" className="px-4 py-3">
                      <SituacaoPagamento pedido={p} />
                    </td>
                    <td data-c="x" className="px-4 py-3">
                      <Etiqueta status={p.status}>{STATUS_PEDIDO[p.status as StatusPedido]}</Etiqueta>
                    </td>
                    <td data-c="x" className="px-4 py-2 text-right">
                      <ExcluirPedido id={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="cartao h-fit p-5">
          <h2 className="font-semibold text-marca-950">Lista do dia</h2>
          <p className="mb-4 text-xs text-stone-500">Soma de todos os pedidos ativos: o que separar pras entregas</p>
          {separar.length === 0 ? (
            <Vazio>Nada pra separar.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {separar.map((l) => (
                <li key={l.nome} className="flex justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    <Codigo codigo={l.codigo} />
                    {l.nome}
                  </span>
                  <span className="tabular shrink-0 font-semibold">{quantidade(l.qtd, l.unidade)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
