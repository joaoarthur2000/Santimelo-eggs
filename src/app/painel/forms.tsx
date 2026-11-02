"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DIAS_SEMANA } from "@/lib/constantes";
import {
  agendarPreco,
  avisarTodos,
  criarJanela,
  criarRegiao,
  darAcesso,
  enviarMensagem,
  novaSenha,
  salvarCondicoes,
  salvarDados,
  salvarManutencao,
  salvarNovidades,
  testarWhatsapp,
} from "./actions";

type Estado = { erro?: string; ok?: number; senha?: string; codigo?: string };
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
  if (estado.ok && !estado.senha) return <p className="text-sm text-marca-700">{salvo}</p>;
  return null;
}

/** Código e senha gerados: aparecem uma vez só pra passar pro cliente */
function AcessoGerado({ estado, linkApp }: { estado: Estado; linkApp: string }) {
  if (!estado.senha) return null;
  const mensagem = `Olá! Seu acesso ao app EGGS da Santimelo:\n${linkApp}\nCódigo: ${estado.codigo}\nSenha: ${estado.senha}`;
  return (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <p className="font-semibold">Passe pro cliente (a senha não aparece de novo):</p>
      <p className="mt-1">
        App: <b>{linkApp}</b>
        <br />
        Código: <b className="font-mono text-base tracking-wider">{estado.codigo}</b>
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
        Responsável *
        <input name="responsavel" required defaultValue={v(inicial?.responsavel)} placeholder="Nome no aviso do app" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        WhatsApp *
        <input name="whatsapp" required inputMode="tel" defaultValue={v(inicial?.whatsapp)} placeholder="(51) 99999-9999" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        Tipo de negócio
        <input name="tipoNegocio" defaultValue={v(inicial?.tipoNegocio)} placeholder="Padaria, confeitaria…" className="campo mt-1" />
      </label>
      <label className={rotulo}>
        E-mail
        <input name="email" type="email" defaultValue={v(inicial?.email)} className="campo mt-1" />
      </label>
      <label className={`${rotulo} col-span-2`}>
        Endereço de entrega *
        <input name="endereco" required defaultValue={v(inicial?.endereco)} placeholder="Rua, número, complemento, bairro" className="campo mt-1" />
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

type Condicoes = { regiaoId: string | null; prazoPagamentoDias: number | null; formaPagamento: string | null; negociacao: string | null };

function CamposCondicoes({ regioes, inicial }: { regioes: Regiao[]; inicial?: Condicoes }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
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
          Prazo (dias)
          <input name="prazoPagamentoDias" inputMode="numeric" defaultValue={inicial?.prazoPagamentoDias ?? ""} placeholder="0 = na entrega" className="campo mt-1" />
        </label>
        <label className="text-xs text-stone-500">
          Pagamento
          <input name="formaPagamento" defaultValue={inicial?.formaPagamento ?? ""} placeholder="Pix, boleto…" className="campo mt-1" />
        </label>
      </div>
      <label className="block text-xs text-stone-500">
        O que foi combinado (aparece pro cliente)
        <textarea name="negociacao" rows={2} defaultValue={inicial?.negociacao ?? ""} placeholder="Ex: mínimo de 1 caixa por pedido; troca de ovos trincados na próxima entrega" className="campo mt-1" />
      </label>
    </>
  );
}

export function FormDarAcesso({ regioes, clientes, linkApp }: { regioes: Regiao[]; clientes: { id: string; nome: string }[]; linkApp: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(darAcesso, {});
  const [clienteId, setClienteId] = useState("");
  const ref = useLimpar(estado.ok);
  return (
    <form ref={ref} action={acao} className="space-y-3">
      <label className="block text-xs text-stone-500">
        Cliente
        <select name="clienteId" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="campo mt-1">
          <option value="">Novo cliente (só ovos)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>Já cadastrado: {c.nome}</option>
          ))}
        </select>
      </label>
      {!clienteId && <CamposDados />}
      <h3 className="pt-1 text-sm font-semibold text-marca-950">Negociação</h3>
      <CamposCondicoes regioes={regioes} />
      <button disabled={enviando} className="botao-primario w-full">Liberar acesso e gerar código</button>
      <Retorno estado={estado} />
      <AcessoGerado estado={estado} linkApp={linkApp} />
    </form>
  );
}

export function FormDados({ clienteId, inicial }: { clienteId: string; inicial: Dados }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarDados.bind(null, clienteId), {});
  return (
    <form action={acao} className="space-y-3">
      <CamposDados inicial={inicial} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Salvar dados</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function FormCondicoes({ clienteId, regioes, inicial }: { clienteId: string; regioes: Regiao[]; inicial: Condicoes }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarCondicoes.bind(null, clienteId), {});
  return (
    <form action={acao} className="space-y-3">
      <CamposCondicoes regioes={regioes} inicial={inicial} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Salvar negociação</button>
        <Retorno estado={estado} />
      </div>
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
          <input name="aPartirDe" type="date" required min={amanha} defaultValue={amanha} className="campo mt-1" />
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
