import type { Metadata } from "next";
import { Cabecalho } from "@/components/ui";
import { DIAS_SEMANA } from "@/lib/constantes";
import { diaDaSemana, formatarDia } from "@/lib/datas";
import { db } from "@/lib/db";
import { agendaDaRegiao } from "@/lib/eggs";
import { alternarJanela } from "../actions";
import { FormNovaJanela, FormNovaRegiao } from "../forms";

export const metadata: Metadata = { title: "Entregas de ovos" };

export default async function EntregasOvos() {
  const regioes = await db.regiao.findMany({
    include: { janelas: { orderBy: [{ diaSemana: "asc" }, { inicio: "asc" }] }, _count: { select: { clientes: true } } },
    orderBy: { nome: "asc" },
  });
  const agendas = await Promise.all(regioes.map((r) => agendaDaRegiao(r.id, 7)));

  return (
    <>
      <Cabecalho titulo="Entregas" explica subtitulo="Regiões, dias e horários em que o caminhão passa. É o que o cliente vê na agenda do app e escolhe ao pedir." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-6">
          {regioes.map((r, i) => (
            <section key={r.id} className="cartao p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-marca-950">{r.nome}</h2>
                <span className="text-sm text-stone-500">{r._count.clientes} clientes{r.bairros && ` · ${r.bairros}`}</span>
              </div>
              <ul className="mb-4 flex flex-wrap gap-2 text-sm">
                {r.janelas.map((j) => (
                  <li key={j.id} className={`flex items-center gap-2 rounded-full py-1 pl-3 pr-1 ring-1 max-lg:w-full max-lg:justify-between max-lg:rounded-xl max-lg:py-0 ${j.ativo ? "bg-marca-50 ring-marca-200" : "bg-stone-100 text-stone-400 ring-stone-200"}`}>
                    {DIAS_SEMANA[j.diaSemana].slice(0, 3)} {j.inicio}–{j.fim} · {j.capacidade} vagas
                    <form action={alternarJanela.bind(null, j.id)}>
                      <button className="rounded-full px-2 text-xs text-stone-500 hover:bg-white max-lg:min-h-11 max-lg:px-3 max-lg:font-medium max-lg:text-marca-700">{j.ativo ? "pausar" : "ativar"}</button>
                    </form>
                  </li>
                ))}
                {r.janelas.length === 0 && <li className="text-stone-500">Nenhum horário ainda.</li>}
              </ul>
              <FormNovaJanela regiaoId={r.id} />
              {agendas[i].length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">Próximos 7 dias (vagas ocupadas)</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {agendas[i].map((d) => (
                      <li key={d.dia} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                        <span className="font-medium">
                          {DIAS_SEMANA[diaDaSemana(d.dia)].slice(0, 3)} {formatarDia(d.dia, { day: "2-digit", month: "2-digit" })}
                        </span>
                        {d.janelas.map((j) => (
                          <span key={j.id} className="tabular block text-xs text-stone-600">
                            {j.inicio}–{j.fim}: {j.capacidade - j.livres}/{j.capacidade}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
          {regioes.length === 0 && <p className="cartao p-8 text-center text-stone-500">Crie a primeira região ao lado.</p>}
        </div>
        <aside className="cartao h-fit p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Nova região</h2>
          <FormNovaRegiao />
        </aside>
      </div>
    </>
  );
}
