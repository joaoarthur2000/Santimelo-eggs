/** Aparece na hora do clique enquanto a próxima tela carrega: o painel nunca "trava" */
export default function Carregando() {
  return (
    <div className="carregando-atrasado mx-auto w-full max-w-[1440px]" aria-busy="true" aria-label="Carregando">
      <div className="mb-7 space-y-2.5">
        <div className="esqueleto h-7 w-56" />
        <div className="esqueleto h-4 w-80 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto h-[104px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="esqueleto h-[420px] rounded-2xl" />
        <div className="esqueleto h-[260px] rounded-2xl" />
      </div>
    </div>
  );
}
