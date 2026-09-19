// Tipo de procedimento digitado pelo usuário ("Outro"): mesma regra na tela e no servidor.
// Aceita letras (com acento), números, espaço e pontuação simples; o resto é descartado.
export const PROCEDURE_TYPE_MAX_LENGTH = 60;

const DISALLOWED_CHARACTERS = /[^\p{L}\p{N} .,'()&+/-]/gu;

export function sanitizeProcedureTypeInput(value) {
  return String(value ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(DISALLOWED_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .replace(/^ /, "")
    .slice(0, PROCEDURE_TYPE_MAX_LENGTH);
}

export function normalizeProcedureType(value) {
  return sanitizeProcedureTypeInput(value).trim();
}
