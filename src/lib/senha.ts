import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato salvo: "salt:hash" (hex), scrypt do Node — sem dependência externa
export function gerarHash(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
}

export function conferirSenha(senha: string, salvo: string): boolean {
  const [salt, hash] = salvo.split(":");
  if (!salt || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const recebido = scryptSync(senha, salt, esperado.length);
  return timingSafeEqual(esperado, recebido);
}
