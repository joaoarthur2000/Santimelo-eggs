// Login do cliente no app = nome do estabelecimento, sem acento, espaço nem palavra genérica.
// "Padaria Pão Quente" → PAOQUENTE · "Confeitaria Doce Gema" → DOCEGEMA. Se já existir: PAOQUENTE2, PAOQUENTE3…
// Arquivo sem dependência de servidor: o cadastro mostra a prévia do login enquanto digita.

const GENERICAS = new Set([
  "PADARIA", "CONFEITARIA", "RESTAURANTE", "LANCHERIA", "LANCHONETE", "LANCHES", "LANCHE", "BAR", "CAFE", "CAFETERIA",
  "DOCERIA", "PIZZARIA", "HAMBURGUERIA", "PANIFICADORA", "E", "DA", "DE", "DO", "DAS", "DOS", "LTDA", "ME", "EIRELI", "POA",
  "O", "A", "OS", "AS", "THE",
]);

export const TAMANHO_LOGIN = 12;

export function baseDoLogin(nome: string) {
  const palavras = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  const uteis = palavras.filter((p) => !GENERICAS.has(p));
  return (uteis.length ? uteis : palavras).join("").slice(0, TAMANHO_LOGIN);
}

/** n-ésima opção de login pra mesma base: PAOQUENTE, PAOQUENTE2, PAOQUENTE3… (sempre até 12 letras) */
export function opcaoDeLogin(base: string, n: number) {
  if (n <= 1) return base;
  const sufixo = String(n);
  return `${base.slice(0, TAMANHO_LOGIN - sufixo.length)}${sufixo}`;
}
