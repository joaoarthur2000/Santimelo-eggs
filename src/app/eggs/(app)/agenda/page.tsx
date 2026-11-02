import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { DIAS_SEMANA } from "@/lib/constantes";
import { diaDaSemana, diaISO, fimDoDia, formatarDia, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { agendaDaRegiao } from "@/lib/eggs";
import { exigirCliente } from "@/lib/sessao";
import { TituloEggs } from "../../guinho";
import { CalendarioEntregas } from "./calendario";

export const metadata: Metadata = { title: "Agenda de entregas" };

export default async function AgendaEggs() {
  const { cliente } = await exigirCliente();
  const amanha = somarDias(diaISO(), 1);
  const [agenda, janelas, meus] = await Promise.all([
    agendaDaRegiao(cliente.regiaoId),
    cliente.regiaoId ? db.janelaEntrega.findMany({ where: { regiaoId: cliente.regiaoId, ativo: true }, orderBy: [{ diaSemana: "asc" }, { inicio: "asc" }] }) : [],
    db.pedido.findMany({ where: { clienteId: cliente.id, status: { not: "CANCELADO" }, dataEntrega: { gte: inicioDoDia(amanha), lt: fimDoDia(somarDias(amanha, 14)) } }, select: { id: true, janelaId: true, dataEntrega: true } }),
  ]);
  const meuPedido = (dia: string, janelaId: string) => meus.find((p) => p.janelaId === janelaId && diaISO(p.dataEntrega) === dia);

  return (
    <>
      <TituloEggs pose="acenando">Agenda de entregas</TituloEggs>
      {cliente.regiao ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-casca-700">
          <MapPin className="size-4" /> Região {cliente.regiao.nome}
          {cliente.regiao.bairros && ` · ${cliente.regiao.bairros}`}
        </p>
      ) : (
        <p className="cartao-eggs mt-5 text-casca-700">Sua região de entrega ainda não foi definida. Fale com a Santimelo.</p>
      )}

      {janelas.length > 0 && (
        <section className="cartao-eggs mt-5">
          <h2 className="titulo-eggs">O caminhão passa na sua região</h2>
          <ul className="mt-2 space-y-1">
            {[...new Set(janelas.map((j) => j.diaSemana))].map((d) => (
              <li key={d} className="flex justify-between gap-3">
                <span className="font-semibold">{DIAS_SEMANA[d]}</span>
                <span className="tabular text-casca-700">{janelas.filter((j) => j.diaSemana === d).map((j) => `${j.inicio}–${j.fim}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cliente.regiao && (
        <>
          <h2 className="titulo-eggs mb-2 mt-6">Calendário</h2>
          <CalendarioEntregas diasEntrega={agenda.map((d) => d.dia)} diasPedido={meus.map((p) => diaISO(p.dataEntrega))} ate={somarDias(amanha, 13)} />
        </>
      )}

      <h2 className="titulo-eggs mb-2 mt-6">Próximos 14 dias</h2>
      <ul className="space-y-3">
        {agenda.map((d) => (
          <li key={d.dia} className="cartao-eggs">
            <p className="font-bold first-letter:uppercase">
              {DIAS_SEMANA[diaDaSemana(d.dia)]}, {formatarDia(d.dia, { day: "2-digit", month: "long" })}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {d.janelas.map((j) => {
                const meu = meuPedido(d.dia, j.id);
                return (
                  <li key={j.id} className={`rounded-2xl px-3 py-2 ${meu ? "bg-casca-900 text-gema-50" : j.livres === 0 ? "bg-casca-100 text-casca-500" : "bg-gema-50 ring-1 ring-casca-100"}`}>
                    <span className="block font-bold">{j.inicio} – {j.fim}</span>
                    <span className="text-xs">{meu ? `seu pedido #${meu.id}` : j.livres === 0 ? "lotado" : `${j.livres} de ${j.capacidade} vagas`}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {cliente.regiao && agenda.length === 0 && <li className="cartao-eggs text-casca-700">Nenhuma entrega programada nos próximos 14 dias.</li>}
      </ul>
      {agenda.length > 0 && (
        <Link href="/eggs/pedir" className="botao-eggs mt-5 w-full">Agendar um pedido</Link>
      )}
    </>
  );
}
