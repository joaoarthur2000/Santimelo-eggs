import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { INICIO_DO_PAPEL, PAPEIS, type Papel } from "./constantes";

const COOKIE = "eggs_sessao"; // nome próprio: o sistema da Suprema roda no mesmo PC (cookie não separa porta)
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function segredo() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definido no .env");
  return s;
}

function assinar(valor: string) {
  return createHmac("sha256", segredo()).update(valor).digest("hex");
}

export async function criarSessao(usuarioId: string) {
  const expira = Date.now() + DURACAO_MS;
  const valor = `${usuarioId}.${expira}`;
  // Cookie "secure" só em https: rodando no PC (http://192.168...) o iPhone recusaria e o login não ficaria salvo
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, `${valor}.${assinar(valor)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    expires: new Date(expira),
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function usuarioAtual() {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  const [id, expira, assinatura] = bruto.split(".");
  if (!id || !expira || !assinatura) return null;

  const esperado = Buffer.from(assinar(`${id}.${expira}`));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  if (Number(expira) < Date.now()) return null;

  const usuario = await db.usuario.findUnique({
    where: { id },
    select: { id: true, nome: true, papel: true, ativo: true, clienteId: true },
  });
  return usuario?.ativo ? { ...usuario, papel: usuario.papel as Papel } : null;
}

/** Usar no topo de páginas e server actions. Equipe acessa o painel; cliente só o app. */
export async function exigirPapel(papel: Papel) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect(papel === PAPEIS.CLIENTE ? "/eggs/entrar" : "/login");
  const diretorPode = usuario.papel === PAPEIS.DIRETOR && papel !== PAPEIS.CLIENTE;
  if (usuario.papel !== papel && !diretorPode) redirect(INICIO_DO_PAPEL[usuario.papel] ?? "/login");
  return usuario;
}

/** App EGGS: login de cliente ativo, com o cadastro do cliente */
export async function exigirCliente() {
  const usuario = await exigirPapel(PAPEIS.CLIENTE);
  const cliente = usuario.clienteId ? await db.cliente.findUnique({ where: { id: usuario.clienteId }, include: { regiao: true } }) : null;
  if (!cliente || !cliente.ativo) {
    await encerrarSessao();
    redirect("/eggs/entrar?erro=acesso");
  }
  // Último acesso (pro painel ver quem está usando), no máximo a cada 5 minutos
  const registro = await db.usuario.findUnique({ where: { id: usuario.id }, select: { ultimoAcesso: true } });
  if (!registro?.ultimoAcesso || Date.now() - registro.ultimoAcesso.getTime() > 5 * 60 * 1000) {
    await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date() } });
  }
  return { usuario, cliente };
}
