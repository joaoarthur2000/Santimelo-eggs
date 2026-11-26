type Cliente = { endereco: string | null; bairro: string | null; whatsapp: string | null; tipoNegocio: string };

/** O que falta no cadastro pra entregar, cobrar e entrar na rota */
export function faltaNoCadastro(c: Cliente) {
  return [!c.endereco && "endereço", !c.bairro && "bairro", !c.whatsapp && "WhatsApp", c.tipoNegocio === "A definir" && "tipo"].filter((x): x is string => !!x);
}
export const cadastroIncompleto = (c: Cliente) => faltaNoCadastro(c).length > 0;

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Região de entrega pelo bairro (lista de bairros de cada região, em Regiões e horários) */
export const regiaoDoBairro = (regioes: { id: string; bairros: string | null }[], bairro: string | null) =>
  bairro ? (regioes.find((r) => (r.bairros ?? "").split(",").some((b) => semAcento(b) && semAcento(b) === semAcento(bairro)))?.id ?? null) : null;

/** Nome que parece estabelecimento (e não pessoa): só esses já vêm marcados pra buscar fora */
export const pareceEstabelecimento = (nome: string) =>
  /\b(restaurante|padaria|panificadora|confeitaria|doceria|lancheria|lanchonete|lanches|cafe|cafeteria|bistro|pizzaria|sushi|bakery|burger|hamburgueria|churrascaria|salgados|caseirinhos|mercado|mercadinho|emporio|hotel|hospital|bar|grill|cozinha|buffet|bolos|doces)\b/.test(semAcento(nome));

const digitos = (v: string) => v.replace(/\D/g, "").length;

/** O que parece errado. Não impede salvar: fica gravado do jeito que foi digitado, com o aviso no campo */
export function avisosDoCadastro(d: { whatsapp?: string | null; cep?: string | null; cnpj?: string | null; email?: string | null }) {
  const avisos: Record<string, string> = {};
  if (d.whatsapp && (digitos(d.whatsapp) < 10 || digitos(d.whatsapp) > 13)) avisos.whatsapp = "Salvei, mas o número parece incompleto";
  if (d.cep && digitos(d.cep) !== 8) avisos.cep = "Salvei, mas o CEP tem 8 números";
  if (d.cnpj && ![11, 14].includes(digitos(d.cnpj))) avisos.cnpj = "Salvei, mas parece incompleto";
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) avisos.email = "Salvei, mas o e-mail parece incompleto";
  return avisos;
}
