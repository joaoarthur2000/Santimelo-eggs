import { IconeEggs } from "@/app/eggs/marca-eggs";

/** Marca do painel da equipe: EGGS by Santimelo */
export function Marca({ claro = false, tamanho = "md" }: { claro?: boolean; tamanho?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <IconeEggs className={tamanho === "lg" ? "size-14" : "size-10"} />
      <div className="flex flex-col leading-none">
        <span className={`font-eggs font-extrabold tracking-tight ${tamanho === "lg" ? "text-4xl" : "text-2xl"} ${claro ? "text-white" : "text-casca-900"}`}>EGGS</span>
        <span className={`mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${claro ? "text-gema-400" : "text-gema-700"}`}>by Santimelo</span>
      </div>
    </div>
  );
}
