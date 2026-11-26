"use client";

import { CampoData } from "@/components/campo-data";
import { useFormulario } from "@/components/formulario";
import { PreencherPeloGoogle } from "./clientes/preencher-google";
import { useActionState, useEffect, useRef, useState } from "react";
import { CIDADES, DIAS_SEMANA, FORMAS_PAGAMENTO, PRAZOS_PAGAMENTO, TIPOS_NEGOCIO } from "@/lib/constantes";
import {
  agendarPreco,
  avisarTodos,
  criarJanela,
  criarRegiao,
  liberarApp,
  enviarMensagem,
  novaSenha,
  salvarCondicoes,
  salvarDados,
  salvarManutencao,
  salvarNovidades,
  salvarWhatsappAtendimento,
  testarWhatsapp,
} from "./actions";

type Estado = { erro?: string; ok?: number; senha?: string; codigo?: string; campos?: Record<string, string>; avisos?: Record<string, string>; falta?: string[] };
type Regiao = { id: string; nome: string };

function useLimpar(ok?: number) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ok) ref.current?.reset();
  }, [ok]);
  return ref;
}

function Retorno({ estado, salvo = "Salvo." }: { estado: Estado; salvo?: string }) {
  if (estado.erro) return <p className="text-sm text-red-600">{estado.erro}</p>;
  if (estado.ok && !estado.senha)
    return (
      <p className="text-sm text-marca-700" role="status">
        {salvo}
        {!!estado.falta?.length && <span className="text-stone-500"> Ainda falta {estado.falta.join(", ")}.</span>}
      </p>
    );
  return null;
}

/** Código e senha gerados: aparecem uma vez só pra passar pro cliente */
function AcessoGerado({ estado, linkApp }: { estado: Estado; linkApp: string }) {
  if (!estado.senha) return null;
  const mensagem = `Olá! 🥚 Seu acesso ao app EGGS, da Santimelo:\n${linkApp}\n\nLogin: ${estado.codigo}\nSenha: ${estado.senha}\n\nBons pedidos! 🐣`;
  return (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <p className="font-semibold">Passe pro cliente (a senha não aparece de novo):</p>
      <p className="mt-1">
        App: <b>{linkApp}</b>
        <br />
        Login: <b className="font-mono text-base tracking-wider">{estado.codigo}</b>
        <br />
        Senha: <b className="font-mono text-base tracking-wider">{estado.senha}</b>
      </p>
      <button type="button" onClick={() => navigator.clipboard?.writeText(mensagem)} className="mt-2 text-xs font-semibold underline">
        Copiar mensagem pro WhatsApp
      </button>
    </div>
  );
}

type Dados = {
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  tipoNegocio: string | null;
  responsavel: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  consumoSemanal: number | null;
  limiteCredito: number | null;
  observacoes: string | null;
};

/** O que a Santimelo precisa saber do cliente */
function CamposDados({ inicial }: { inicial?: Partial<Dados> }) {
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x).replace(".", ","));
  const rotulo = "text-xs text-stone-500";
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className={`${rotulo} col-span-2`}>
        Nome do estabelecimento *
        <input name="nomeFantasia" required defaultValue={v(inicial?.nomeFantasia)} className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Razão social
        <input name="razaoSocial" defaultValue={v(inicial?.razaoSocial)} className="campo mt-1" />
      </label>
      <label className={rotulo}>
        CNPJ ou CPF
        <input name="cnpj" inputMode="numeric" defaultValue={v(inicial?.cnpj)} placeholder="00.000.000/0000-00" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Responsável
        <input name="responsavel" defaultValue={v(inicial?.responsavel)} placeholder="Nome no aviso do app" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        WhatsApp
        <input name="whatsapp" inputMode="tel" defaultValue={v(inicial?.whatsapp)} placeholder="(51) 99999-9999" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Tipo de negócio
        <select name="tipoNegocio" defaultValue={inicial?.tipoNegocio === "A definir" ? "" : (inicial?.tipoNegocio ?? "")} className="campo mt-1">
          <option value="">A definir</option>
          {TIPOS_NEGOCIO.map((t) => (
            <option key={t}>{t}</option>
          ))}
          {inicial?.tipoNegocio && inicial.tipoNegocio !== "A definir" && !(TIPOS_NEGOCIO as readonly string[]).includes(inicial.tipoNegocio) && <option>{inicial.tipoNegocio}</option>}
        </select>
      </label>
      <label className={rotulo}>
        E-mail
        <input name="email" type="email" defaultValue={v(inicial?.email)} className="campo mt-1" />
      </label>
      <label className={`${rotulo} col-span-2`}>
        Endereço de entrega
        <input name="endereco" defaultValue={v(inicial?.endereco)} placeholder="Rua, número e complemento" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Bairro
        <input name="bairro" defaultValue={v(inicial?.bairro)} className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Cidade
        <input name="cidade" list="cidades-dados" defaultValue={inicial?.cidade ?? "Porto Alegre"} className="campo mt-1" />
        <datalist id="cidades-dados">
          {CIDADES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className={rotulo}>
        CEP
        <input name="cep" inputMode="numeric" defaultValue={v(inicial?.cep)} placeholder="00000-000" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Consumo (caixas/semana)
        <input name="consumoSemanal" inputMode="decimal" defaultValue={v(inicial?.consumoSemanal)} className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Limite em aberto (R$)
        <input name="limiteCredito" inputMode="decimal" defaultValue={v(inicial?.limiteCredito)} placeholder="sem limite" className="campo mt-1" />
      </label>
      <label className={`${rotulo} col-span-2`}>
        Observações internas (o cliente não vê)
        <textarea name="observacoes" rows={2} defaultValue={v(inicial?.observacoes)} className="campo mt-1" />
      </label>
    </div>
  );
}

type Condicoes = { regiaoId: string | null; prazoPagamentoDias: number | null; formaPagamento: string | null; notaFiscal: boolean; negociacao: string | null };

function CamposCondicoes({ regioes, inicial }: { regioes: Regiao[]; inicial?: Condicoes }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">
          Região de entrega
          <select name="regiaoId" defaultValue={inicial?.regiaoId ?? ""} className="campo mt-1">
            <option value="">Sem região</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          Condição
          <select name="prazoPagamentoDias" defaultValue={String(inicial?.prazoPagamentoDias ?? 0)} className="campo mt-1">
            {PRAZOS_PAGAMENTO.map((d) => (
              <option key={d} value={d}>{d ? `A prazo · ${d} dias` : "À vista (na entrega)"}</option>
            ))}
            {!!inicial?.prazoPagamentoDias && !(PRAZOS_PAGAMENTO as readonly number[]).includes(inicial.prazoPagamentoDias) && (
              <option value={inicial.prazoPagamentoDias}>A prazo · {inicial.prazoPagamentoDias} dias</option>
            )}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          Forma de pagamento
          <select name="formaPagamento" defaultValue={inicial?.formaPagamento ?? "Pix"} className="campo mt-1">
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
            {inicial?.formaPagamento && !(FORMAS_PAGAMENTO as readonly string[]).includes(inicial.formaPagamento) && <option>{inicial.formaPagamento}</option>}
          </select>
        </label>
        <fieldset className="text-xs text-stone-500">
          <legend>Nota fiscal</legend>
          <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg ring-1 ring-stone-300">
            {[
              ["1", "Com NF"],
              ["0", "Sem NF"],
            ].map(([valor, rotulo]) => (
              <label key={valor} className="cursor-pointer text-center text-stone-700 has-[:checked]:bg-marca-900 has-[:checked]:text-white">
                <input type="radio" name="notaFiscal" value={valor} defaultChecked={(inicial?.notaFiscal ? "1" : "0") === valor} className="sr-only" />
                <span className="block px-2 py-2 text-sm font-medium">{rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="block text-xs text-stone-500">
        O que foi combinado (aparece pro cliente)
        <textarea name="negociacao" rows={2} defaultValue={inicial?.negociacao ?? ""} placeholder="Ex: mínimo de 1 caixa por pedido; troca de ovos trincados na próxima entrega" className="campo mt-1" />
      </label>
    </>
  );
}

export function FormDados({ clienteId, inicial }: { clienteId: string; inicial: Dados }) {
  const { estado, enviando, ref, aoEnviar } = useFormulario<Estado>(salvarDados.bind(null, clienteId), {});
  return (
    <form ref={ref} onSubmit={aoEnviar} noValidate className="space-y-3">
      <PreencherPeloGoogle formulario={ref} nome={inicial.nomeFantasia} />
      <CamposDados inicial={inicial} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">{enviando ? "Salvando…" : "Salvar dados"}</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormCondicoes({ clienteId, regioes, inicial }: { clienteId: string; regioes: Regiao[]; inicial: Condicoes }) {
  const { estado, enviando, ref, aoEnviar } = useFormulario<Estado>(salvarCondicoes.bind(null, clienteId), {});
  return (
    <form ref={ref} onSubmit={aoEnviar} className="space-y-3">
      <CamposCondicoes regioes={regioes} inicial={inicial} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">{enviando ? "Salvando…" : "Salvar negociação"}</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function BotaoLiberarApp({ clienteId, linkApp }: { clienteId: string; linkApp: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(liberarApp.bind(null, clienteId), {});
  return (
    <form action={acao} className="space-y-3">
      {!estado.senha && <button disabled={enviando} className="botao-primario">🥚 Liberar o app</button>}
      <Retorno estado={estado} />
      <AcessoGerado estado={estado} linkApp={linkApp} />
    </form>
  );
}

export function BotaoNovaSenha({ clienteId, linkApp }: { clienteId: string; linkApp: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(novaSenha.bind(null, clienteId), {});
  return (
    <form action={acao} className="space-y-2">
      <button disabled={enviando} className="botao-secundario">Gerar senha nova</button>
      <Retorno estado={estado} />
      <AcessoGerado estado={estado} linkApp={linkApp} />
    </form>
  );
}

export function FormMensagem({ clienteId, assinatura }: { clienteId: string; assinatura: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(enviarMensagem.bind(null, clienteId), {});
  const ref = useLimpar(estado.ok);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <textarea name="texto" rows={3} required placeholder="Ex: Semana que vem não teremos entrega na quinta (feriado)." className="campo" />
      <div className="flex items-center gap-2">
        <input name="assinatura" defaultValue={assinatura} className="campo w-40" aria-label="Assinatura" />
        <button disabled={enviando} className="botao-primario">Enviar no app</button>
        <Retorno estado={estado} salvo="Enviada." />
      </div>
    </form>
  );
}

export function FormAvisoTodos({ assinatura }: { assinatura: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(avisarTodos, {});
  const ref = useLimpar(estado.ok);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <textarea name="texto" rows={3} required placeholder="Ex: Feriado na segunda: as entregas passam pra terça." className="campo" />
      <div className="flex items-center gap-2">
        <input name="assinatura" defaultValue={assinatura} className="campo w-40" aria-label="Assinatura" />
        <button disabled={enviando} className="botao-primario">Enviar pra todos</button>
        <Retorno estado={estado} salvo="Enviado pra todos os clientes." />
      </div>
    </form>
  );
}

export function FormManutencao({ ligada, texto }: { ligada: boolean; texto: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarManutencao, {});
  return (
    <form action={acao} className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ligada" value="1" defaultChecked={ligada} className="size-4 accent-red-600" />
        <span>App em manutenção (clientes veem só um aviso, ninguém consegue pedir)</span>
      </label>
      <input name="texto" defaultValue={texto} placeholder="Mensagem (ex: Voltamos às 14h!)" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-secundario">Salvar</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormNovidades({ texto }: { texto: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarNovidades, {});
  return (
    <form action={acao} className="space-y-2">
      <textarea name="texto" rows={2} defaultValue={texto} placeholder="Ex: Agora dá pra repetir o último pedido com um toque!" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-secundario">Salvar novidades</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormNovaRegiao() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(criarRegiao, {});
  const ref = useLimpar(estado.ok);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <input name="nome" required placeholder="Nome (ex: Zona Norte)" className="campo" />
      <input name="bairros" placeholder="Bairros (ex: Sarandi, Passo d'Areia)" className="campo" />
      <button disabled={enviando} className="botao-primario w-full">Criar região</button>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormNovaJanela({ regiaoId }: { regiaoId: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(criarJanela.bind(null, regiaoId), {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-stone-500">
        Dia
        <select name="diaSemana" defaultValue="1" className="campo mt-1 w-32">
          {DIAS_SEMANA.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-stone-500">
        Das
        <input name="inicio" type="time" required defaultValue="07:00" className="campo mt-1 w-28" />
      </label>
      <label className="text-xs text-stone-500">
        Às
        <input name="fim" type="time" required defaultValue="09:00" className="campo mt-1 w-28" />
      </label>
      <label className="text-xs text-stone-500">
        Vagas
        <input name="capacidade" inputMode="numeric" required defaultValue="6" className="campo mt-1 w-20" />
      </label>
      <button disabled={enviando} className="botao-secundario">Adicionar horário</button>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormAgendarPreco({ produtos, amanha }: { produtos: { id: string; nome: string; preco: number }[]; amanha: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(agendarPreco, {});
  const ref = useLimpar(estado.ok);
  return (
    <form ref={ref} action={acao} className="space-y-3">
      <select name="produtoId" required className="campo">
        <option value="">Produto…</option>
        {produtos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome} (hoje {p.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">
          Novo preço (R$)
          <input name="preco" inputMode="decimal" required placeholder="0,00" className="campo mt-1" />
        </label>
        <label className="text-xs text-stone-500">
          A partir de
          <CampoData name="aPartirDe" required min={amanha} defaultValue={amanha} className="campo mt-1" />
        </label>
      </div>
      <button disabled={enviando} className="botao-primario w-full">Agendar preço</button>
      <Retorno estado={estado} salvo="Agendado. Os clientes já veem no app." />
    </form>
  );
}

export function BotaoTesteWhatsapp() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(testarWhatsapp, {});
  return (
    <form action={acao} className="flex items-center gap-3">
      <button disabled={enviando} className="botao-secundario">{enviando ? "Enviando…" : "Mandar teste pro grupo"}</button>
      <Retorno estado={estado} salvo="Enviado. Confira no grupo." />
    </form>
  );
}

/** Copia a comanda pra colar no grupo à mão (enquanto o envio automático não está ligado) */
export function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="botao-secundario"
    >
      {copiado ? "Copiado!" : "Copiar mensagem"}
    </button>
  );
}

export function FormWhatsappAtendimento({ numero }: { numero: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarWhatsappAtendimento, {});
  return (
    <form action={acao} className="space-y-2">
      <input name="numero" inputMode="tel" defaultValue={numero} placeholder="(51) 99999-9999" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-secundario">Salvar número</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}
