import type { z } from "zod";

/** Erros do zod no formato dos formulários: o primeiro em texto e a mensagem de cada campo (ver components/formulario.ts) */
export function errosDoForm(error: z.ZodError): { erro: string; campos: Record<string, string> } {
  const campos: Record<string, string> = {};
  for (const i of error.issues) {
    const nome = String(i.path[0] ?? "");
    if (nome && !campos[nome]) campos[nome] = i.message;
  }
  const n = Object.keys(campos).length;
  return { erro: n > 1 ? `Confira ${n} campos marcados.` : (error.issues[0]?.message ?? "Confira os campos."), campos };
}
