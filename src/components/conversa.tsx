"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";

export type MensagemConversa = { id: number; de: string; autor: string; texto: string; hora: string; lida: boolean };

function Enviar({ escuro }: { escuro: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-label="Enviar" className={`flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${escuro ? "bg-casca-900 text-gema-50" : "bg-marca-800 text-white"}`}>
      <Send className="size-4" />
    </button>
  );
}

/**
 * Conversa de atendimento (painel e app). `eu` = quem está olhando ("EQUIPE" no painel, "CLIENTE" no app):
 * as falas de quem olha ficam à direita.
 */
export function Conversa({
  mensagens,
  eu,
  enviar,
  tema = "painel",
  placeholder = "Escreva uma mensagem",
}: {
  mensagens: MensagemConversa[];
  eu: "EQUIPE" | "CLIENTE";
  enviar: (form: FormData) => Promise<void>;
  tema?: "painel" | "eggs";
  placeholder?: string;
}) {
  const fim = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const eggs = tema === "eggs";

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  return (
    <div className="flex flex-col gap-3">
      <ol className="space-y-2" aria-live="polite">
        {mensagens.map((m) => {
          const minha = m.de === eu;
          return (
            <li key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
                  minha
                    ? `rounded-br-md ${eggs ? "bg-casca-900 text-gema-50" : "bg-marca-800 text-white"}`
                    : `rounded-bl-md ${eggs ? "bg-white ring-1 ring-casca-100" : "bg-white ring-1 ring-stone-200"}`
                }`}
              >
                {!minha && <p className={`mb-0.5 text-xs font-bold ${eggs ? "text-gema-700" : "text-marca-700"}`}>{m.autor}</p>}
                <p className="whitespace-pre-line">{m.texto}</p>
                <p className={`mt-1 text-right text-[10px] ${minha ? "opacity-70" : "text-stone-400"}`}>
                  {m.hora}
                  {minha && (m.lida ? " · lida" : " · enviada")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={fim} />
      <form
        ref={form}
        action={async (dados) => {
          await enviar(dados);
          form.current?.reset();
        }}
        className={`sticky bottom-0 flex items-end gap-2 rounded-3xl p-2 ${eggs ? "bg-white shadow-[0_-4px_20px_rgba(61,38,20,0.08)] ring-1 ring-casca-100" : "bg-white ring-1 ring-stone-200"}`}
      >
        <textarea
          name="texto"
          required
          rows={1}
          maxLength={1000}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className={`max-h-32 min-h-11 flex-1 resize-none rounded-2xl border-0 px-3 py-2.5 text-[15px] focus:ring-2 ${eggs ? "bg-gema-50 focus:ring-gema-400" : "bg-stone-50 focus:ring-marca-400"}`}
        />
        <Enviar escuro={eggs} />
      </form>
    </div>
  );
}
