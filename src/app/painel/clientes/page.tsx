import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { condicaoPagamento } from "@/lib/constantes";
import { diaISO, formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { reais } from "@/lib/formato";

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

  return (
    <>
      <Cabecalho titulo="Clientes" subtitulo="Restaurantes, lancherias, padarias e confeitarias de Porto Alegre e região. Só quem a Santimelo libera entra no app.">
        <Link href="/painel/clientes/novo" className="botao-primario px-5 py-2.5">
          <Plus className="size-4" /> Novo cliente
        </Link>
      </Cabecalho>
      <div className="grid gap-6 [&>*]:min-w-0">
        <section className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Onde</th>
                <th className="px-4 py-3">Pagamento</th>
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
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/painel/clientes/${c.id}`} className="font-medium text-marca-800 hover:underline">{c.nomeFantasia}</Link>
                      <span className="block text-xs text-stone-500">
                        {c.tipoNegocio} · <span className="font-mono">{c.usuario?.codigoAcesso ?? "sem app"}</span> · {c.responsavel ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.bairro ?? "—"}
                      <span className="block text-xs text-stone-500">{c.cidade ?? "—"} · {c.regiao?.nome ?? <span className="text-amber-700">sem região</span>}</span>
                    </td>
                    <td className="px-4 py-3">
                      {condicaoPagamento(c.prazoPagamentoDias)}
                      <span className="block text-xs text-stone-500">
                        {c.formaPagamento ?? "—"} · <span className={c.notaFiscal ? "font-semibold text-marca-700" : ""}>{c.notaFiscal ? "com NF" : "sem NF"}</span>
                      </span>
                    </td>
                    <td className={`tabular px-4 py-3 text-right ${vencida ? "font-semibold text-red-700" : ""}`}>{aberto ? reais(aberto) : "—"}</td>
                    <td className="px-4 py-3 text-stone-600">{c.pedidos[0] ? formatarDataCurta(c.pedidos[0].dataEntrega) : "—"}</td>
                    <td className="px-4 py-3">
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
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhum cliente ainda. Toque em &quot;Novo cliente&quot; pra cadastrar o primeiro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
