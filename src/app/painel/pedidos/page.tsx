import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Cabecalho, Codigo, Etiqueta, SeletorDia, Vazio } from "@/components/ui";
import { ORIGENS_PEDIDO, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { listaDeSeparacao } from "@/lib/consultas";
import { db } from "@/lib/db";
import { diaValido, fimDoDia, formatarDia, inicioDoDia } from "@/lib/datas";
import { quantidade, reais } from "@/lib/formato";
import { AtualizaSozinho } from "@/components/atualiza-sozinho";
import { PedidosQueChegaram } from "./chegaram";

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
      itens: { include: { produto: { include: { item: true } } } },
    },
    orderBy: [{ dataEntrega: "asc" }, { id: "asc" }],
  });

  // O que separar pras entregas do dia
  const separar = listaDeSeparacao(pedidos);

  const rota = "/painel/pedidos";
  const total = pedidos.filter((p) => p.status !== "CANCELADO").reduce((s, p) => s + p.total, 0);

  return (
    <>
      <Cabecalho titulo="Pedidos" subtitulo={`Entrega ${formatarDia(dia)} · ${pedidos.length} pedidos · ${reais(total)}`}>
        <AtualizaSozinho segundos={20} />
        <SeletorDia dia={dia} rota={rota} />
        <Link href={`/painel/pedidos/novo?dia=${dia}`} className="botao-primario">
          <Plus className="size-4" /> Novo pedido
        </Link>
      </Cabecalho>

      <PedidosQueChegaram />

      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={`${rota}?dia=${dia}`} className={`etiqueta px-3 py-1 ${!filtroStatus ? "bg-marca-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>
          Todos
        </Link>
        {Object.entries(STATUS_PEDIDO).map(([chave, rotulo]) => (
          <Link
            key={chave}
            href={`${rota}?dia=${dia}&status=${chave}`}
            className={`etiqueta px-3 py-1 ${filtroStatus === chave ? "bg-marca-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <div className="cartao overflow-x-auto">
          {pedidos.length === 0 ? (
            <div className="p-5">
              <Vazio>Nenhum pedido com entrega nesse dia.</Vazio>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-right">Itens</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/painel/pedidos/${p.id}`} className="font-medium text-marca-700 hover:underline">#{p.id}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/painel/pedidos/${p.id}`} className="hover:underline">{p.cliente.nomeFantasia}</Link>
                      <span className="block text-xs text-stone-500">{p.janela ? `${p.janela.inicio}–${p.janela.fim}` : "sem horário"}{p.cliente.regiao && ` · ${p.cliente.regiao.nome}`}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{ORIGENS_PEDIDO[p.origem as keyof typeof ORIGENS_PEDIDO]}</td>
                    <td className="tabular px-4 py-3 text-right">{p.itens.length}</td>
                    <td className="tabular px-4 py-3 text-right">{reais(p.total)}</td>
                    <td className="px-4 py-3">
                      <Etiqueta status={p.status}>{STATUS_PEDIDO[p.status as StatusPedido]}</Etiqueta>
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
