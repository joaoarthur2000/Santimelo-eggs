"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { INICIO_DO_PAPEL, type Papel } from "@/lib/constantes";
import { conferirSenha } from "@/lib/senha";
import { criarSessao, encerrarSessao } from "@/lib/sessao";

const TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/**
 * Entra com e-mail ou código de acesso (cliente do app, ex: EGG-7K3P; equipe também pode ter, ex: ADM123).
 * Pela tela do app, quem tem cliente vinculado vai pro app; senão o papel decide. 5 senhas erradas bloqueiam 15 min
 */
export async function entrar(_estado: { erro?: string }, form: FormData): Promise<{ erro?: string }> {
  const login = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const porCodigo = !login.includes("@");
  const erroPadrao = porCodigo ? "Código ou senha incorretos." : "E-mail ou senha incorretos.";

  const usuario = await db.usuario.findUnique({ where: porCodigo ? { codigoAcesso: login.toUpperCase() } : { email: login.toLowerCase() } });
  if (!usuario || !usuario.ativo) return { erro: erroPadrao };
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    return { erro: "Muitas tentativas erradas. Espere 15 minutos ou peça uma senha nova pra Santimelo." };
  }
  if (!conferirSenha(senha, usuario.senhaHash)) {
    const falhas = usuario.falhas + 1;
    await db.usuario.update({
      where: { id: usuario.id },
      data: falhas >= TENTATIVAS ? { falhas: 0, bloqueadoAte: new Date(Date.now() + BLOQUEIO_MS) } : { falhas },
    });
    return { erro: falhas >= TENTATIVAS ? "Muitas tentativas erradas. Acesso bloqueado por 15 minutos." : erroPadrao };
  }
  if (usuario.falhas || usuario.bloqueadoAte) await db.usuario.update({ where: { id: usuario.id }, data: { falhas: 0, bloqueadoAte: null } });

  await criarSessao(usuario.id);
  if (form.get("tema") === "eggs" && usuario.clienteId) redirect("/eggs");
  redirect(INICIO_DO_PAPEL[usuario.papel as Papel] ?? "/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

/** Sair do app EGGS volta pra tela de entrada do app */
export async function sairEggs() {
  await encerrarSessao();
  redirect("/eggs/entrar");
}
