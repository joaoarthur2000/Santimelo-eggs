import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, TriangleAlert } from "lucide-react";
import { FormEmAberto, FormValoresCaixa } from "../rapido/form";
import { Cabecalho, Etiqueta } from "@/components/ui";
import { ASSINATURA_EGGS, condicaoPagamento, STATUS_PEDIDO, type StatusPedido } from "@/lib/constantes";
import { diaISO, fimDoDia, formatarDataCurta, inicioDoDia, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";
import { nomeProduto, num, reais } from "@/lib/formato";
import { linkDeAcesso, qrDeAcesso } from "@/lib/acesso";
import { linkDoApp } from "@/lib/rede";
import { alternarAcesso, desbloquear, marcarPago, salvarPrecoEspecial } from "../../actions";
import { BotaoLiberarApp, BotaoNovaSenha, FormCondicoes, FormDados, FormMensagem } from "../../forms";

export const metadata: Metadata = { title: "Cliente EGGS" };

export default async function ClienteEggs({ params }: PageProps<"/painel/clientes/[id]">) {
  const { id } = await params;
  const hoje = diaISO();
  const [cliente, regioes, produtos, vendas] = await Promise.all([
    db.cliente.findUnique({
      where: { id },
      include: {
        usuario: true,
        precosEspeciais: true,
        cobrancas: { orderBy: { vencimento: "desc" }, take: 20 },
        mensagens: { orderBy: { criadaEm: "desc" }, take: 10 },
        pedidos: { orderBy: { dataEntrega: "desc" }, take: 10, include: { janela: true } },
      },
    }),
    db.regiao.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { ativo: true }, include: { item: true }, orderBy: [{ item: { ordem: "asc" } }, { preco: "desc" }] }),
    // Vendas dos últimos 30 dias (pela entrega, sem cancelados)
    db.pedido.findMany({
      where: { clienteId: id, status: { not: "CANCELADO" }, dataEntrega: { gte: inicioDoDia(somarDias(diaISO(), -29)), lte: fimDoDia(diaISO()) } },
      include: { itens: { include: { produto: true } } },
    }),
  ]);
  if (!cliente) notFound();
  const login = cliente.usuario?.codigoAcesso;
  const qr = login ? await qrDeAcesso(login) : null;
  const faturado30 = vendas.reduce((s, p) => s + p.total, 0);
  const caixas30 = vendas.reduce((s, p) => s + p.itens.reduce((t, i) => t + i.quantidade * (i.produto.fatorEstoque ?? 0), 0), 0);
  const emAberto = cliente.cobrancas.filter((c) => !c.pagoEm).reduce((s, c) => s + c.valor, 0);
  const vencido = cliente.cobrancas.filter((c) => !c.pagoEm && c.vencimento < hoje).reduce((s, c) => s + c.valor, 0);
  const especial = new Map(cliente.precosEspeciais.map((p) => [p.produtoId, p.preco]));

  return (
    <>
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-marca-700">
        <ArrowLeft className="size-4" /> Clientes EGGS
      </Link>
      <Cabecalho
        titulo={cliente.nomeFantasia}
        subtitulo={
          cliente.usuario
            ? `${cliente.tipoNegocio} · código ${cliente.usuario.codigoAcesso ?? "—"} · ${cliente.usuario.ativo ? "acesso ativo" : "acesso bloqueado"} · ${cliente.usuario.ultimoAcesso ? `último acesso ${formatarDataCurta(cliente.usuario.ultimoAcesso)}` : "nunca entrou"}`
            : `${cliente.tipoNegocio} · sem acesso ao app (pede por WhatsApp ou telefone)`
        }
      >
        {cliente.linkMaps && (
          <a href={cliente.linkMaps} target="_blank" rel="noopener noreferrer" className="botao-secundario">
            <MapPin className="size-4" /> Abrir no Maps
          </a>
        )}
        {cliente.usuario?.bloqueadoAte && cliente.usuario.bloqueadoAte > new Date() && (
          <form action={desbloquear.bind(null, cliente.id)}>
            <button className="botao-secundario text-red-700">Destravar (errou a senha)</button>
          </form>
        )}
        {cliente.usuario && (
          <form action={alternarAcesso.bind(null, cliente.id)}>
            <button className="botao-secundario">{cliente.usuario.ativo ? "Bloquear acesso" : "Liberar acesso"}</button>
          </form>
        )}
      </Cabecalho>

      {vencido > 0 && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-red-800"><TriangleAlert className="size-5" /> Não pagou: {reais(vencido)} vencido</h2>
            <p className="mt-1 text-sm text-red-700">
              {cliente.cobrancas.filter((c) => !c.pagoEm && c.vencimento < hoje).map((c) => `${reais(c.valor)} venceu ${c.vencimento.slice(8, 10)}/${c.vencimento.slice(5, 7)}`).join(" · ")}
            </p>
          </div>
          <Link href="/painel/cobrancas" className="botao-secundario">Ver cobranças</Link>
        </section>
      )}

      <section className="mb-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Valores da caixa</h2>
          <FormValoresCaixa clienteId={cliente.id} venda={cliente.valorVenda} custo={cliente.valorCusto} />
          <p className="mt-2 text-xs text-stone-500">A venda vira o preço combinado da caixa de ovo branco: os pedidos dele saem nesse valor.</p>
        </div>
        <div className="cartao p-5">
          <h2 className="mb-1 font-semibold text-marca-950">Lançar valor em aberto</h2>
          <p className="mb-3 text-xs text-stone-500">Venda antiga ou combinada fora do sistema. Se passar do vencimento sem pagar, o cliente fica em alerta.</p>
          <FormEmAberto clienteId={cliente.id} hoje={hoje} />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*]:min-w-0">
        {[
          ["Comprou em 30 dias", reais(faturado30), `${num(vendas.length)} pedidos`],
          ["Caixas em 30 dias", `${num(Math.round(caixas30 * 10) / 10)} cx`, `${num(Math.round((caixas30 / 30) * 7 * 10) / 10)} cx por semana`],
          ["Ticket médio", vendas.length ? reais(faturado30 / vendas.length) : "—", "por pedido"],
          ["Em aberto", reais(emAberto), vencido ? `${reais(vencido)} vencido` : "nada vencido"],
          ["Pagamento", condicaoPagamento(cliente.prazoPagamentoDias), `${cliente.formaPagamento ?? "—"} · ${cliente.notaFiscal ? "com NF" : "sem NF"}`],
        ].map(([rotulo, valor, sub], i) => (
          <div key={rotulo} className={`cartao p-4 ${i === 3 && vencido ? "ring-2 ring-red-300" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
            <p className="tabular mt-1 text-xl font-bold text-marca-950">{valor}</p>
            <p className={`text-xs ${i === 3 && vencido ? "font-semibold text-red-700" : "text-stone-500"}`}>{sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <section className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Dados do cliente</h2>
          <FormDados
            clienteId={cliente.id}
            inicial={{
              nomeFantasia: cliente.nomeFantasia, razaoSocial: cliente.razaoSocial, cnpj: cliente.cnpj, tipoNegocio: cliente.tipoNegocio, responsavel: cliente.responsavel,
              whatsapp: cliente.whatsapp, email: cliente.email, endereco: cliente.endereco, bairro: cliente.bairro, cidade: cliente.cidade, cep: cliente.cep, consumoSemanal: cliente.consumoSemanal,
              limiteCredito: cliente.limiteCredito, observacoes: cliente.observacoes,
            }}
          />
        </section>

        <section className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Pagamento, nota e negociação</h2>
          <FormCondicoes
            clienteId={cliente.id}
            regioes={regioes.map((r) => ({ id: r.id, nome: r.nome }))}
            inicial={{ regiaoId: cliente.regiaoId, prazoPagamentoDias: cliente.prazoPagamentoDias, formaPagamento: cliente.formaPagamento, notaFiscal: cliente.notaFiscal, negociacao: cliente.negociacao }}
          />
          <div className="mt-5 border-t border-stone-100 pt-4">
            {cliente.usuario ? (
              <>
                {qr && login && (
                  <div className="mb-4 flex items-center gap-4 rounded-xl bg-stone-50 p-3">
                    <div className="size-32 shrink-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
                    <div className="min-w-0 text-xs text-stone-600">
                      <b className="block text-sm text-marca-900">QR de acesso · {login}</b>
                      Mostre na visita: o cliente escaneia com a câmera e o app abre com o login dele preenchido. Falta só a senha.
                      <span className="mt-1 block break-all text-stone-400">{linkDeAcesso(login)}</span>
                    </div>
                  </div>
                )}
                <p className="mb-2 text-xs text-stone-500">Esqueceu a senha? Gere outra (o login continua o mesmo).</p>
                <BotaoNovaSenha clienteId={cliente.id} linkApp={linkDoApp()} />
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-stone-500">Esse cliente ainda não tem o app. Libere e passe o login e a senha pra ele.</p>
                <BotaoLiberarApp clienteId={cliente.id} linkApp={linkDoApp()} />
              </>
            )}
          </div>
        </section>

        <section className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Preço combinado</h2>
          <p className="mb-3 text-xs text-stone-500">Vazio = preço de tabela. O cliente vê &quot;seu preço&quot; no app, e preço agendado não muda o dele.</p>
          <ul className="divide-y divide-stone-100 text-sm">
            {produtos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {nomeProduto(p)}
                  <span className="block text-xs text-stone-500">tabela {reais(p.preco)}</span>
                </span>
                <form action={salvarPrecoEspecial.bind(null, cliente.id, p.id)} className="flex items-center gap-1">
                  <span className="text-stone-500">R$</span>
                  <input name="preco" inputMode="decimal" defaultValue={especial.has(p.id) ? especial.get(p.id)!.toFixed(2).replace(".", ",") : ""} placeholder="tabela" className="campo w-24 py-1" />
                  <button className="botao-secundario px-2 py-1 text-xs">Salvar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Mandar mensagem no app</h2>
          <FormMensagem clienteId={cliente.id} assinatura={ASSINATURA_EGGS} />
          <ul className="mt-4 space-y-2 text-sm">
            {cliente.mensagens.map((m) => (
              <li key={m.id} className="rounded-lg bg-stone-50 px-3 py-2">
                {m.texto}
                <span className="block text-xs text-stone-500">
                  {formatarDataCurta(m.criadaEm)} · {m.autor} · {m.lidaEm ? "lida" : "não lida"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="cartao p-5">
          <h2 className="mb-3 font-semibold text-marca-950">Cobranças</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {cliente.cobrancas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  Pedido #{c.pedidoId} · vence {formatarDataCurta(new Date(`${c.vencimento}T12:00:00-03:00`))}
                  {!c.pagoEm && c.vencimento < hoje && <span className="ml-2 text-xs font-semibold text-red-700">vencida</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular">{reais(c.valor)}</span>
                  {c.pagoEm ? (
                    <span className="text-xs text-marca-700">pago {formatarDataCurta(c.pagoEm)}</span>
                  ) : (
                    <form action={marcarPago.bind(null, c.id)}>
                      <button className="botao-secundario px-2 py-1 text-xs">Marcar pago</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
            {cliente.cobrancas.length === 0 && <li className="py-2 text-stone-500">Nenhuma cobrança.</li>}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-marca-950">Últimos pedidos</h3>
          <ul className="divide-y divide-stone-100 text-sm">
            {cliente.pedidos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/painel/pedidos/${p.id}`} className="hover:underline">
                  #{p.id} · {formatarDataCurta(p.dataEntrega)}
                  {p.janela && ` · ${p.janela.inicio}–${p.janela.fim}`}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="tabular">{reais(p.total)}</span>
                  <Etiqueta status={p.status}>{STATUS_PEDIDO[p.status as StatusPedido]}</Etiqueta>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
