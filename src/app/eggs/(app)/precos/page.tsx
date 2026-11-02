import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { GraficoLinhas } from "@/components/grafico-linhas";
import { diaISO, formatarDia, somarDias } from "@/lib/datas";
import { produtosDoCliente } from "@/lib/eggs";
import { reais } from "@/lib/formato";
import { exigirCliente } from "@/lib/sessao";
import { Ovo, SeloPreco, tipoDoOvo } from "../enfeites";
import { TituloEggs } from "../../guinho";

export const metadata: Metadata = { title: "Preços" };

const UN: Record<string, string> = { caixa: "caixa", bandeja: "bandeja", duzia: "dúzia" };

/** Quantos ovos tem uma unidade vendida (caixa = 360) */
function ovosPorUnidade(p: { unidade: string; embalagem: string }) {
  if (p.unidade === "caixa") return 360;
  const un = p.embalagem.match(/(\d+) un/);
  return un ? Number(un[1]) : null;
}

export default async function PrecosEggs() {
  const { cliente } = await exigirCliente();
  const produtos = await produtosDoCliente(cliente.id);
  const hoje = diaISO();

  // Gráfico dos últimos 90 dias: preço que valia em cada semana + os já agendados
  const semanas = Array.from({ length: 14 }, (_, i) => somarDias(hoje, -91 + i * 7)).concat(hoje);

  return (
    <>
      <TituloEggs pose="comemorando">Preços</TituloEggs>
      <p className="mt-1 text-sm text-casca-700">Já com tudo incluso. Mudança de preço aparece aqui antes de valer.</p>

      <ul className="mt-5 space-y-4">
        {produtos.map((p, n) => {
          const ovos = ovosPorUnidade(p);
          const precoEm = (dia: string) => [...p.historico].reverse().find((h) => h.dia <= dia)?.preco ?? p.historico[0]?.preco ?? p.precoTabela;
          const dados = p.negociado
            ? []
            : [...semanas.map((d) => ({ dia: formatarDia(d, { day: "2-digit", month: "2-digit" }), preco: precoEm(d) })), ...p.proximos.map((a) => ({ dia: formatarDia(a.aPartirDe, { day: "2-digit", month: "2-digit" }), preco: a.preco }))];
          return (
            <li key={p.id} className="eggs-entra cartao-eggs" style={{ "--i": Math.min(n, 6) } as React.CSSProperties}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Ovo tipo={tipoDoOvo(p.item)} className="size-14 shrink-0" />
                  <div>
                    <p className="font-eggs text-xl font-extrabold leading-tight">{p.item}</p>
                    <p className="text-sm text-casca-700">{p.embalagem}</p>
                  </div>
                </div>
                <SeloPreco valor={p.preco} unidade={UN[p.unidade] ?? p.unidade} />
              </div>
              {ovos && (
                <p className="tabular mt-2 text-sm text-casca-700">
                  {reais((p.preco / ovos) * 12)} a dúzia · {reais(p.preco / ovos)} o ovo
                </p>
              )}
              {p.negociado && <p className="mt-2 rounded-2xl bg-gema-100 px-3 py-2 text-sm font-semibold">Preço combinado com você. Não muda com a tabela.</p>}
              {p.proximos.map((a) => (
                <p key={a.aPartirDe} className="mt-2 flex items-center gap-2 rounded-2xl bg-gema-400/40 px-3 py-2 text-sm font-semibold">
                  <CalendarClock className="size-4 shrink-0" />
                  A partir de {formatarDia(a.aPartirDe, { weekday: "long", day: "2-digit", month: "2-digit" })}: {reais(a.preco)}
                </p>
              ))}
              {/* Gráfico só quando o preço mexeu ou vai mexer; estável é só uma linha de texto */}
              {!p.negociado && new Set(dados.map((x) => x.preco)).size === 1 && <p className="mt-2 text-sm font-semibold text-green-800">✦ Preço estável nos últimos 90 dias</p>}
              {new Set(dados.map((x) => x.preco)).size > 1 && (
                <div className="mt-3">
                  <GraficoLinhas dados={dados} categoria="dia" series={[{ chave: "preco", rotulo: "Preço nos últimos 90 dias", cor: "#a86f00" }]} altura={150} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
