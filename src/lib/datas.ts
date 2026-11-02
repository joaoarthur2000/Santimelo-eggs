// Tudo em horário de Porto Alegre (UTC-3, sem horário de verão desde 2019).
const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";

// Criar Intl.DateTimeFormat é caro: os formatadores são criados uma vez só
const FORMATO_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
const FORMATO_CURTO = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO });

/** "2026-10-30" do dia (em Porto Alegre) da data informada */
export function diaISO(data: Date = new Date()): string {
  return FORMATO_ISO.format(data);
}

export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00${OFFSET}`);
}

export function fimDoDia(dia: string): Date {
  return new Date(inicioDoDia(dia).getTime() + 24 * 60 * 60 * 1000);
}

export function somarDias(dia: string, dias: number): string {
  return diaISO(new Date(inicioDoDia(dia).getTime() + dias * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));
}

/** Aceita só "AAAA-MM-DD"; qualquer outra coisa vira hoje */
export function diaValido(valor: string | string[] | undefined): string {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : diaISO();
}

export function formatarDia(dia: string, opcoes: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: FUSO }).format(new Date(`${dia}T12:00:00${OFFSET}`));
}

export function formatarHora(data: Date) {
  return FORMATO_HORA.format(data);
}

export function formatarDataCurta(data: Date) {
  return FORMATO_CURTO.format(data);
}

/** Dia da semana de "AAAA-MM-DD" (0 = domingo) */
export function diaDaSemana(dia: string) {
  return new Date(`${dia}T12:00:00${OFFSET}`).getUTCDay();
}
