import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, PackageMinus, SlidersHorizontal } from "lucide-react";
import { Codigo, Vazio } from "@/components/ui";
import { ORIGENS_COMPRA } from "@/lib/constantes";
import { diaISO, formatarDataCurta, formatarHora, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, reais } from "@/lib/formato";
import { ExcluirLancamento } from "./editar";
import { abrev, qtd, redondo } from "./util";

const TIPOS = {
  COMPRA: { rotulo: "Entrada", icone: ArrowDownToLine, cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  VENDA: { rotulo: "Venda", icone: ArrowUpFromLine, cor: "bg-sky-50 text-sky-700 ring-sky-600/15" },
  PERDA: { rotulo: "Saída / perda", icone: PackageMinus, cor: "bg-red-50 text-red-700 ring-red-600/15" },
  AJUSTE: { rotulo: "Ajuste", icone: SlidersHorizontal, cor: "bg-stone-100 text-stone-600 ring-stone-500/15" },
} as const;
const PERIODOS = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", tudo: "Tudo" } as const;

export async function AbaMovimentos({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const tipo = typeof sp.tipo === "string" && sp.tipo in TIPOS ? (sp.tipo as keyof typeof TIPOS) : undefined;
  const itemId = typeof sp.item === "string" && sp.item ? sp.item : undefined;
  const periodo = typeof sp.periodo === "string" && sp.periodo in PERIODOS ? (sp.periodo as keyof typeof PERIODOS) : "30";
  const desde = periodo === "tudo" ? undefined : inicioDoDia(somarDias(diaISO(), -(Number(periodo) - 1)));

  const [itens, movimentos] = await Promise.all([
    db.item.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true, codigo: true } }),
    db.movimentoEstoque.findMany({
      where: { ...(tipo && { tipo }), ...(itemId && { itemId }), ...(desde && { data: { gte: desde } }) },
      include: { item: true, pedido: { select: { id: true, cliente: { select: { nomeFantasia: true } } } } },
      orderBy: { data: "desc" },
      take: 500,
    }),
  ]);
  const entradas = movimentos.filter((m) => m.quantidade > 0).reduce((t, m) => t + m.quantidade, 0);
  const saidas = movimentos.filter((m) => m.quantidade < 0).reduce((t, m) => t - m.quantidade, 0);
  const comprado = movimentos.filter((m) => m.tipo === "COMPRA" && m.custoUnit !== null).reduce((t, m) => t + m.quantidade * m.custoUnit!, 0);

  return (
    <section className="cartao overflow-hidden">
      <form className="flex flex-wrap items-end gap-3 border-b border-stone-100 p-4 max-lg:[&>label]:flex-[1_1_42%] max-lg:[&_select]:w-full">
        <input type="hidden" name="aba" value="movimentos" />
        <label className="text-xs font-medium text-stone-500">
          Tipo
          <select name="tipo" defaultValue={tipo ?? ""} className="campo mt-1 w-44">
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([k, t]) => (
              <option key={k} value={k}>{t.rotulo}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-500">
          Produto
          <select name="item" defaultValue={itemId ?? ""} className="campo mt-1 w-52">
            <option value="">Todos</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>{i.codigo} {i.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-500">
          Período
          <select name="periodo" defaultValue={periodo} className="campo mt-1 w-44">
            {Object.entries(PERIODOS).map(([k, r]) => (
              <option key={k} value={k}>{r}</option>
            ))}
          </select>
        </label>
        <button className="botao-secundario">Filtrar</button>
        <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-right text-xs max-lg:ml-0 max-lg:w-full max-lg:justify-between max-lg:text-left">
          <div>
            <dt className="text-stone-400">Entrou</dt>
            <dd className="tabular text-base font-semibold text-emerald-700">+{num(redondo(entradas))} cx</dd>
          </div>
          <div>
            <dt className="text-stone-400">Saiu</dt>
            <dd className="tabular text-base font-semibold text-stone-800">−{num(redondo(saidas))} cx</dd>
          </div>
          <div>
            <dt className="text-stone-400">Comprado</dt>
            <dd className="tabular text-base font-semibold text-stone-800">{reais(comprado)}</dd>
          </div>
        </dl>
      </form>

      {movimentos.length === 0 ? (
        <div className="p-5">
          <Vazio>Nenhuma movimentação nesse filtro.</Vazio>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="lista-cel w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-[11px] text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3">De / para</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Detalhe</th>
                <th className="w-px px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {movimentos.map((m) => {
                const t = TIPOS[m.tipo as keyof typeof TIPOS] ?? TIPOS.AJUSTE;
                const Icone = t.icone;
                return (
                  <tr key={m.id}>
                    <td data-c="s" className="tabular order-2 px-4 py-3 whitespace-nowrap text-stone-600">
                      {formatarDataCurta(m.data)} <span className="text-stone-400">{formatarHora(m.data)}</span>
                    </td>
                    <td data-c="l" className="order-3 px-4 py-3">
                      <span className={`etiqueta ring-1 ring-inset ${t.cor}`}>
                        <Icone className="size-3" /> {t.rotulo}
                      </span>
                    </td>
                    <td data-c="t" className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Codigo codigo={m.item.codigo} /> {m.item.nome}
                      </span>
                    </td>
                    <td data-c="v" className={`tabular px-4 py-3 text-right font-semibold whitespace-nowrap ${m.quantidade > 0 ? "text-emerald-700" : "text-stone-800"}`}>
                      {m.quantidade > 0 ? "+" : "−"}
                      {qtd(Math.abs(m.quantidade), m.item.unidadeEstoque)}
                    </td>
                    <td data-c="s" className="order-4 px-4 py-3 text-stone-600">
                      {m.pedido ? (
                        <Link href={`/painel/pedidos/${m.pedido.id}`} className="font-medium text-marca-700 hover:underline">
                          #{m.pedido.id} · {m.pedido.cliente.nomeFantasia}
                        </Link>
                      ) : (
                        (m.fornecedor ?? (m.origem ? ORIGENS_COMPRA[m.origem as keyof typeof ORIGENS_COMPRA] ?? m.origem : "—"))
                      )}
                      {m.pedido && m.fornecedor && <span className="block text-xs text-stone-400">de {m.fornecedor}</span>}
                    </td>
                    <td data-c={m.custoUnit === null ? "x" : "l"} className="tabular order-5 px-4 py-3 text-right whitespace-nowrap text-stone-700">
                      {m.custoUnit !== null ? (
                        <>
                          {reais(m.quantidade * m.custoUnit)}
                          <span className="block text-xs text-stone-400">{reais(m.custoUnit)}/{abrev(m.item.unidadeEstoque)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-c={m.pedido ? "x" : undefined} className="order-6 max-w-64 px-4 py-3 text-xs text-stone-500 empty:hidden">
                      {[m.marca && `Marca ${m.marca}`, m.observacao, m.autor].filter(Boolean).join(" · ")}
                    </td>
                    <td data-c="x" className="px-2 py-3 text-right">{["COMPRA", "PERDA", "AJUSTE"].includes(m.tipo) && <ExcluirLancamento id={m.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {movimentos.length === 500 && <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">Mostrando os 500 mais recentes. Use os filtros pra ver mais antigos.</p>}
        </div>
      )}
    </section>
  );
}
