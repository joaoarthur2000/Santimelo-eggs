"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Eraser, PackageMinus, PencilLine, SlidersHorizontal, Trash2, X } from "lucide-react";
import { CampoData } from "@/components/campo-data";
import { excluirMovimento, registrarContagem, registrarPerda, zerarEstoque, zerarItem } from "./actions";

type Estado = { erro?: string; ok?: number };
const MOTIVOS = ["Quebrou / trincou", "Venceu", "Uso interno", "Doação", "Devolvido ao fornecedor", "Outro"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// "9,5" → 9.5 (vazio/ inválido = null)
const numero = (v: string) => {
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

/** Janela modal nativa (<dialog>): foco preso, Esc fecha, animação de entrada no CSS (.dialogo) */
function Janela({ refDialogo, titulo, subtitulo, children }: { refDialogo: React.RefObject<HTMLDialogElement | null>; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <dialog
      ref={refDialogo}
      className="dialogo"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close(); // clique fora fecha
      }}
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-marca-950">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-stone-500">{subtitulo}</p>}
          </div>
          <button type="button" onClick={() => refDialogo.current?.close()} aria-label="Fechar" className="toque grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

type Modo = "tirar" | "corrigir" | "zerar";
const MODOS: { id: Modo; rotulo: string; icone: typeof Eraser }[] = [
  { id: "tirar", rotulo: "Tirar caixas", icone: PackageMinus },
  { id: "corrigir", rotulo: "Corrigir", icone: SlidersHorizontal },
  { id: "zerar", rotulo: "Zerar", icone: Eraser },
];

/** Botão "Editar" do cartão do produto: tira caixas, corrige a quantidade (contagem) ou zera */
export function EditarEstoque({
  item,
  saldo,
  abrev,
  fornecedores,
  hoje,
}: {
  item: { id: string; nome: string };
  saldo: number;
  abrev: string;
  fornecedores: { id: string; nome: string; saldo: number }[];
  hoje: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<Modo>("tirar");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [contado, setContado] = useState("");
  const [zerando, iniciarZerar] = useTransition();
  const fechar = () => ref.current?.close();

  const [estTirar, tirar, tirando] = useActionState<Estado, FormData>(async (e, f) => {
    const r = await registrarPerda(e, f);
    if (r.ok && !r.erro) fechar();
    return r;
  }, {});
  const [estCorrigir, corrigir, corrigindo] = useActionState<Estado, FormData>(async (e, f) => {
    const r = await registrarContagem(e, f);
    if (r.ok && !r.erro) fechar();
    return r;
  }, {});

  const novo = numero(contado);
  const diferenca = novo === null ? null : Math.round((novo - saldo) * 1000) / 1000;
  const comSaldo = fornecedores.filter((f) => f.saldo > 0.001);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModo("tirar");
          setContado(fmt(Math.max(0, saldo)));
          ref.current?.showModal();
        }}
        className="botao-secundario h-9 px-3 max-lg:h-auto"
      >
        <PencilLine className="size-4" /> Editar
      </button>

      <Janela refDialogo={ref} titulo={`Editar estoque · ${item.nome}`} subtitulo={`Agora: ${fmt(saldo)} ${abrev}`}>
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-[13px]">
          {MODOS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-medium max-lg:py-3 transition-[background-color,color,box-shadow] duration-150 ${
                modo === id ? "bg-white text-marca-950 shadow-[0_1px_2px_rgb(41_28_18/0.12)]" : "text-stone-500 hover:text-marca-950"
              }`}
            >
              <Icone className="size-3.5" /> {rotulo}
            </button>
          ))}
        </div>

        {modo === "tirar" && (
          <form action={tirar} className="space-y-4">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="observacao" value={motivo} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-stone-600">
                Quantas caixas sair ({abrev})
                <input name="quantidade" inputMode="decimal" required autoFocus placeholder="Ex: 2" className="campo mt-1.5" />
              </label>
              <label className="text-xs font-medium text-stone-600">
                Data
                <CampoData name="dia" required defaultValue={hoje} max={hoje} min="2020-01-01" className="campo mt-1.5" />
              </label>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-stone-600">Motivo</legend>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(m)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 max-lg:min-h-11 max-lg:px-4 ring-inset transition-colors duration-150 ${
                      motivo === m ? "bg-marca-900 text-white ring-marca-900" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </fieldset>
            {comSaldo.length > 0 && (
              <label className="block text-xs font-medium text-stone-600">
                Saiu das caixas de qual fornecedor?
                <select name="fornecedorId" defaultValue="" className="campo mt-1.5">
                  <option value="">Não sei / não importa</option>
                  {comSaldo.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} · {fmt(f.saldo)} {abrev}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {estTirar.erro && <p className="text-sm text-red-600" role="alert">{estTirar.erro}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={fechar} className="botao-secundario">Cancelar</button>
              <button disabled={tirando} className="botao-primario">{tirando ? "Salvando…" : "Tirar do estoque"}</button>
            </div>
          </form>
        )}

        {modo === "corrigir" && (
          <form action={corrigir} className="space-y-4">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="block text-xs font-medium text-stone-600">
              Quanto tem de verdade agora ({abrev})
              <input name="contado" inputMode="decimal" required autoFocus value={contado} onChange={(e) => setContado(e.target.value)} className="campo tabular mt-1.5 h-12 text-lg font-semibold" />
            </label>
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-stone-200/70 ring-inset">
              {diferenca === null || diferenca === 0 ? (
                "Digite a quantidade contada. O sistema lança só a diferença, como ajuste no extrato."
              ) : (
                <>
                  Vai lançar um ajuste de{" "}
                  <b className={diferenca > 0 ? "text-emerald-700" : "text-red-700"}>
                    {diferenca > 0 ? "+" : "−"}
                    {fmt(Math.abs(diferenca))} {abrev}
                  </b>{" "}
                  ({fmt(saldo)} → {fmt(novo!)}).
                </>
              )}
            </p>
            {estCorrigir.erro && <p className="text-sm text-red-600" role="alert">{estCorrigir.erro}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={fechar} className="botao-secundario">Cancelar</button>
              <button disabled={corrigindo || diferenca === null || diferenca === 0} className="botao-primario">{corrigindo ? "Salvando…" : "Salvar contagem"}</button>
            </div>
          </form>
        )}

        {modo === "zerar" && (
          <div className="space-y-4">
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200 ring-inset">
              Deixa <b>{item.nome}</b> com 0 {abrev} (inclusive no estoque de cada fornecedor). O histórico continua no extrato e dá pra desfazer excluindo o ajuste.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fechar} className="botao-secundario">Cancelar</button>
              <button
                type="button"
                disabled={zerando || Math.abs(saldo) < 0.001}
                onClick={() =>
                  iniciarZerar(async () => {
                    await zerarItem(item.id);
                    fechar();
                  })
                }
                className="botao-primario bg-red-700 hover:bg-red-800"
              >
                <Eraser className="size-4" /> {zerando ? "Zerando…" : "Zerar este produto"}
              </button>
            </div>
          </div>
        )}
      </Janela>
    </>
  );
}

/** Topo da aba: zera todos os produtos de uma vez (pede pra digitar ZERAR) */
export function ZerarTudo({ desativado }: { desativado: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [texto, setTexto] = useState("");
  const [zerando, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={desativado}
        onClick={() => {
          setTexto("");
          ref.current?.showModal();
        }}
        className="botao-secundario text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800"
      >
        <Eraser className="size-4" /> Zerar estoque
      </button>
      <Janela refDialogo={ref} titulo="Zerar todo o estoque" subtitulo="Todos os produtos ficam com 0 caixas.">
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200 ring-inset">
            O sistema lança ajustes no extrato pra deixar cada produto (e cada fornecedor) em zero. Nada é apagado: dá pra desfazer excluindo os ajustes.
          </p>
          <label className="block text-xs font-medium text-stone-600">
            Pra confirmar, digite <b>ZERAR</b>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" className="campo mt-1.5 tracking-widest uppercase" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="botao-secundario">Cancelar</button>
            <button
              type="button"
              disabled={zerando || texto.trim().toUpperCase() !== "ZERAR"}
              onClick={() =>
                iniciar(async () => {
                  await zerarEstoque();
                  ref.current?.close();
                })
              }
              className="botao-primario bg-red-700 hover:bg-red-800"
            >
              {zerando ? "Zerando…" : "Zerar tudo"}
            </button>
          </div>
        </div>
      </Janela>
    </>
  );
}

/** Lixeira do extrato em dois toques (sem caixa de confirmação do navegador): evita apagar compra sem querer */
export function ExcluirLancamento({ id }: { id: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [apagando, iniciar] = useTransition();
  if (!confirmar)
    return (
      <button type="button" onClick={() => setConfirmar(true)} aria-label="Excluir lançamento" title="Excluir" className="grid size-7 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600">
        <Trash2 className="size-3.5" />
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <button
        type="button"
        disabled={apagando}
        onClick={() => iniciar(() => excluirMovimento(id))}
        className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        {apagando ? "…" : "Excluir"}
      </button>
      <button type="button" onClick={() => setConfirmar(false)} className="rounded-md px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-100">
        Não
      </button>
    </span>
  );
}
