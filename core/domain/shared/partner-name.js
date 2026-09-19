// Nome de parceiro: mesma regra na tela e no servidor.
// Letras (com acento), números, espaço e pontuação simples; até 60 caracteres.
export const PARTNER_NAME_MAX_LENGTH = 60;

const DISALLOWED_CHARACTERS = /[^\p{L}\p{N} .,'&()-]/gu;

export function sanitizePartnerNameInput(value) {
  return String(value ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(DISALLOWED_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .replace(/^ /, "")
    .slice(0, PARTNER_NAME_MAX_LENGTH);
}

export function normalizePartnerName(value) {
  return sanitizePartnerNameInput(value).trim();
}
