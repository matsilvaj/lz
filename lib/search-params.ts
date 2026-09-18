// Primeiro valor de um parâmetro de busca da página.
export function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
