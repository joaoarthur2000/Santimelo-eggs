"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { MessageCircle, Search, Upload } from "lucide-react";
import { STATUS_LEAD } from "@/lib/prospeccao";
import { atualizarLead, buscarLeads, importarLista, marcarEnviado, salvarMensagem, type Estado } from "./actions";

function Retorno({ estado }: { estado: Estado }) {
  if (estado.erro) return <p className="text-sm text-red-600">{estado.erro}</p>;
  if (estado.resumo) return <p className="text-sm text-marca-700">{estado.resumo}</p>;
  return null;
}

export function FormBusca({ tipos, regioes, temChave }: { tipos: readonly string[]; regioes: string[]; temChave: boolean }) {
  const [estado, acao, buscando] = useActionState(buscarLeads, {});
  return (
    <form action={acao} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select name="tipo" defaultValue="Lancheria" className="campo" aria-label="Tipo de estabelecimento">
          {tipos.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input name="quantidade" type="number" min={1} max={100} defaultValue={50} className="campo" aria-label="Quantidade" />
      </div>
      <select name="regiao" defaultValue="Zona Sul" className="campo" aria-label="Região">
        {regioes.map((r) => <option key={r}>{r}</option>)}
      </select>
      <button disabled={buscando || !temChave} className="botao-primario w-full">
        <Search className="size-4" /> {buscando ? "Buscando no Google…" : "Buscar no Google"}
      </button>
      {buscando && <p className="text-xs text-stone-500">Leva uns segundos: a busca vai bairro por bairro.</p>}
      <Retorno estado={estado} />
    </form>
  );
}

export function FormImportar({ tipos }: { tipos: readonly string[] }) {
  const [estado, acao, enviando] = useActionState(importarLista, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado.ok]);
  return (
    <form ref={ref} action={acao} className="space-y-3">
      <input name="arquivo" type="file" accept=".json,.csv,text/csv,application/json" required className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-marca-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-marca-900" />
      <div className="flex gap-2">
        <select name="tipo" defaultValue="Lancheria" className="campo" aria-label="Tipo, quando o arquivo não disser">
          {tipos.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button disabled={enviando} className="botao-secundario shrink-0"><Upload className="size-4" /> Importar</button>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}

export function FormMensagem({ atual }: { atual: string }) {
  const [estado, acao, salvando] = useActionState(salvarMensagem, {});
  return (
    <form action={acao} className="space-y-3">
      <textarea name="mensagem" defaultValue={atual} rows={9} maxLength={1500} className="campo text-[13px] leading-relaxed" />
      <div className="flex items-center gap-3">
        <button disabled={salvando} className="botao-secundario">Salvar mensagem</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/** Abre o WhatsApp com a mensagem pronta e marca o lead como "Mensagem enviada" */
export function BotaoWhatsapp({ id, href, novo }: { id: string; href: string; novo: boolean }) {
  const [, iniciar] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => novo && iniciar(() => marcarEnviado(id))}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
    >
      <MessageCircle className="size-4" /> WhatsApp
    </a>
  );
}

export function FormLead({ lead }: { lead: { id: string; status: string; proximoPasso: string | null; cnpj: string | null; observacoes: string | null } }) {
  const [estado, acao, salvando] = useActionState(atualizarLead.bind(null, lead.id), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
      <label className="text-xs text-stone-500">
        Status
        <select name="status" defaultValue={lead.status} className="campo mt-1">
          {Object.entries(STATUS_LEAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-xs text-stone-500">
        Voltar a falar em
        <input name="proximoPasso" type="date" defaultValue={lead.proximoPasso ?? ""} className="campo mt-1" />
      </label>
      <label className="text-xs text-stone-500">
        CNPJ (puxa razão social e porte)
        <input name="cnpj" inputMode="numeric" defaultValue={lead.cnpj ?? ""} placeholder="00.000.000/0000-00" className="campo mt-1" />
      </label>
      <label className="text-xs text-stone-500 sm:col-span-3">
        Anotações (quem decide, quanto usa de ovo, de quem compra hoje)
        <textarea name="observacoes" defaultValue={lead.observacoes ?? ""} rows={2} maxLength={2000} className="campo mt-1" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button disabled={salvando} className="botao-primario">{salvando ? "Salvando…" : "Salvar"}</button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}
