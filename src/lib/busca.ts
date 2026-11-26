/** Texto pesquisável de uma linha (vai em data-busca): sem acento, minúsculo, só letras e números */
export const textoDeBusca = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
