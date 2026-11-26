"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, ExternalLink, MapPin, PencilLine, Search } from "lucide-react";
import { TIPOS_NEGOCIO } from "@/lib/constantes";
import { buscarCadastro, completarCadastro, type DadosCompletar, type Opcao } from "./actions";

type Campos = { endereco: string; bairro: string; cidade: string; cep: string; whatsapp: string; tipoNegocio: string; responsavel: string };
type Cliente = { id: string; nome: string; falta: string[]; marcado: boolean; atual: Campos };
type Linha = {
  termo: string;
  marcado: boolean;
  buscando: boolean;
  opcoes: Opcao[];
  escolhida: number | null;
  aberta: boolean;
  campos: Campos;
  /** o que veio da busca (fica amarelo até alguém mexer) */
  auto: Partial<Record<keyof Campos, true>>;
  salvando: boolean;
  salvo: boolean;
  erro: string | null;
  erros: Record<string, string>;
};

const CAMPOS: { nome: keyof Campos; rotulo: string; modo?: "tel" | "numeric"; largo?: boolean }[] = [
  { nome: "endereco", rotulo: "Endereço (rua e número)", largo: true },
  { nome: "bairro", rotulo: "Bairro" },
  { nome: "cidade", rotulo: "Cidade" },
  { nome: "cep", rotulo: "CEP", modo: "numeric" },
  { nome: "whatsapp", rotulo: "WhatsApp", modo: "tel" },
  { nome: "responsavel", rotulo: "Responsável" },
];
const DA_OPCAO = ["endereco", "bairro", "cidade", "cep", "whatsapp", "tipoNegocio"] as const;

const nova = (c: Cliente): Linha => ({ termo: c.nome, marcado: c.marcado, buscando: false, opcoes: [], escolhida: null, aberta: false, campos: c.atual, auto: {}, salvando: false, salvo: false, erro: null, erros: {} });

/** Todos os cadastros incompletos numa tela: busca em lote, confere e salva de uma vez */
export function ListaCompletar({ clientes, comGoogle }: { clientes: Cliente[]; comGoogle: boolean }) {
  const [linhas, setLinhas] = useState<Record<string, Linha>>(() => Object.fromEntries(clientes.map((c) => [c.id, nova(c)])));
  const [lote, setLote] = useState<string | null>(null);
  const parar = useRef(false);
  const linhaDe = (c: Cliente) => linhas[c.id] ?? nova(c);
  const mudar = (id: string, m: Partial<Linha> | ((l: Linha) => Partial<Linha>)) =>
    setLinhas((t) => {
      const cliente = clientes.find((c) => c.id === id);
      const l = t[id] ?? (cliente && nova(cliente));
      return l ? { ...t, [id]: { ...l, ...(typeof m === "function" ? m(l) : m) } } : t;
    });

  // escolher uma opção preenche o que está vazio no cadastro; o que já existe não é trocado
  const comOpcao = (c: Cliente, opcoes: Opcao[], n: number): Partial<Linha> => {
    const campos = { ...c.atual };
    const auto: Linha["auto"] = {};
    for (const k of DA_OPCAO) {
      const v = opcoes[n]?.[k];
      if (v && (!c.atual[k] || (k === "cidade" && !c.atual.endereco))) {
        campos[k] = v;
        auto[k] = true;
      }
    }
    return { escolhida: n, campos, auto, aberta: true, erro: null, erros: {} };
  };

  async function buscar(c: Cliente, termo: string) {
    mudar(c.id, { buscando: true, erro: null });
    try {
      const r = await buscarCadastro(termo, c.nome);
      if ("erro" in r) return mudar(c.id, { buscando: false, erro: r.erro, opcoes: [], escolhida: null });
      const certa = r.opcoes.findIndex((o) => o.parecido);
      mudar(c.id, { buscando: false, opcoes: r.opcoes, ...(certa >= 0 ? comOpcao(c, r.opcoes, certa) : { escolhida: null, aberta: true }) });
    } catch {
      mudar(c.id, { buscando: false, erro: "Não consegui buscar agora. Tente de novo." });
    }
  }

  async function salvar(c: Cliente, l: Linha) {
    mudar(c.id, { salvando: true, erro: null, erros: {} });
    const o = l.escolhida !== null ? l.opcoes[l.escolhida] : null;
    const t = (v: string) => v.trim() || null;
    const dados: DadosCompletar = {
      endereco: t(l.campos.endereco),
      bairro: t(l.campos.bairro),
      cidade: t(l.campos.cidade),
      cep: t(l.campos.cep),
      whatsapp: t(l.campos.whatsapp),
      tipoNegocio: (t(l.campos.tipoNegocio) as DadosCompletar["tipoNegocio"]) ?? null,
      responsavel: t(l.campos.responsavel),
      cnpj: o?.cnpj ?? null,
      razaoSocial: o?.razaoSocial ?? null,
      // posição exata só se o endereço que vai salvo é o da busca
      lat: o && l.auto.endereco ? o.lat : null,
      lng: o && l.auto.endereco ? o.lng : null,
      linkMaps: o && l.auto.endereco && o.link ? o.link : null,
    };
    try {
      const r = await completarCadastro(c.id, dados);
      if (r.erro) mudar(c.id, { salvando: false, aberta: true, erro: r.erro, erros: r.campos ?? {} });
      else mudar(c.id, { salvando: false, salvo: true, aberta: false, marcado: false });
    } catch {
      mudar(c.id, { salvando: false, erro: "Não salvou. Tente de novo." });
    }
  }

  const paraBuscar = clientes.filter((c) => linhaDe(c).marcado && !linhaDe(c).salvo && linhaDe(c).escolhida === null);
  const prontos = clientes.filter((c) => !linhaDe(c).salvo && linhaDe(c).escolhida !== null);
  const salvos = Object.values(linhas).filter((l) => l.salvo).length;

  async function buscarTodos() {
    parar.current = false;
    for (const [n, c] of paraBuscar.entries()) {
      if (parar.current) break;
      setLote(`Buscando ${n + 1} de ${paraBuscar.length}`);
      await buscar(c, linhaDe(c).termo);
    }
    setLote(null);
  }
  async function salvarTodos() {
    for (const [n, c] of prontos.entries()) {
      setLote(`Salvando ${n + 1} de ${prontos.length}`);
      await salvar(c, linhaDe(c));
    }
    setLote(null);
  }

  const botoes = (
    <>
      <button type="button" onClick={buscarTodos} disabled={!!lote || paraBuscar.length === 0} className={`${prontos.length ? "botao-secundario" : "botao-primario"} max-lg:flex-1 max-lg:px-2`}>
        <Search className="size-4" /> Buscar {paraBuscar.length}
      </button>
      <button type="button" onClick={salvarTodos} disabled={!!lote || prontos.length === 0} className={`${prontos.length ? "botao-primario" : "botao-secundario"} max-lg:flex-1 max-lg:px-2`}>
        <Check className="size-4" /> Salvar {prontos.length}
      </button>
    </>
  );

  return (
    <>
      <div className="cartao mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-stone-600" role="status">
          {lote ? (
            <span className="inline-flex items-center gap-2 font-medium text-marca-950">
              <span className="size-4 animate-spin rounded-full border-2 border-terra/20 border-t-terra" aria-hidden /> {lote}
              {lote.startsWith("Buscando") && (
                <button type="button" onClick={() => (parar.current = true)} className="toque text-marca-700 underline">
                  parar
                </button>
              )}
            </span>
          ) : salvos ? (
            `${salvos} ${salvos === 1 ? "cadastro salvo" : "cadastros salvos"}.${clientes.length ? " Falta conferir os que ainda estão na lista." : ""}`
          ) : (
            `Marque quem é estabelecimento, busque, confira e salve. ${comGoogle ? "" : "Pessoa física fica de fora da busca."}`
          )}
        </p>
        <div className="hidden gap-2 lg:flex">{botoes}</div>
      </div>

      <ul className="grid gap-3 [&>*]:min-w-0">
        {clientes.map((c) => {
          const l = linhaDe(c);
          if (l.salvo)
            return (
              <li key={c.id} className="cartao flex items-center gap-3 p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                  <Check className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-marca-950">{c.nome}</span>
                <Link href={`/painel/clientes/${c.id}`} className="toque text-sm text-marca-700 hover:underline">
                  Abrir ficha
                </Link>
              </li>
            );
          return (
            <li key={c.id} className={`cartao p-4 lg:p-5 ${l.aberta ? "lg:grid lg:grid-cols-2 lg:gap-6 [&>*]:min-w-0" : ""}`}>
              <div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={l.marcado}
                  onChange={(e) => mudar(c.id, { marcado: e.target.checked })}
                  aria-label={`Buscar ${c.nome}`}
                  className="mt-0.5 size-[18px] shrink-0 accent-marca-900 max-lg:size-6"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-marca-950 max-lg:text-[17px]">{c.nome}</h2>
                  <p className="text-sm text-stone-500">falta {c.falta.join(", ")}</p>
                </div>
                {!l.aberta && (
                  <button type="button" onClick={() => mudar(c.id, { aberta: true })} className="toque inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-marca-700 hover:underline">
                    <PencilLine className="size-4" aria-hidden /> Preencher
                  </button>
                )}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  buscar(c, l.termo);
                }}
              >
                <input value={l.termo} onChange={(e) => mudar(c.id, { termo: e.target.value })} aria-label={`Nome, link do Google Maps ou CNPJ de ${c.nome}`} placeholder="Nome, link do Maps ou CNPJ" autoComplete="off" className="campo" />
                <button disabled={l.buscando || !!lote} className="botao-secundario shrink-0">
                  {l.buscando ? <span className="size-4 animate-spin rounded-full border-2 border-terra/20 border-t-terra" aria-label="Buscando" /> : "Buscar"}
                </button>
              </form>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nome} Porto Alegre`)}`} target="_blank" rel="noopener noreferrer" className="toque mt-2 inline-flex items-center gap-1 text-sm text-marca-700 hover:underline">
                Achar no Google Maps e copiar o link <ExternalLink className="size-3.5" aria-hidden />
              </a>
              {l.erro && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {l.erro}
                </p>
              )}

              {l.opcoes.length > 0 && (
                <fieldset className="mt-3 space-y-1.5">
                  <legend className="mb-1 text-sm font-medium text-stone-700">{l.escolhida === null ? "Qual é?" : "Confira se é esse"}</legend>
                  {l.opcoes.map((o, n) => (
                    <label key={n} className={`flex cursor-pointer items-start gap-2.5 rounded-xl p-3 ring-1 ring-inset ${l.escolhida === n ? "bg-ouro/15 ring-ouro" : "ring-stone-200"}`}>
                      <input type="radio" name={`opcao-${c.id}`} checked={l.escolhida === n} onChange={() => mudar(c.id, comOpcao(c, l.opcoes, n))} className="mt-1 size-4 shrink-0 accent-marca-900" />
                      <span className="min-w-0 text-sm">
                        <b className="font-semibold text-marca-950">{o.nome}</b>
                        <span className="block text-stone-600">{[o.endereco, o.bairro, o.cidade].filter(Boolean).join(" · ") || "sem endereço"}</span>
                        <span className="block text-stone-500">
                          {o.whatsapp ?? "sem telefone"} · {o.fontes.at(-1)}
                        </span>
                      </span>
                    </label>
                  ))}
                  <button type="button" onClick={() => mudar(c.id, { opcoes: [], escolhida: null, campos: c.atual, auto: {} })} className="toque pt-1 text-sm text-stone-500 hover:underline">
                    Nenhum desses
                  </button>
                </fieldset>
              )}

              </div>

              {l.aberta && (
                <div className="max-lg:mt-3 max-lg:border-t max-lg:border-stone-100 max-lg:pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {CAMPOS.map((k) => (
                      <label key={k.nome} className={`text-xs text-stone-500 ${k.largo ? "col-span-2" : ""}`}>
                        {k.rotulo}
                        <input
                          value={l.campos[k.nome]}
                          inputMode={k.modo}
                          aria-invalid={!!l.erros[k.nome]}
                          onChange={(e) => mudar(c.id, (x) => ({ campos: { ...x.campos, [k.nome]: e.target.value }, auto: { ...x.auto, [k.nome]: undefined }, erros: { ...x.erros, [k.nome]: "" } }))}
                          className={`campo mt-1 ${l.auto[k.nome] ? "campo-auto" : ""}`}
                        />
                        {l.erros[k.nome] && <span className="erro-campo">{l.erros[k.nome]}</span>}
                      </label>
                    ))}
                    <label className="text-xs text-stone-500">
                      Tipo
                      <select value={l.campos.tipoNegocio} onChange={(e) => mudar(c.id, (x) => ({ campos: { ...x.campos, tipoNegocio: e.target.value }, auto: { ...x.auto, tipoNegocio: undefined } }))} className={`campo mt-1 ${l.auto.tipoNegocio ? "campo-auto" : ""}`}>
                        <option value="">Escolha…</option>
                        {TIPOS_NEGOCIO.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {l.escolhida !== null && l.opcoes[l.escolhida]?.cnpj && (
                    <p className="mt-2 text-sm text-stone-600">
                      <MapPin className="-mt-0.5 mr-1 inline size-4" aria-hidden /> CNPJ {l.opcoes[l.escolhida].cnpj} · {l.opcoes[l.escolhida].razaoSocial}
                    </p>
                  )}
                  <button type="button" onClick={() => salvar(c, l)} disabled={l.salvando || !!lote} className="botao-primario mt-3 max-lg:w-full">
                    {l.salvando ? "Salvando…" : "Salvar este"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="acao-fixa lg:hidden">{botoes}</div>
    </>
  );
}
