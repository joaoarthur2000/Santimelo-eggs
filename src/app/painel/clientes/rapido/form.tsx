"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, MapPin, Search } from "lucide-react";
import { CIDADES, FORMAS_PAGAMENTO, PRAZOS_PAGAMENTO, TIPOS_NEGOCIO, condicaoPagamento } from "@/lib/constantes";
import type { DadosNegocio } from "@/lib/google-negocio";
import { buscarNoGoogle, cadastrarClienteRapido, lancarEmAberto, salvarValoresCaixa, type EstadoCadastro, type ResultadoBusca } from "./actions";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d,.-]/g, "").replace(",", ".")));
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Margem e markup na hora, enquanto digita os valores da caixa */
function MargemAoVivo({ venda, custo }: { venda: string; custo: string }) {
  const v = num(venda), c = num(custo);
  if (!v || !c) return <p className="text-xs text-stone-500">Preencha venda e custo pra ver a margem.</p>;
  const lucro = v - c;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${lucro >= 0 ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>
      Lucro de <b className="tabular">{brl.format(lucro)}</b> por caixa · margem <b className="tabular">{pctFmt.format(lucro / v)}</b> · markup <b className="tabular">{pctFmt.format(lucro / c)}</b>
    </p>
  );
}

type PropsForm = { regioes: { id: string; nome: string }[]; hoje: string; custoAtual: number | null };

export function FormClienteRapido(props: PropsForm) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(cadastrarClienteRapido, {});
  // a cada cliente salvo o formulário nasce de novo, vazio, pronto pro próximo
  return <CamposCliente key={estado.ok ?? 0} {...props} estado={estado} acao={acao} enviando={enviando} />;
}

const VAZIO = { nomeFantasia: "", tipoNegocio: "", whatsapp: "", endereco: "", bairro: "", cidade: "Porto Alegre", cep: "", lat: "", lng: "", linkMaps: "" };
type Campos = typeof VAZIO;

/** Cola o link do Google Maps / Meu Negócio e o cadastro se preenche sozinho */
function PuxarDoGoogle({ aoAchar }: { aoAchar: (d: DadosNegocio) => void }) {
  const [link, setLink] = useState("");
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [buscando, iniciar] = useTransition();

  const buscar = (texto: string) => {
    if (!texto.trim()) return;
    iniciar(async () => {
      const r = await buscarNoGoogle(texto);
      setResultado(r);
      if (r.dados) aoAchar(r.dados);
    });
  };

  const d = resultado?.dados;
  return (
    <div className="rounded-2xl border border-ouro/60 bg-ouro/10 p-4">
      <label htmlFor="link-google" className="flex items-center gap-2 font-eggs text-base font-extrabold text-terra">
        <MapPin className="size-4" /> Puxar do Google <span className="font-sans text-xs font-normal text-stone-500">opcional</span>
      </label>
      <p className="mt-0.5 text-xs text-stone-600">
        No Google Maps, abra o estabelecimento, toque em <b>Compartilhar</b> e cole o link aqui. Nome, endereço, bairro, CEP e telefone vêm sozinhos.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="link-google"
          inputMode="url"
          autoComplete="off"
          placeholder="https://maps.app.goo.gl/..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (!t) return;
            e.preventDefault();
            setLink(t.trim());
            buscar(t);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // Enter aqui busca, não salva o cliente
              buscar(link);
            }
          }}
          className="campo"
        />
        <button type="button" onClick={() => buscar(link)} disabled={buscando || !link.trim()} aria-label="Buscar" className="botao-primario shrink-0">
          {buscando ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span className="hidden sm:inline">{buscando ? "Buscando" : "Buscar"}</span>
        </button>
      </div>

      <div aria-live="polite">
        {buscando && <p className="mt-2 text-xs text-stone-600">Procurando o endereço e o telefone…</p>}
        {!buscando && resultado?.erro && <p className="mt-2 text-sm text-red-700" role="alert">{resultado.erro}</p>}
        {!buscando && d && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-3 text-sm">
            <p className="flex items-start gap-2 text-folha">
              <Check className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>{d.nome ?? "Lugar encontrado"}</b>
                {d.endereco && <> · {d.endereco}{d.bairro ? `, ${d.bairro}` : ""}</>}. Confira os campos marcados em amarelo.
              </span>
            </p>
            {d.faltou.length > 0 && <p className="text-xs text-stone-600">Não veio: {d.faltou.join(", ")}. Preencha à mão.</p>}
            {resultado?.existente && (
              <p className="text-xs font-semibold text-pimenta">
                Já existe um cliente com esse nome. <Link href={`/painel/clientes/${resultado.existente.id}`} className="underline">Abrir ficha</Link>
              </p>
            )}
            <p className="text-[11px] text-stone-400">
              Fonte: {d.fontes.join(" + ")} ·{" "}
              <a href={d.link} target="_blank" rel="noopener noreferrer" className="underline">abrir no Maps</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CamposCliente({ regioes, hoje, custoAtual, estado, acao, enviando }: PropsForm & { estado: EstadoCadastro; acao: (f: FormData) => void; enviando: boolean }) {
  const [c, setC] = useState<Campos>(VAZIO);
  const [auto, setAuto] = useState<Set<keyof Campos>>(new Set());
  const [venda, setVenda] = useState("");
  const [custo, setCusto] = useState(custoAtual ? String(custoAtual.toFixed(2)).replace(".", ",") : "");
  const [saldo, setSaldo] = useState("");

  // campo controlado; mexeu à mão, sai o destaque de "veio do Google"
  const campo = (k: keyof Campos) => ({
    name: k,
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setC((v) => ({ ...v, [k]: e.target.value }));
      setAuto((a) => (a.has(k) ? new Set([...a].filter((x) => x !== k)) : a));
    },
  });
  const destaque = (k: keyof Campos) => (auto.has(k) ? " campo-auto" : "");

  const aoAchar = (d: DadosNegocio) => {
    const novos: Partial<Campos> = {
      nomeFantasia: d.nome ?? undefined,
      tipoNegocio: d.tipoNegocio ?? undefined,
      whatsapp: d.whatsapp ?? undefined,
      endereco: d.endereco ?? undefined,
      bairro: d.bairro ?? undefined,
      cidade: d.cidade ?? undefined,
      cep: d.cep ?? undefined,
    };
    const preenchidos = Object.entries(novos).filter(([, v]) => v) as [keyof Campos, string][];
    setC((v) => ({
      ...v,
      ...Object.fromEntries(preenchidos),
      lat: d.lat !== null ? String(d.lat) : "",
      lng: d.lng !== null ? String(d.lng) : "",
      linkMaps: d.link,
    }));
    setAuto(new Set(preenchidos.map(([k]) => k)));
  };

  const rotulo = "text-xs font-medium text-stone-600";
  return (
    <form action={acao} className="space-y-6">
      {estado.ok && estado.id && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
          <b>{estado.nome}</b> cadastrado. <Link href={`/painel/clientes/${estado.id}`} className="font-semibold underline">Abrir ficha</Link> ou continue com o próximo.
        </p>
      )}

      <PuxarDoGoogle aoAchar={aoAchar} />
      <input type="hidden" name="lat" value={c.lat} />
      <input type="hidden" name="lng" value={c.lng} />
      <input type="hidden" name="linkMaps" value={c.linkMaps} />

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-eggs text-lg font-extrabold text-terra">Quem é</legend>
        <label className={`${rotulo} sm:col-span-2`}>Nome do cliente<input {...campo("nomeFantasia")} required maxLength={80} placeholder="Ex: Padaria Pão Quente" className={`campo mt-1${destaque("nomeFantasia")}`} /></label>
        <label className={rotulo}>Tipo de comércio
          <select {...campo("tipoNegocio")} required className={`campo mt-1${destaque("tipoNegocio")}`}><option value="" disabled>Escolha…</option>{TIPOS_NEGOCIO.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className={rotulo}>Telefone / WhatsApp<input {...campo("whatsapp")} required inputMode="tel" placeholder="(51) 99999-9999" className={`campo mt-1${destaque("whatsapp")}`} /></label>
        <label className={`${rotulo} sm:col-span-2`}>Responsável (opcional)<input name="responsavel" maxLength={80} placeholder="Com quem falar" className="campo mt-1" /></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-eggs text-lg font-extrabold text-terra">Onde entregar</legend>
        <label className={`${rotulo} sm:col-span-2`}>Endereço (rua e número)<input {...campo("endereco")} required maxLength={200} placeholder="Ex: Av. Assis Brasil, 1200" className={`campo mt-1${destaque("endereco")}`} /></label>
        <label className={rotulo}>Bairro<input {...campo("bairro")} maxLength={80} className={`campo mt-1${destaque("bairro")}`} /></label>
        <label className={rotulo}>CEP<input {...campo("cep")} inputMode="numeric" maxLength={9} placeholder="90000-000" className={`campo mt-1${destaque("cep")}`} /></label>
        <label className={rotulo}>Cidade
          <input {...campo("cidade")} list="cidades" maxLength={60} className={`campo mt-1${destaque("cidade")}`} />
          <datalist id="cidades">{CIDADES.map((x) => <option key={x} value={x} />)}</datalist>
        </label>
        {regioes.length > 0 && (
          <label className={rotulo}>Região de entrega
            <select name="regiaoId" defaultValue="" className="campo mt-1"><option value="">Definir depois</option>{regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
          </label>
        )}
        {c.lat && <p className="flex items-center gap-1.5 text-xs text-folha sm:col-span-2"><MapPin className="size-3.5" /> Posição exata do Google salva: a rota do dia já sabe onde fica.</p>}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-eggs text-lg font-extrabold text-terra">Pagamento e valores da caixa</legend>
        <label className={rotulo}>Forma de pagamento
          <select name="formaPagamento" required defaultValue="Dinheiro" className="campo mt-1">{FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
        <label className={rotulo}>Quando paga
          <select name="prazoPagamentoDias" defaultValue="0" className="campo mt-1">{PRAZOS_PAGAMENTO.map((p) => <option key={p} value={p}>{p ? condicaoPagamento(p) : "À vista, no dia da entrega"}</option>)}</select>
        </label>
        <label className={rotulo}>Valor de venda da caixa (R$)<input name="valorVenda" inputMode="decimal" placeholder="Ex: 190,00" value={venda} onChange={(e) => setVenda(e.target.value)} className="campo mt-1" /></label>
        <label className={rotulo}>Valor de custo da caixa (R$)<input name="valorCusto" inputMode="decimal" placeholder="Ex: 140,00" value={custo} onChange={(e) => setCusto(e.target.value)} className="campo mt-1" /></label>
        <div className="sm:col-span-2"><MargemAoVivo venda={venda} custo={custo} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="notaFiscal" value="1" className="size-4 accent-marca-800" /> Precisa de nota fiscal</label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-dashed border-stone-300 p-4 sm:grid-cols-2">
        <legend className="px-1 font-eggs text-lg font-extrabold text-terra">Já tem valor em aberto?</legend>
        <p className="text-xs text-stone-500 sm:col-span-2">Se esse cliente já deve alguma coisa, lance aqui. Passou do vencimento sem pagar, o sistema marca em vermelho e avisa no painel.</p>
        <label className={rotulo}>Valor em aberto (R$)<input name="saldoAberto" inputMode="decimal" placeholder="0,00" value={saldo} onChange={(e) => setSaldo(e.target.value)} className="campo mt-1" /></label>
        <label className={rotulo}>Vence em<input name="vencimentoSaldo" type="date" defaultValue={hoje} disabled={!num(saldo)} className="campo mt-1 disabled:opacity-50" /></label>
      </fieldset>

      <label className={`${rotulo} block`}>Observações (opcional)<textarea name="observacoes" rows={2} maxLength={1000} placeholder="Ex: entregar pelos fundos, falar com o Carlos" className="campo mt-1" /></label>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={enviando} className="botao-primario px-6 py-2.5">{enviando ? "Salvando…" : "Salvar e cadastrar o próximo"}</button>
        {estado.erro && <p className="text-sm text-red-600" role="alert">{estado.erro}</p>}
      </div>
    </form>
  );
}

/** Ficha do cliente: valores da caixa */
export function FormValoresCaixa({ clienteId, venda, custo }: { clienteId: string; venda: number | null; custo: number | null }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(salvarValoresCaixa.bind(null, clienteId), {});
  const f = (v: number | null) => (v ? String(v.toFixed(2)).replace(".", ",") : "");
  const [v, setV] = useState(f(venda));
  const [c, setC] = useState(f(custo));
  return (
    <form action={acao} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-stone-500">Venda da caixa (R$)<input name="valorVenda" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className="campo mt-1" /></label>
        <label className="text-xs text-stone-500">Custo da caixa (R$)<input name="valorCusto" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} className="campo mt-1" /></label>
      </div>
      <MargemAoVivo venda={v} custo={c} />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-primario">Salvar valores</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Salvo.</p>}
      </div>
    </form>
  );
}

/** Ficha do cliente: lançar valor em aberto avulso */
export function FormEmAberto({ clienteId, hoje }: { clienteId: string; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(lancarEmAberto.bind(null, clienteId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) ref.current?.reset(); }, [estado.ok]);
  return (
    <form ref={ref} action={acao} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input name="valor" inputMode="decimal" required placeholder="Valor (R$)" className="campo" />
        <input name="vencimento" type="date" required defaultValue={hoje} className="campo" />
      </div>
      <input name="descricao" maxLength={120} placeholder="Do que é (ex: entrega de 04/11)" className="campo" />
      <div className="flex items-center gap-3">
        <button disabled={enviando} className="botao-secundario">Lançar em aberto</button>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && !estado.erro && <p className="text-sm text-marca-700">Lançado.</p>}
      </div>
    </form>
  );
}
