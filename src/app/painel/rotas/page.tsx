import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Map, MapPinOff, Plus } from "lucide-react";
import { Cabecalho, Etiqueta } from "@/components/ui";
import { STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaDaSemana, diaISO, diaValido, formatarDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { num, reais } from "@/lib/formato";
import { configRota, custoDaRota, linkGoogleMaps, paradasDoDia } from "@/lib/rota";
import { salvarKmReal } from "./actions";
import { BotaoGerarRota, FormConfigRota } from "./forms";

export const metadata: Metadata = { title: "Rotas" };

const cx = (v: number) => `${num(Math.round(v * 10) / 10)} cx`;
const km = (v: number) => `${num(Math.round(v * 10) / 10)} km`;
const curto = (dia: string) => formatarDia(dia, { weekday: "short", day: "2-digit", month: "2-digit" });

export default async function Rotas({ searchParams }: PageProps<"/painel/rotas">) {
  const dia = diaValido((await searchParams).dia);
  const segunda = somarDias(dia, -((diaDaSemana(dia) + 6) % 7));
  const semana = Array.from({ length: 6 }, (_, i) => somarDias(segunda, i)); // segunda a sábado

  const [config, rotasSemana, paradasSemana] = await Promise.all([
    configRota(),
    db.rotaDia.findMany({ where: { dia: { gte: semana[0], lte: semana[5] } } }),
    Promise.all(semana.map((d) => paradasDoDia(d))),
  ]);
  const i = semana.indexOf(dia);
  const paradas = i >= 0 ? paradasSemana[i] : await paradasDoDia(dia);
  const rota = rotasSemana.find((r) => r.dia === dia) ?? (i < 0 ? await db.rotaDia.findUnique({ where: { dia } }) : null);

  // Paradas na ordem da rota (se a rota ainda bate com as entregas do dia)
  const ordem = rota?.ordem.split(",").filter(Boolean) ?? [];
  // Quem não foi achado no mapa fica fora da rota (no fim da lista, com aviso): não conta como mudança
  const localizadas = paradas.filter((p) => p.lat !== null && p.lng !== null);
  const desatualizada = !!rota && (localizadas.some((p) => !ordem.includes(p.clienteId)) || ordem.some((id) => !paradas.find((p) => p.clienteId === id)));
  const posicao = (id: string) => (ordem.includes(id) ? ordem.indexOf(id) : ordem.length);
  const ordenadas = rota && !desatualizada ? [...paradas].sort((a, b) => posicao(a.clienteId) - posicao(b.clienteId)) : paradas;
  const custo = rota ? custoDaRota(rota) : null;
  const caixasDia = paradas.reduce((s, p) => s + p.caixas, 0);
  const mapa = rota && !desatualizada ? linkGoogleMaps(config.saida, ordenadas.filter((p) => p.lat !== null && p.lng !== null) as { lat: number; lng: number }[]) : null;

  // Resumo da semana
  const somaSemana = rotasSemana.reduce(
    (s, r) => {
      const c = custoDaRota(r);
      return { km: s.km + c.km, litros: s.litros + c.litros, custo: s.custo + c.custo };
    },
    { km: 0, litros: 0, custo: 0 },
  );
  const entregasSemana = paradasSemana.reduce((s, p) => s + p.length, 0);
  const caixasSemana = paradasSemana.reduce((s, p) => s + p.reduce((t, x) => t + x.caixas, 0), 0);

  return (
    <>
      <Cabecalho titulo="Rotas e entregas" subtitulo="As entregas de cada dia saem dos pedidos. Gere a rota: ordem das paradas, km e combustível da Fiorino.">
        <Link href={`/painel/pedidos/novo?dia=${dia}`} className="botao-primario">
          <Plus className="size-4" /> Adicionar entrega
        </Link>
      </Cabecalho>

      {/* Semana */}
      <nav className="mb-6 flex items-stretch gap-2 overflow-x-auto pb-1">
        <Link href={`/painel/rotas?dia=${somarDias(segunda, -7)}`} className="botao-secundario shrink-0 px-2" aria-label="Semana anterior">
          <ChevronLeft className="size-4" />
        </Link>
        {semana.map((d, n) => {
          const p = paradasSemana[n];
          const r = rotasSemana.find((x) => x.dia === d);
          const ativo = d === dia;
          return (
            <Link
              key={d}
              href={`/painel/rotas?dia=${d}`}
              className={`min-w-28 flex-1 rounded-xl px-3 py-2 text-sm transition ${ativo ? "bg-marca-900 text-white" : "bg-white ring-1 ring-stone-200 hover:ring-marca-400"} ${d === diaISO() && !ativo ? "ring-2 ring-gema-400" : ""}`}
            >
              <span className="block font-semibold first-letter:uppercase">{curto(d)}</span>
              <span className={`block text-xs ${ativo ? "text-marca-100" : "text-stone-500"}`}>
                {p.length ? `${p.length} entregas · ${cx(p.reduce((s, x) => s + x.caixas, 0))}` : "sem entregas"}
              </span>
              <span className={`block text-xs ${ativo ? "text-gema-300" : "text-marca-700"}`}>{r ? km(custoDaRota(r).km) : p.length ? "sem rota" : ""}</span>
            </Link>
          );
        })}
        <Link href={`/painel/rotas?dia=${somarDias(segunda, 7)}`} className="botao-secundario shrink-0 px-2" aria-label="Próxima semana">
          <ChevronRight className="size-4" />
        </Link>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <section className="cartao p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-marca-950 first-letter:uppercase">{formatarDia(dia)}</h2>
              <p className="text-sm text-stone-500">{paradas.length} entregas · {cx(caixasDia)} · {reais(paradas.reduce((s, p) => s + p.total, 0))}</p>
            </div>
            {paradas.length > 0 && <BotaoGerarRota dia={dia} jaTem={!!rota} />}
          </div>

          {desatualizada && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">As entregas mudaram depois da rota. Gere de novo pra atualizar a ordem e os km.</p>}

          {rota && custo && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Km rodados", km(custo.km), custo.real ? "do hodômetro" : `calculado · ${km(rota.kmPlanejado)}`],
                ["Tempo dirigindo", `${Math.floor(rota.minutos / 60)}h${String(Math.round(rota.minutos % 60)).padStart(2, "0")}`, "sem contar as paradas"],
                ["Combustível", `${num(Math.round(custo.litros * 10) / 10)} L`, `${num(rota.consumoKmL)} km/l`],
                ["Gasto", reais(custo.custo), `${reais(rota.precoLitro)}/L`],
                ["Por caixa", caixasDia ? reais(custo.custo / caixasDia) : "—", "combustível ÷ caixas"],
              ].map(([r, v, d]) => (
                <div key={r} className="rounded-xl bg-stone-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{r}</p>
                  <p className="tabular text-xl font-bold text-marca-950">{v}</p>
                  <p className="text-xs text-stone-500">{d}</p>
                </div>
              ))}
            </div>
          )}

          {rota && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {mapa && (
                <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                  <Map className="size-4" /> Abrir a rota no Google Maps
                </a>
              )}
              <form action={salvarKmReal.bind(null, dia)} className="flex items-end gap-2">
                <label className="text-xs text-stone-500">
                  Km do hodômetro no fim do dia
                  <input name="km" inputMode="decimal" defaultValue={rota.kmReal ? String(rota.kmReal).replace(".", ",") : ""} placeholder={String(rota.kmPlanejado).replace(".", ",")} className="campo mt-1 w-32" />
                </label>
                <button className="botao-secundario">Salvar km</button>
              </form>
            </div>
          )}

          <ol className="mt-5 divide-y divide-stone-100">
            {config.saida && rota && !desatualizada && <li className="py-2 text-sm text-stone-500">🏁 Saída: {config.saida.endereco}</li>}
            {ordenadas.map((p, n) => (
              <li key={p.clienteId} className="flex gap-3 py-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rota && !desatualizada && ordem.includes(p.clienteId) ? "bg-gema-400 text-casca-900" : "bg-stone-100 text-stone-500"}`}>
                  {rota && !desatualizada && !ordem.includes(p.clienteId) ? "?" : n + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Link href={`/painel/clientes/${p.clienteId}`} className="font-semibold text-marca-900 hover:underline">{p.nome}</Link>
                    <span className="text-sm font-semibold">{p.horario}</span>
                  </div>
                  <p className="text-sm text-stone-600">
                    {[p.endereco, p.bairro, p.cidade].filter(Boolean).join(" · ")}
                    {p.lat === null && <span className="ml-1 inline-flex items-center gap-1 text-xs text-amber-700"><MapPinOff className="size-3" /> não localizado no mapa: fora da rota, confira o endereço na ficha</span>}
                  </p>
                  <p className="mt-0.5 text-sm">
                    <b>{cx(p.caixas)}</b> · {p.itens.join(" · ")}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {p.pedidos.map((id, k) => (
                      <Link key={id} href={`/painel/pedidos/${id}`} className="hover:underline">
                        <Etiqueta status={p.status[k]}>#{id} · {STATUS_PEDIDO[p.status[k] as StatusPedido]}</Etiqueta>
                      </Link>
                    ))}
                  </p>
                </div>
              </li>
            ))}
            {config.saida && rota && !desatualizada && <li className="py-2 text-sm text-stone-500">🏁 Volta: {config.saida.endereco}</li>}
            {paradas.length === 0 && <li className="py-8 text-center text-stone-500">Nenhuma entrega nesse dia. Pedidos do app e do painel aparecem aqui sozinhos.</li>}
          </ol>
        </section>

        <aside className="grid content-start gap-6 [&>*]:min-w-0">
          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Semana de {curto(semana[0])} a {curto(semana[5])}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Entregas", num(entregasSemana)],
                ["Caixas", cx(caixasSemana)],
                ["Km", km(somaSemana.km)],
                ["Combustível", `${num(Math.round(somaSemana.litros * 10) / 10)} L`],
                ["Gasto", reais(somaSemana.custo)],
                ["Por caixa", caixasSemana ? reais(somaSemana.custo / caixasSemana) : "—"],
              ].map(([r, v]) => (
                <div key={r}>
                  <dt className="text-xs text-stone-500">{r}</dt>
                  <dd className="tabular text-lg font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-stone-500">Só conta os dias com rota gerada. Com o km do hodômetro anotado, vale o real.</p>
          </section>
          <section className="cartao p-5">
            <h2 className="mb-3 font-semibold text-marca-950">Carro e saída</h2>
            <FormConfigRota saida={config.saida?.endereco ?? null} consumo={config.consumo} preco={config.precoLitro} />
          </section>
        </aside>
      </div>
    </>
  );
}
