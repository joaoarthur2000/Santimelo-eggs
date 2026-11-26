"use client";

import { useState, useTransition, type RefObject } from "react";
import { Search } from "lucide-react";
import { buscarCadastro, type Opcao } from "./completar/actions";

const CAMPOS = { endereco: "endereco", bairro: "bairro", cidade: "cidade", cep: "cep", whatsapp: "whatsapp", tipoNegocio: "tipoNegocio", cnpj: "cnpj", razaoSocial: "razaoSocial" } as const;

/** Na ficha: busca pelo nome, link do Maps ou CNPJ e preenche os campos do formulário (amarelo até alguém mexer). Não salva */
export function PreencherPeloGoogle({ formulario, nome }: { formulario: RefObject<HTMLFormElement | null>; nome: string }) {
  const [termo, setTermo] = useState(nome);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [usada, setUsada] = useState<Opcao | null>(null);
  const [buscando, iniciar] = useTransition();

  function buscar() {
    setErro(null);
    setOpcoes([]);
    iniciar(async () => {
      const r = await buscarCadastro(termo, nome);
      if ("erro" in r) setErro(r.erro);
      else setOpcoes(r.opcoes);
    });
  }

  function usar(o: Opcao) {
    const form = formulario.current;
    if (!form) return;
    for (const [campo, chave] of Object.entries(CAMPOS)) {
      const el = form.elements.namedItem(campo);
      const valor = o[chave as keyof Opcao];
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || typeof valor !== "string" || !valor) continue;
      el.value = valor;
      el.classList.add("campo-auto");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.addEventListener("input", () => el.classList.remove("campo-auto"), { once: true });
    }
    // mexeu no endereço depois: a posição exata do Google não vale mais
    const rua = form.elements.namedItem("endereco");
    if (rua instanceof HTMLInputElement) rua.addEventListener("input", () => setUsada((u) => (u ? { ...u, lat: null, lng: null, link: "" } : u)), { once: true });
    setUsada(o);
    setOpcoes([]);
  }

  return (
    <div className="rounded-xl bg-concha p-3">
      <p className="text-sm font-medium text-marca-950">Preencher sozinho</p>
      <div className="mt-1.5 flex gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault(); // Enter aqui busca, não salva a ficha
            buscar();
          }}
          aria-label="Nome, link do Google Maps ou CNPJ"
          placeholder="Nome, link do Maps ou CNPJ"
          autoComplete="off"
          className="campo"
        />
        <button type="button" onClick={buscar} disabled={buscando} className="botao-secundario shrink-0">
          {buscando ? <span className="size-4 animate-spin rounded-full border-2 border-terra/20 border-t-terra" aria-label="Buscando" /> : <Search className="size-4" aria-hidden />} Buscar
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {erro}
        </p>
      )}
      {usada && !opcoes.length && <p className="mt-2 text-sm text-noz">Preenchi o que achei de {usada.nome ?? "lá"}, em amarelo. Confira e salve.</p>}
      {opcoes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {opcoes.map((o, n) => (
            <li key={n}>
              <button type="button" onClick={() => usar(o)} className="w-full rounded-xl bg-white p-3 text-left text-sm ring-1 ring-stone-200 ring-inset hover:ring-ouro active:bg-ouro/10">
                <b className="font-semibold text-marca-950">{o.nome}</b>
                <span className="block text-stone-600">{[o.endereco, o.bairro, o.cidade].filter(Boolean).join(" · ") || "sem endereço"}</span>
                <span className="block text-stone-500">{o.whatsapp ?? "sem telefone"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="hidden" name="lat" value={usada?.lat ?? ""} readOnly />
      <input type="hidden" name="lng" value={usada?.lng ?? ""} readOnly />
      <input type="hidden" name="linkMaps" value={usada?.link ?? ""} readOnly />
    </div>
  );
}
