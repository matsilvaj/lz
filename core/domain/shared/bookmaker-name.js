// Reconhece a casa pelo nome, ignorando maiúsculas, acentos, espaços e pontuação
// ("Aposta Bet" = "Apostabet" = "aposta-bet"). Grafias antigas de casas que foram
// unificadas no catálogo continuam chegando na casa certa.
const BOOKMAKER_KEY_ALIASES = new Map([
  ["7kbet", "bet7k"],
  ["bolsadeapostas", "bolsadeaposta"],
]);

export function getBookmakerKey(value) {
  const key = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return BOOKMAKER_KEY_ALIASES.get(key) ?? key;
}

// Devolve uma função nome → nome do catálogo ("" quando a casa não existe).
export function createBookmakerResolver(catalog) {
  const byKey = new Map();

  for (const name of catalog ?? []) {
    const key = getBookmakerKey(name);

    if (key && !byKey.has(key)) {
      byKey.set(key, name);
    }
  }

  return (value) => byKey.get(getBookmakerKey(value)) ?? "";
}
