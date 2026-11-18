"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";

// O <input type="date"> segue o idioma do navegador (pode virar mm/dd/aaaa).
// Este campo mostra sempre dd/mm/aaaa, aceita digitar ou escolher no calendário,
// e envia no formulário a data em ISO (aaaa-mm-dd) com o mesmo `name` de antes.

const paraBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

function paraISO(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const data = new Date(Date.UTC(+a, +mes - 1, +d));
  if (data.getUTCFullYear() !== +a || data.getUTCMonth() !== +mes - 1 || data.getUTCDate() !== +d) return null;
  return `${a}-${mes}-${d}`;
}

const mascara = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join("/");
};

export function CampoData({
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  required,
  className = "",
  "aria-label": ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [interno, setInterno] = useState(defaultValue);
  const iso = value !== undefined ? value : interno;
  const [texto, setTexto] = useState(paraBR(iso));
  const [ultimo, setUltimo] = useState(iso);
  const campo = useRef<HTMLInputElement>(null);
  const calendario = useRef<HTMLInputElement>(null);

  // valor trocado por fora (ex.: limpar o formulário): mostra a nova data
  if (iso !== ultimo) {
    setUltimo(iso);
    setTexto(paraBR(iso));
  }

  function emitir(novo: string) {
    setUltimo(novo);
    setInterno(novo);
    onChange?.(novo);
  }

  function validar(t: string, novo: string | null) {
    let erro = "";
    if (t && !novo) erro = "Data inválida: use dia/mês/ano (ex.: 05/11/2026)";
    else if (novo && max && novo > max) erro = `A data não pode passar de ${paraBR(max)}`;
    else if (novo && min && novo < min) erro = `A data não pode ser antes de ${paraBR(min)}`;
    campo.current?.setCustomValidity(erro);
  }

  // margem/largura vão na caixa; o resto (visual do campo) vai no input
  const classes = className.split(/\s+/).filter(Boolean);
  const externo = classes.filter((c) => /^(m[tbxy]?-|w-|min-w-|shrink|flex-|basis-)/.test(c));
  const interno_ = classes.filter((c) => !externo.includes(c) && c !== "w-auto");

  return (
    <div className={`relative ${externo.some((c) => c.startsWith("w-")) ? "" : "w-full"} ${externo.join(" ")}`.replace("w-auto", "w-44")}>
      <input
        ref={campo}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        required={required}
        aria-label={ariaLabel}
        value={texto}
        onChange={(e) => {
          const t = mascara(e.target.value);
          const novo = paraISO(t);
          setTexto(t);
          validar(t, novo);
          emitir(novo ?? "");
        }}
        className={`${interno_.join(" ")} w-full pr-10 tabular`}
      />
      <input
        ref={calendario}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        min={min}
        max={max}
        onChange={(e) => {
          const novo = e.target.value;
          setTexto(paraBR(novo));
          validar(paraBR(novo), novo || null);
          emitir(novo);
        }}
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
      />
      <button
        type="button"
        aria-label="Abrir calendário"
        onClick={() => {
          const el = calendario.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-marca-900"
      >
        <CalendarDays className="size-4" />
      </button>
      {name && <input type="hidden" name={name} value={iso} />}
    </div>
  );
}
