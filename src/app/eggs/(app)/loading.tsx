import { IconeEggs } from "../marca-eggs";

// Aparece na hora do toque enquanto a próxima tela carrega (sensação de app rápido)
export default function Carregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-label="Carregando">
      <IconeEggs className="eggs-balanca size-14" />
    </div>
  );
}
