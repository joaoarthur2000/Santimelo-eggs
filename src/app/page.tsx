import { redirect } from "next/navigation";
import { INICIO_DO_PAPEL } from "@/lib/constantes";
import { usuarioAtual } from "@/lib/sessao";

// Por enquanto a raiz só encaminha. Quando o site institucional entrar, ele assume esta rota.
export default async function Inicio() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  redirect(INICIO_DO_PAPEL[usuario.papel] ?? "/login");
}
