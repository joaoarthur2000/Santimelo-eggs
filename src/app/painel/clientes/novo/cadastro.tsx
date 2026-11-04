"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Check, ChevronDown, Copy, LoaderCircle, MapPin, MessageCircle } from "lucide-react";
import { CIDADES, FORMAS_PAGAMENTO, PRAZOS_PAGAMENTO, TIPOS_NEGOCIO } from "@/lib/constantes";
import { baseDoLogin } from "@/lib/login";
import { cadastrarCliente, type Cadastro } from "../../actions";

type Regiao = { id: string; nome: string; bairros: string | null };

const ICONE_TIPO: Record<string, string> = { Restaurante: "🍽️", Lancheria: "🍔", Padaria: "🥖", Confeitaria: "🧁" };
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const digitos = (t: string) => t.replace(/\D/g, "");
const mascaraCep = (t: string) => digitos(t).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const mascaraFone = (t: string) => {
  const d = digitos(t).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

/** Região de entrega pelo bairro (lista de bairros de cada região, na aba Entregas) */
const regiaoDoBairro = (regioes: Regiao[], bairro: string) =>
  regioes.find((r) => (r.bairros ?? "").split(",").some((b) => sem(b) && sem(b) === sem(bairro)))?.id ?? "";

function Passo({ n, titulo, sub, children }: { n: number; titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="cartao p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gema-400 text-lg font-bold text-casca-900">{n}</span>
        <div>
          <h2 className="text-lg font-bold text-marca-950">{titulo}</h2>
          <p className="text-sm text-stone-500">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Grupo de opções em "pílulas" (radio por baixo) */
function Pilulas({ nome, opcoes, inicial, colunas = "" }: { nome: string; opcoes: { valor: string; rotulo: React.ReactNode }[]; inicial?: string; colunas?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${colunas}`}>
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 transition hover:ring-marca-400 has-[:checked]:bg-marca-900 has-[:checked]:text-white has-[:checked]:ring-marca-900 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-marca-500"
        >
          <input type="radio" name={nome} value={o.valor} defaultChecked={o.valor === inicial} required className="sr-only" />
          {o.rotulo}
        </label>
      ))}
    </div>
  );
}

const rotulo = "block text-sm font-medium text-stone-700";

export function CadastroCliente({ regioes, linkApp }: { regioes: Regiao[]; linkApp: string }) {
  const [estado, acao, enviando] = useActionState<Cadastro, FormData>(cadastrarCliente, {});
  const [nome, setNome] = useState("");
  const [cep, setCep] = useState("");
  const [busca, setBusca] = useState<"" | "buscando" | "achou" | "naoachou">("");
  const [endereco, setEndereco] = useState({ rua: "", bairro: "", cidade: "Porto Alegre" });
  const [regiaoId, setRegiaoId] = useState("");
  const [fone, setFone] = useState("");
  const [liberar, setLiberar] = useState(true);
  const numeroRef = useRef<HTMLInputElement>(null);

  async function buscarCep(valor: string) {
    const c = digitos(valor);
    if (c.length !== 8) return;
    setBusca("buscando");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const d = await r.json();
      if (d.erro) throw new Error();
      const novo = { rua: d.logradouro ?? "", bairro: d.bairro ?? "", cidade: d.localidade ?? "" };
      setEndereco(novo);
      setRegiaoId(regiaoDoBairro(regioes, novo.bairro));
      setBusca("achou");
      setTimeout(() => numeroRef.current?.focus(), 50);
    } catch {
      setBusca("naoachou");
    }
  }

  if (estado.clienteId) return <Sucesso estado={estado} linkApp={linkApp} />;

  const login = baseDoLogin(nome);
  const foraDaRegiao = endereco.cidade && !(CIDADES as readonly string[]).includes(endereco.cidade);

  return (
    <form action={acao} className="space-y-5">
      <Passo n={1} titulo="Quem é o cliente?" sub="O básico pra gente conhecer a casa.">
        <p className={rotulo}>Tipo de negócio</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS_NEGOCIO.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl bg-white py-4 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:ring-marca-400 has-[:checked]:bg-gema-100 has-[:checked]:text-casca-900 has-[:checked]:ring-2 has-[:checked]:ring-gema-500"
            >
              <input type="radio" name="tipoNegocio" value={t} required className="sr-only" />
              <span className="text-3xl" aria-hidden>{ICONE_TIPO[t]}</span>
              {t}
            </label>
          ))}
        </div>

        <label className={`${rotulo} mt-5`}>
          Nome do estabelecimento
          <input name="nomeFantasia" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Padaria Pão Quente" className="campo mt-1 text-base" />
        </label>
        {login && (
          <p className="mt-1.5 text-xs text-stone-500">
            Login no app: <b className="font-mono text-sm tracking-wider text-marca-800">{login}</b> {liberar ? "(se já existir, ganha um número no fim)" : ""}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={rotulo}>
            Quem faz os pedidos?
            <input name="responsavel" required placeholder="Ex: Marina" className="campo mt-1" />
          </label>
          <label className={rotulo}>
            WhatsApp
            <input name="whatsapp" required inputMode="tel" value={fone} onChange={(e) => setFone(mascaraFone(e.target.value))} placeholder="(51) 99999-9999" className="campo mt-1" />
          </label>
        </div>
      </Passo>

      <Passo n={2} titulo="Onde a gente entrega?" sub="Coloca o CEP que o resto vem sozinho.">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
          <label className={rotulo}>
            CEP
            <input
              name="cep"
              required
              inputMode="numeric"
              value={cep}
              onChange={(e) => {
                const v = mascaraCep(e.target.value);
                setCep(v);
                if (digitos(v).length === 8) buscarCep(v);
                else setBusca("");
              }}
              placeholder="00000-000"
              className="campo mt-1 font-mono text-base tracking-wider"
            />
          </label>
          <p className="flex min-h-10 items-center gap-1.5 text-sm" aria-live="polite">
            {busca === "buscando" && <><LoaderCircle className="size-4 animate-spin text-stone-500" /> Procurando o endereço…</>}
            {busca === "achou" && <><MapPin className="size-4 text-marca-700" /> <span className="text-marca-800">Achei! Agora só o número.</span></>}
            {busca === "naoachou" && <span className="text-amber-700">Não achei esse CEP. Preenche o endereço aqui embaixo.</span>}
          </p>
        </div>

        {(busca === "achou" || busca === "naoachou" || endereco.rua) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <label className={`${rotulo} sm:col-span-4`}>
              Rua
              <input name="rua" required value={endereco.rua} onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })} className="campo mt-1" />
            </label>
            <label className={`${rotulo} sm:col-span-1`}>
              Número
              <input ref={numeroRef} name="numero" required inputMode="numeric" className="campo mt-1" />
            </label>
            <label className={`${rotulo} sm:col-span-1`}>
              Compl.
              <input name="complemento" placeholder="opcional" className="campo mt-1" />
            </label>
            <label className={`${rotulo} sm:col-span-3`}>
              Bairro
              <input
                name="bairro"
                required
                value={endereco.bairro}
                onChange={(e) => {
                  setEndereco({ ...endereco, bairro: e.target.value });
                  setRegiaoId(regiaoDoBairro(regioes, e.target.value) || regiaoId);
                }}
                className="campo mt-1"
              />
            </label>
            <label className={`${rotulo} sm:col-span-3`}>
              Cidade
              <input name="cidade" required list="cidades" value={endereco.cidade} onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })} className="campo mt-1" />
              <datalist id="cidades">
                {CIDADES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            {foraDaRegiao && <p className="text-xs font-medium text-amber-700 sm:col-span-6">Fora de Porto Alegre e região. Confirma se dá pra entregar.</p>}
            <label className={`${rotulo} sm:col-span-6`}>
              Região de entrega {regiaoId && <span className="font-normal text-marca-700">· escolhida pelo bairro</span>}
              <select name="regiaoId" value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} className="campo mt-1">
                <option value="">Escolher depois</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Passo>

      <Passo n={3} titulo="Como ele paga?" sub="Três toques e pronto.">
        <p className={rotulo}>Quando paga</p>
        <div className="mt-2">
          <Pilulas nome="prazoPagamentoDias" inicial="0" opcoes={PRAZOS_PAGAMENTO.map((d) => ({ valor: String(d), rotulo: d ? `${d} dias` : "À vista" }))} />
        </div>
        <p className={`${rotulo} mt-4`}>Como paga</p>
        <div className="mt-2">
          <Pilulas nome="formaPagamento" inicial="Pix" opcoes={FORMAS_PAGAMENTO.map((f) => ({ valor: f, rotulo: f }))} />
        </div>
        <p className={`${rotulo} mt-4`}>Nota fiscal</p>
        <div className="mt-2">
          <Pilulas nome="notaFiscal" inicial="0" opcoes={[{ valor: "1", rotulo: "🧾 Com NF" }, { valor: "0", rotulo: "Sem NF" }]} />
        </div>
      </Passo>

      <details className="cartao group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-marca-950 [&::-webkit-details-marker]:hidden">
          <span>Mais detalhes <span className="ml-1 text-sm font-normal text-stone-500">opcional</span></span>
          <ChevronDown className="ml-auto size-4 text-stone-500 transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={rotulo}>
            Razão social
            <input name="razaoSocial" className="campo mt-1" />
          </label>
          <label className={rotulo}>
            CNPJ ou CPF
            <input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" className="campo mt-1" />
          </label>
          <label className={rotulo}>
            E-mail
            <input name="email" type="email" className="campo mt-1" />
          </label>
          <label className={rotulo}>
            Consumo (caixas por semana)
            <input name="consumoSemanal" inputMode="decimal" className="campo mt-1" />
          </label>
          <label className={rotulo}>
            Limite em aberto (R$)
            <input name="limiteCredito" inputMode="decimal" placeholder="sem limite" className="campo mt-1" />
          </label>
          <label className={`${rotulo} sm:col-span-2`}>
            O que foi combinado (o cliente vê no app)
            <textarea name="negociacao" rows={2} placeholder="Ex: mínimo de 1 caixa por pedido" className="campo mt-1" />
          </label>
          <label className={`${rotulo} sm:col-span-2`}>
            Observações internas (o cliente não vê)
            <textarea name="observacoes" rows={2} className="campo mt-1" />
          </label>
        </div>
      </details>

      <div className="cartao flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-700">
          <input type="checkbox" name="liberarApp" value="1" checked={liberar} onChange={(e) => setLiberar(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-stone-300 transition peer-checked:bg-marca-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-marca-500 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          <span>
            <b className="block text-marca-950">Liberar o app EGGS agora</b>
            Gera login e senha pra ele pedir pelo celular
          </span>
        </label>
        <button disabled={enviando} className="botao-primario px-6 py-3 text-base">
          {enviando ? "Chocando…" : liberar ? "🥚 Cadastrar e liberar o app" : "🥚 Cadastrar cliente"}
        </button>
      </div>
      {estado.erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{estado.erro}</p>}
    </form>
  );
}

function Sucesso({ estado, linkApp }: { estado: Cadastro; linkApp: string }) {
  const [copiado, setCopiado] = useState(false);
  const primeiro = estado.responsavel?.split(" ")[0] || "tudo bem";
  const mensagem = `Olá, ${primeiro}! 🥚 Que alegria ter a ${estado.nome} com a Santimelo!\n\nSeu acesso ao app EGGS, pra pedir ovos quando quiser:\n${linkApp}\n\nLogin: ${estado.login}\nSenha: ${estado.senha}\n\nQualquer dúvida, é só chamar. Bons pedidos! 🐣`;
  const whats = digitos(estado.whatsapp ?? "");

  return (
    <div className="relative overflow-hidden rounded-3xl bg-casca-900 p-6 text-center text-gema-50 sm:p-10">
      {/* confete de ovinhos */}
      {["🥚", "✨", "🐣", "🥚", "✨", "🐥", "🥚", "✨"].map((c, i) => (
        <span key={i} className="eggs-confete pointer-events-none absolute top-0 text-2xl" style={{ left: `${6 + i * 12}%`, animationDelay: `${(i % 4) * 0.25}s` }} aria-hidden>
          {c}
        </span>
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/eggs/guinho/guinho-comemorando.png" alt="" className="eggs-ginga mx-auto h-44" />
      <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Chocou! 🐣</h2>
      <p className="mx-auto mt-2 max-w-md text-lg text-gema-200">
        <b className="text-gema-50">{estado.nome}</b> agora é cliente Santimelo. O Guinho já tá separando os ovos!
      </p>

      {estado.login ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl bg-white p-5 text-left text-stone-800">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Acesso ao app EGGS · a senha só aparece agora</p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-stone-500">Login</dt>
              <dd className="font-mono text-xl font-bold tracking-wider text-marca-900">{estado.login}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Senha</dt>
              <dd className="font-mono text-xl font-bold tracking-wider text-marca-900">{estado.senha}</dd>
            </div>
          </dl>
          {estado.qr && (
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-stone-50 p-3">
              <div className="size-28 shrink-0 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: estado.qr }} />
              <p className="text-xs text-stone-600">
                <b className="block text-sm text-marca-900">QR de acesso dele</b>
                O cliente escaneia com a câmera: o app abre com o login já preenchido, falta só a senha. Ele também fica na ficha do cliente.
              </p>
            </div>
          )}
          <p className="mt-2 break-all text-xs text-stone-500">{linkApp}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {whats && (
              <a href={`https://wa.me/55${whats}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
                <MessageCircle className="size-4" /> Mandar no WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(mensagem);
                setCopiado(true);
              }}
              className="botao-secundario justify-center"
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? "Copiado!" : "Copiar mensagem"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mx-auto mt-4 max-w-md text-sm text-gema-200">Sem app por enquanto: os pedidos dele entram por WhatsApp ou telefone. Dá pra liberar o app depois, na ficha.</p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={`/painel/clientes/${estado.clienteId}`} className="rounded-xl bg-gema-400 px-5 py-2.5 font-bold text-casca-900 hover:bg-gema-300">
          Ver ficha do cliente
        </Link>
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl px-5 py-2.5 font-semibold text-gema-50 ring-1 ring-gema-200/40 hover:bg-white/10">
          Cadastrar outro
        </button>
      </div>
    </div>
  );
}
