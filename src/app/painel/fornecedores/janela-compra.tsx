"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { FormCompra, type CompraAtual } from "./compra";

type Opcao = { id: string; nome: string };

/** Botão que abre a compra numa janela: lançar num dia qualquer ou editar uma já lançada */
export function JanelaCompra({
  children,
  className = "botao-secundario",
  titulo,
  compra,
  dia,
  hoje,
  fornecedores,
  itens,
  marcas,
}: {
  children: React.ReactNode;
  className?: string;
  titulo: string;
  compra?: CompraAtual;
  dia: string;
  hoje: string;
  fornecedores: Opcao[];
  itens: Opcao[];
  marcas: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [vez, setVez] = useState(0); // formulário novo a cada abertura
  const fechar = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setVez((v) => v + 1);
          ref.current?.showModal();
        }}
      >
        {children}
      </button>
      <dialog
        ref={ref}
        className="dialogo text-left font-normal whitespace-normal"
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-marca-950">{titulo}</h2>
            <button type="button" onClick={fechar} aria-label="Fechar" className="toque grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <X className="size-4" />
            </button>
          </div>
          {vez > 0 && <FormCompra key={vez} fornecedores={fornecedores} itens={itens} marcas={marcas} hoje={hoje} dia={dia} compra={compra} aoSalvar={fechar} />}
        </div>
      </dialog>
    </>
  );
}
