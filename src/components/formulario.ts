"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

/** `campos`: campos com erro, que impediram de salvar. `avisos`: salvou, mas o campo parece errado (nome do campo → mensagem) */
export type EstadoDoForm = { erro?: string; ok?: number; campos?: Record<string, string>; avisos?: Record<string, string> };

/** Pinta o campo e escreve a mensagem embaixo (no erro, leva o cursor pro primeiro). Some quando a pessoa mexe nele */
function marcar(form: HTMLFormElement, campos: Record<string, string>, tipo: "erro" | "aviso") {
  const desfazer: (() => void)[] = [];
  let primeiro: HTMLElement | null = null;
  for (const [nome, mensagem] of Object.entries(campos)) {
    const achado = form.elements.namedItem(nome);
    let el: Element | null = achado instanceof RadioNodeList ? (achado[0] as Element) : achado;
    // CampoData manda o valor num campo escondido: o que se vê é o vizinho
    if (el instanceof HTMLInputElement && el.type === "hidden") el = el.parentElement?.querySelector("input:not([type=hidden])") ?? el;
    if (!(el instanceof HTMLElement)) continue;
    const alvo = el;
    const aviso = document.createElement("span");
    aviso.className = tipo === "erro" ? "erro-campo" : "aviso-campo";
    aviso.setAttribute("role", tipo === "erro" ? "alert" : "status");
    aviso.textContent = mensagem;
    const marca = tipo === "erro" ? "aria-invalid" : "data-aviso";
    alvo.setAttribute(marca, "true");
    (achado instanceof RadioNodeList ? (alvo.closest("fieldset") ?? form) : (alvo.closest("label") ?? alvo.parentElement ?? form)).append(aviso);
    const tirar = () => {
      alvo.removeAttribute(marca);
      aviso.remove();
      for (const e of ["input", "change"]) form.removeEventListener(e, seForEle);
    };
    const seForEle = (e: Event) => {
      if ((e.target as HTMLInputElement).name === nome || e.target === alvo) tirar();
    };
    for (const e of ["input", "change"]) form.addEventListener(e, seForEle);
    desfazer.push(tirar);
    primeiro ??= alvo;
  }
  if (primeiro && tipo === "erro") {
    primeiro.focus({ preventScroll: true });
    primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
    // texto selecionado: digitar já troca só o que estava errado
    if (primeiro instanceof HTMLInputElement && ["text", "email", "tel", "search"].includes(primeiro.type)) primeiro.select();
  }
  return () => desfazer.forEach((f) => f());
}

/**
 * Formulário que não perde o que foi digitado. O React 19 limpa os campos depois de toda action em <form action>,
 * inclusive quando ela volta com erro; aqui o envio é pelo onSubmit, que não limpa nada.
 * Erro: marca só os campos errados. Certo: mantém, ou esvazia com `limpar` (lançamento em série).
 */
export function useFormulario<E extends EstadoDoForm>(acao: (e: E, form: FormData) => Promise<E>, inicial: E, { limpar = false }: { limpar?: boolean } = {}) {
  const [estado, despachar, enviando] = useActionState<E, FormData>(acao as (e: Awaited<E>, form: FormData) => Promise<E>, inicial as Awaited<E>);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    if (!estado.erro && estado.ok) {
      if (!limpar) return marcar(form, estado.avisos ?? {}, "aviso");
      form.reset();
      return;
    }
    return marcar(form, estado.campos ?? {}, "erro");
  }, [estado, limpar]);

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => despachar(dados));
  }
  return { estado, enviando, ref, aoEnviar };
}
