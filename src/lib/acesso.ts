import "server-only";
import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import { db } from "./db";
import { baseDoLogin, opcaoDeLogin } from "./login";
import { linkDoApp } from "./rede";
import { conferirSenhaAsync, gerarHash } from "./senha";

// Acesso do cliente ao app EGGS: login com o nome do estabelecimento + senha de ovo fácil de ditar.
// Nenhum login e nenhuma senha se repetem entre clientes.

const PALAVRAS = ["gema", "clara", "ninho", "casca", "galo", "granja", "omelete", "fritada", "quindim", "pudim", "suspiro", "gemada", "poche", "mexido", "pintinho", "galinha"];

/** Login livre a partir do nome: PAOQUENTE, ou PAOQUENTE2 se já existir */
export async function loginUnico(nome: string) {
  const base = baseDoLogin(nome) || "CLIENTE";
  for (let n = 1; ; n++) {
    const login = opcaoDeLogin(base, n);
    if (!(await db.usuario.findUnique({ where: { codigoAcesso: login } }))) return login;
  }
}

/** Senha no padrão palavra + 4 números (ex: gema4821), diferente da de todos os outros clientes */
export async function senhaUnica(ignorarUsuarioId?: string) {
  const outros = await db.usuario.findMany({ where: { papel: "CLIENTE", id: { not: ignorarUsuarioId } }, select: { senhaHash: true } });
  for (;;) {
    const senha = `${PALAVRAS[randomInt(PALAVRAS.length)]}${randomInt(1000, 10000)}`;
    const usada = await Promise.all(outros.map((u) => conferirSenhaAsync(senha, u.senhaHash)));
    if (!usada.some(Boolean)) return senha;
  }
}

/** Cria o login do cliente no app. A senha volta uma vez só, pra passar pro cliente */
export async function criarAcesso(clienteId: string) {
  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  const [login, senha] = [await loginUnico(cliente.nomeFantasia), await senhaUnica()];
  await db.usuario.create({
    data: {
      nome: cliente.responsavel ?? cliente.nomeFantasia,
      email: `${login.toLowerCase()}@eggs.app`,
      codigoAcesso: login,
      senhaHash: gerarHash(senha),
      papel: "CLIENTE",
      clienteId,
    },
  });
  return { login, senha };
}

/** Link do app com o login do cliente já preenchido (o QR que ele escaneia na visita) */
export const linkDeAcesso = (login: string) => `${linkDoApp()}/entrar?login=${encodeURIComponent(login)}`;

export function qrDeAcesso(login: string) {
  return QRCode.toString(linkDeAcesso(login), { type: "svg", margin: 1, color: { dark: "#402924", light: "#ffffff" } });
}
