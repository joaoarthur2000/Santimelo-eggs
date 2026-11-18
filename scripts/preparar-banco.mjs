// Roda antes do `npm run dev` e do `npm run local`: cria o .env se faltar, aplica migrações
// e carrega dados de exemplo se o banco estiver vazio
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

function rodar(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(".env")) {
  writeFileSync(".env", `DATABASE_URL="file:./dev.db"\nSESSION_SECRET="${randomBytes(32).toString("hex")}"\n`);
  console.log("Criei o .env com uma chave de sessão nova.");
}

rodar("npx", ["prisma", "migrate", "deploy"]);
rodar("npx", ["prisma", "generate"]); // campo novo no schema já vale ao subir o servidor
rodar("npx", ["tsx", "prisma/seed.ts"]);
