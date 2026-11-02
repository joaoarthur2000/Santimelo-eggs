import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/ui";
import { diaISO, formatarDataCurta } from "@/lib/datas";
import { db } from "@/lib/db";
import { reais } from "@/lib/formato";
import { linkDoApp } from "@/lib/rede";
import { FormDarAcesso } from "../forms";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesEggs() {
  const hoje = diaISO();
  const [clientes, outros, regioes] = await Promise.all([
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
    db.cliente.findMany({ where: { usuario: null, ativo: true }, orderBy: { nomeFantasia: "asc" }, select: { id: true, nomeFantasia: true } }),
    db.regiao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <Cabecalho titulo="Clientes" subtitulo="Só quem a Santimelo libera entra no app. Cada cliente tem região, prazo de pagamento e preço combinado." />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px] [&>*]:min-w-0">
        <section className="cartao overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Região</th>
                <th className="px-4 py-3">Prazo</th>
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
                        <span className="font-mono">{c.usuario?.codigoAcesso ?? "sem código"}</span> · {c.responsavel ?? "—"} · {c._count.pedidos} pedidos pelo app
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.regiao?.nome ?? <span className="text-amber-700">definir</span>}</td>
                    <td className="px-4 py-3">{c.prazoPagamentoDias ? `${c.prazoPagamentoDias} dias` : "na entrega"}</td>
                    <td className={`tabular px-4 py-3 text-right ${vencida ? "font-semibold text-red-700" : ""}`}>{aberto ? reais(aberto) : "—"}</td>
                    <td className="px-4 py-3 text-stone-600">{c.pedidos[0] ? formatarDataCurta(c.pedidos[0].dataEntrega) : "—"}</td>
                    <td className="px-4 py-3">
                      {!c.usuario?.ativo ? (
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
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhum cliente no EGGS ainda. Libere o primeiro ao lado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <aside className="cartao h-fit p-5">
          <h2 className="mb-1 font-semibold text-marca-950">Liberar o app pra um cliente</h2>
          <p className="mb-4 text-xs text-stone-500">Gera um código de acesso e uma senha só dele, pra passar pro cliente.{regioes.length === 0 && " Crie uma região na aba Entregas antes, pra ele poder agendar."}</p>
          <FormDarAcesso regioes={regioes.map((r) => ({ id: r.id, nome: r.nome }))} clientes={outros.map((c) => ({ id: c.id, nome: c.nomeFantasia }))} linkApp={linkDoApp()} />
        </aside>
      </div>
    </>
  );
}
