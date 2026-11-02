import "server-only";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { db } from "./db";

// Configurações guardadas no banco (tabela Configuracao) e versão do app em execução

export const CONFIG = {
  MANUTENCAO: "eggs.manutencao", // "1" = app EGGS fora do ar pros clientes
  MANUTENCAO_TEXTO: "eggs.manutencaoTexto",
  NOVIDADES: "eggs.novidades", // texto do aviso "tem atualização"
} as const;

export async function lerConfig(chave: string) {
  return (await db.configuracao.findUnique({ where: { chave } }))?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string) {
  await db.configuracao.upsert({ where: { chave }, update: { valor }, create: { chave, valor } });
}

/**
 * Versão = id do build (muda a cada `npm run build`). O app compara a versão que abriu com a do
 * servidor e, se mudou, mostra o aviso de atualização.
 */
export function versaoDoApp() {
  try {
    const arquivo = path.join(process.cwd(), ".next", "BUILD_ID");
    return { id: readFileSync(arquivo, "utf8").trim(), em: statSync(arquivo).mtime };
  } catch {
    return { id: "desenvolvimento", em: null };
  }
}
