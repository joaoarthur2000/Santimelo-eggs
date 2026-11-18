import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Clock3, Egg, Wallet } from "lucide-react";
import { Codigo } from "@/components/ui";
import { categoriaDoItem } from "@/lib/constantes";
import { diaISO, fimDoDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { custosMedios, estoquePorFornecedor, saldos } from "@/lib/estoque";
import { num, reais } from "@/lib/formato";
import { FormMovimento } from "./forms";
import { EditarEstoque } from "./editar";
import { abrev, OVOS_POR_CAIXA, qtd, redondo } from "./util";

const DIAS_BAIXO = 3; // menos que isso de cobertura = "Acabando"

export async function AbaAtual() {
  const hoje = diaISO();
  const agora = fimDoDia(hoje);
  const inicio7 = inicioDoDia(somarDias(hoje, -6));

  const [itens, saldo, custo, mov7, porFornecedor, fornecedores] = await Promise.all([
    db.item.findMany({ orderBy: { ordem: "asc" } }),
    saldos(agora),
    custosMedios(agora),
    db.movimentoEstoque.groupBy({ by: ["itemId", "tipo"], where: { data: { gte: inicio7, lt: agora }, tipo: { in: ["COMPRA", "VENDA"] } }, _sum: { quantidade: true } }),
    estoquePorFornecedor(),
    db.fornecedor.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);
  const soma7 = (itemId: string, tipo: string) => Math.abs(mov7.find((m) => m.itemId === itemId && m.tipo === tipo)?._sum.quantidade ?? 0);
  const nomeFornecedor = new Map(fornecedores.map((f) => [f.id, f.nome]));

  // ativos sempre aparecem; inativos só se ainda tiverem saldo
  const linhas = itens
    .filter((i) => i.ativo || Math.abs(saldo.get(i.id) ?? 0) > 0.001)
    .map((i) => {
      const s = saldo.get(i.id) ?? 0;
      const saidaDia = soma7(i.id, "VENDA") / 7;
      const c = custo.get(i.id) ?? null;
      const fornecedoresDoItem = [...porFornecedor]
        .filter(([chave, v]) => chave.endsWith(`|${i.id}`) && Math.abs(v.saldo) > 0.001)
        .map(([chave, v]) => {
          const id = chave.split("|")[0];
          return { id, nome: nomeFornecedor.get(id) ?? "Fornecedor inativo", saldo: v.saldo };
        })
        .sort((a, b) => b.saldo - a.saldo);
      return {
        item: i,
        saldo: s,
        custo: c,
        valor: s > 0 && c !== null ? s * c : 0,
        saidaDia,
        entrou7: soma7(i.id, "COMPRA"),
        cobertura: saidaDia > 0 ? s / saidaDia : null,
        fornecedores: fornecedoresDoItem,
      };
    });

  const ovos = linhas.filter((l) => l.item.unidadeEstoque === "caixa");
  const caixas = ovos.reduce((t, l) => t + Math.max(0, l.saldo), 0);
  const valorTotal = linhas.reduce((t, l) => t + l.valor, 0);
  const saidaDiaTotal = ovos.reduce((t, l) => t + l.saidaDia, 0);
  const duraTotal = saidaDiaTotal > 0 ? caixas / saidaDiaTotal : null;
  const entrou7 = ovos.reduce((t, l) => t + l.entrou7, 0);
  const saiu7 = ovos.reduce((t, l) => t + l.saidaDia * 7, 0);

  return (
    <>
      {/* Número grande: quanto tem agora */}
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#2b1c15_0%,#402924_60%,#4a2f22_100%)] p-6 text-white shadow-flutua sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-ouro/20 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ouro uppercase">
              <span className="size-1.5 rounded-full bg-ouro" /> Estoque atual
            </p>
            <p className="tabular mt-3 flex items-baseline gap-3">
              <span className="text-6xl leading-none font-semibold tracking-[-0.04em] sm:text-7xl">{num(redondo(caixas))}</span>
              <span className="text-xl font-medium text-white/70">{redondo(caixas) === 1 ? "caixa" : "caixas"}</span>
            </p>
            <p className="tabular mt-2 text-sm text-white/55">
              ≈ {num(Math.round(caixas * OVOS_POR_CAIXA))} ovos · {ovos.filter((l) => l.saldo > 0.001).length} de {ovos.length} tipos com estoque
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              { rotulo: "Valor parado", valor: reais(valorTotal), icone: Wallet, nota: "pelo custo médio" },
              { rotulo: "Dá pra quantos dias", valor: duraTotal === null ? "—" : duraTotal < 0.5 ? "acabando" : `${num(Math.round(duraTotal))} dias`, icone: Clock3, nota: "pela venda dos últimos 7 dias" },
              { rotulo: "Entrou (7 dias)", valor: `${num(redondo(entrou7))} cx`, icone: ArrowDownToLine, nota: "compras" },
              { rotulo: "Saiu (7 dias)", valor: `${num(redondo(saiu7))} cx`, icone: ArrowUpFromLine, nota: "vendas entregues" },
            ].map(({ rotulo, valor, icone: Icone, nota }) => (
              <div key={rotulo} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 ring-inset">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/55 uppercase">
                  <Icone className="size-3.5" /> {rotulo}
                </dt>
                <dd className="tabular mt-1.5 text-xl font-semibold tracking-tight">{valor}</dd>
                <dd className="text-[11px] text-white/40">{nota}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        {/* Um cartão por tipo de ovo, com o número grande e o botão Editar */}
        <section className="grid content-start gap-4 2xl:grid-cols-2">
          {linhas.map((l) => {
            const un = l.item.unidadeEstoque;
            const situacao =
              l.saldo <= 0.001
                ? { rotulo: l.saldo < -0.001 ? "Negativo" : "Sem estoque", cor: "bg-red-50 text-red-700 ring-red-600/15" }
                : l.cobertura !== null && l.cobertura < DIAS_BAIXO
                  ? { rotulo: "Acabando", cor: "bg-amber-50 text-amber-800 ring-amber-600/20" }
                  : { rotulo: "Em estoque", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" };
            return (
              <article key={l.item.id} className="cartao flex flex-col p-5">
                <header className="flex items-start justify-between gap-3">
                  <h3 className="flex min-w-0 items-center gap-2 font-semibold text-marca-950">
                    <Codigo codigo={l.item.codigo} />
                    <span className="truncate">{l.item.nome}</span>
                  </h3>
                  <span className={`etiqueta shrink-0 ring-1 ring-inset ${situacao.cor}`}>{situacao.rotulo}</span>
                </header>

                <p className="tabular mt-4 flex items-baseline gap-2">
                  <span className={`text-4xl leading-none font-semibold tracking-[-0.03em] ${l.saldo < -0.001 ? "text-red-700" : "text-marca-950"}`}>{num(redondo(l.saldo))}</span>
                  <span className="text-sm font-medium text-stone-500">{abrev(un)}</span>
                  {un === "caixa" && l.saldo > 0 && <span className="ml-auto flex items-center gap-1 text-xs text-stone-400"><Egg className="size-3.5" /> {num(Math.round(l.saldo * OVOS_POR_CAIXA))} ovos</span>}
                </p>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-xs">
                  <div>
                    <dt className="text-stone-400">Custo médio</dt>
                    <dd className="tabular mt-0.5 font-medium text-stone-800">{l.custo !== null ? reais(l.custo) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Valor</dt>
                    <dd className="tabular mt-0.5 font-medium text-stone-800">{l.valor ? reais(l.valor) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Dura</dt>
                    <dd className="tabular mt-0.5 font-medium text-stone-800">{l.cobertura === null ? "—" : l.cobertura <= 0 ? "acabou" : `${num(Math.round(l.cobertura))} dias`}</dd>
                  </div>
                </dl>

                {l.fornecedores.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {l.fornecedores.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-stone-600">{f.nome}</span>
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100">
                          <span className="block h-full origin-left rounded-full bg-ouro" style={{ transform: `scaleX(${l.saldo > 0 ? Math.max(0, Math.min(1, f.saldo / l.saldo)) : 0})` }} />
                        </span>
                        <span className={`tabular w-14 text-right font-medium ${f.saldo < 0 ? "text-red-700" : "text-stone-800"}`}>{qtd(f.saldo, un)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <footer className="mt-auto flex items-center justify-between gap-2 pt-5">
                  <EditarEstoque item={{ id: l.item.id, nome: l.item.nome }} saldo={l.saldo} abrev={abrev(un)} fornecedores={l.fornecedores} hoje={hoje} />
                  <Link href={`/painel/estoque?aba=movimentos&item=${l.item.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-marca-700 transition-colors hover:text-marca-950">
                    Extrato <ArrowRight className="size-3.5" />
                  </Link>
                </footer>
              </article>
            );
          })}
          {linhas.length === 0 && <p className="text-sm text-stone-500">Nenhum tipo de ovo cadastrado.</p>}
        </section>

        <aside className="space-y-6">
          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Lançar entrada</h2>
            <p className="mt-0.5 mb-4 text-xs text-stone-500">Compra que chegou, perda ou contagem. Pode ser de dias atrás.</p>
            <FormMovimento
              hoje={hoje}
              fornecedores={fornecedores}
              itens={itens.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo, unidade: i.unidadeEstoque, categoria: categoriaDoItem(i.unidadeEstoque) }))}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
