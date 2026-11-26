import type { Metadata } from "next";
import Link from "next/link";
import { Plus, TriangleAlert, WandSparkles } from "lucide-react";
import { BuscaLista } from "@/components/busca-lista";
import { Cabecalho } from "@/components/ui";
import { textoDeBusca } from "@/lib/busca";
import { condicaoPagamento } from "@/lib/constantes";
import { diaISO, formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { cadastroIncompleto } from "@/lib/cadastro";
import { pct, reais } from "@/lib/formato";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesEggs() {
  const hoje = diaISO();
  const [clientes] = await Promise.all([
    db.cliente.findMany({
      include: {
        usuario: true,
        regiao: true,
        cobrancas: { where: { pagoEm: null } },
        pedidos: { where: { status: { not: "CANCELADO" } }, orderBy: { dataEntrega: "desc" }, take: 1 },
        _count: { select: { pedidos: { where: { origem: "APP" } } } },
      },
      orderBy: { nomeFantasia: "asc" },
    }),
  ]);

  const incompletos = clientes.filter((c) => c.ativo && cadastroIncompleto(c)).length;

  // Quem não pagou no vencimento (à vista = no dia da entrega)
  const atrasados = clientes
    .map((c) => {
      const vencidas = c.cobrancas.filter((x) => x.vencimento < hoje);
      return { c, valor: vencidas.reduce((s, x) => s + x.valor, 0), desde: vencidas.map((x) => x.vencimento).sort()[0] };
    })
    .filter((a) => a.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  return (
    <>
      <Cabecalho titulo="Clientes" explica subtitulo="Padarias, confeitarias, restaurantes, lancherias, mercados e consumidor final. Só quem a Santimelo libera entra no app.">
        {incompletos > 0 && <Link href="/painel/clientes/completar" className="botao-secundario max-lg:w-full"><WandSparkles className="size-4" /> Completar cadastros ({incompletos})</Link>}
        <Link href="/painel/clientes/novo" className="botao-secundario max-lg:flex-1 max-lg:px-2">Cadastro com app</Link>
        <Link href="/painel/clientes/rapido" className="botao-primario px-5 py-2.5 max-lg:flex-1 max-lg:px-2">
          <Plus className="size-4" /> Cliente novo
        </Link>
      </Cabecalho>
      {atrasados.length > 0 && (
        <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 lg:mb-6 lg:p-5" role="alert">
          <h2 className="flex items-center gap-2 font-semibold text-red-800"><TriangleAlert className="size-5" /> {atrasados.length === 1 ? "1 cliente não pagou" : `${atrasados.length} clientes não pagaram`} · {reais(atrasados.reduce((s, a) => s + a.valor, 0))}</h2>
          <ul className="sem-rolagem mt-3 flex flex-wrap gap-2 text-sm max-lg:-mx-4 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:px-4">
            {atrasados.map((a) => (
              <li key={a.c.id}>
                <Link href={`/painel/clientes/${a.c.id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 whitespace-nowrap text-red-800 ring-1 ring-red-200 ring-inset hover:ring-red-400 max-lg:min-h-11 max-lg:px-4">
                  <b>{a.c.nomeFantasia}</b> <span className="tabular">{reais(a.valor)}</span> <span className="text-xs text-red-600">desde {formatarDataCurta(new Date(`${a.desde}T12:00:00-03:00`))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-4 [&>*]:min-w-0">
        <BuscaLista alvo="clientes" placeholder="Buscar cliente, bairro ou telefone" />
        <section className="cartao overflow-x-auto max-lg:overflow-hidden">
          <table id="clientes" className="lista-cel w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Onde</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Venda / custo (cx)</th>
                <th className="px-4 py-3 text-right">Em aberto</th>
                <th className="px-4 py-3">Último pedido</th>
                <th className="px-4 py-3">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clientes.map((c) => {
                const aberto = c.cobrancas.reduce((s, x) => s + x.valor, 0);
                const vencida = c.cobrancas.some((x) => x.vencimento < hoje);
                return (
                  <tr key={c.id} data-busca={textoDeBusca([c.nomeFantasia, c.tipoNegocio, c.responsavel, c.bairro, c.cidade, c.whatsapp, c.usuario?.codigoAcesso].filter(Boolean).join(" "))} className="hover:bg-stone-50">
                    <td data-c="t" className="px-4 py-3">
                      <Link href={`/painel/clientes/${c.id}`} className="linha-toque font-medium text-marca-800 hover:underline">{c.nomeFantasia}</Link>
                      <span className="block text-sm font-normal text-stone-500 lg:hidden">
                        {[c.bairro, c.pedidos[0] ? `último pedido ${formatarDataCurta(c.pedidos[0].dataEntrega)}` : "sem pedido ainda"].filter(Boolean).join(" · ")}
                      </span>
                      <span className="block text-xs text-stone-500 max-lg:hidden">
                        {c.tipoNegocio} · <span className="font-mono">{c.usuario?.codigoAcesso ?? "sem app"}</span> · {c.responsavel ?? "—"}
                      </span>
                    </td>
                    <td data-c="x" className="px-4 py-3">
                      {c.bairro ?? "—"}
                      <span className="block text-xs text-stone-500">{c.cidade ?? "—"} · {c.regiao?.nome ?? <span className="text-amber-700">sem região</span>}</span>
                    </td>
                    <td data-c="x" className="px-4 py-3">
                      {condicaoPagamento(c.prazoPagamentoDias)}
                      <span className="block text-xs text-stone-500">
                        {c.formaPagamento ?? "—"} · <span className={c.notaFiscal ? "font-semibold text-marca-700" : ""}>{c.notaFiscal ? "com NF" : "sem NF"}</span>
                      </span>
                    </td>
                    <td data-c="x" className="tabular px-4 py-3 text-right">
                      {c.valorVenda ? reais(c.valorVenda) : "—"} <span className="text-stone-400">/</span> {c.valorCusto ? reais(c.valorCusto) : "—"}
                      {c.valorVenda && c.valorCusto ? <span className="block text-xs text-stone-500">margem {pct((c.valorVenda - c.valorCusto) / c.valorVenda)}</span> : null}
                    </td>
                    <td data-c="v" className="tabular px-4 py-3 text-right">
                      {aberto ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${vencida ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                          <span className="max-lg:hidden">{vencida ? "Não pagou" : "Em aberto"} · </span>
                          <span className="sr-only lg:hidden">{vencida ? "Não pagou" : "Em aberto"}</span> {reais(aberto)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-700">Em dia</span>
                      )}
                    </td>
                    <td data-c="x" className="px-4 py-3 text-stone-600">{c.pedidos[0] ? formatarDataCurta(c.pedidos[0].dataEntrega) : "—"}</td>
                    <td data-c="x" className="px-4 py-3">
                      {!c.usuario ? (
                        <span className="text-stone-500">sem app</span>
                      ) : !c.usuario.ativo ? (
                        <span className="text-stone-500">bloqueado</span>
                      ) : c.usuario.bloqueadoAte && c.usuario.bloqueadoAte > new Date() ? (
                        <span className="text-red-700">senha errada (travado)</span>
                      ) : (
                        <span className="text-marca-700">ativo</span>
                      )}
                      <span className="block text-xs text-stone-500">{c.usuario?.ultimoAcesso ? `visto ${formatarDataCurta(c.usuario.ultimoAcesso)}` : "nunca entrou"}</span>
                    </td>
                  </tr>
                );
              })}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-500">Nenhum cliente ainda. Toque em &quot;Cliente novo&quot; pra cadastrar o primeiro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
