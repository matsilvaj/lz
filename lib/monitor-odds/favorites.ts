function normalizeKeyPart(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mesma chave em Odds, Duplo e Converter, para o favorito valer em todas as telas.
export function getFavoriteLeagueKey(event: {
  league_country?: string | null;
  league_name?: string | null;
}) {
  return `${normalizeKeyPart(event.league_name) || "campeonato"}::${normalizeKeyPart(
    event.league_country,
  )}`;
}

export type FavoriteGroup = "game" | "league" | "other";

export function getFavoriteGroup(
  event: { fixture_id: string; league_country?: string | null; league_name?: string | null },
  favoriteGames: ReadonlySet<string>,
  favoriteLeagues: ReadonlySet<string>,
): FavoriteGroup {
  if (favoriteGames.has(event.fixture_id)) {
    return "game";
  }

  return favoriteLeagues.has(getFavoriteLeagueKey(event)) ? "league" : "other";
}

const favoriteGroupOrder: Record<FavoriteGroup, number> = { game: 0, league: 1, other: 2 };

// Jogos favoritos primeiro, depois campeonatos fixados; a ordem escolhida vale dentro de cada grupo.
export function sortByFavorites<T>(
  items: T[],
  getEvent: (item: T) => {
    fixture_id: string;
    league_country?: string | null;
    league_name?: string | null;
  },
  favoriteGames: ReadonlySet<string>,
  favoriteLeagues: ReadonlySet<string>,
) {
  if (!favoriteGames.size && !favoriteLeagues.size) {
    return items;
  }

  return items
    .map((item, index) => ({
      group: getFavoriteGroup(getEvent(item), favoriteGames, favoriteLeagues),
      index,
      item,
    }))
    .sort(
      (left, right) =>
        favoriteGroupOrder[left.group] - favoriteGroupOrder[right.group] ||
        left.index - right.index,
    )
    .map((entry) => entry.item);
}

// Mais acessados primeiro, na ordem do ranking; os demais mantêm a ordem atual.
export function sortByTrending<T>(
  items: T[],
  getFixtureId: (item: T) => string,
  trendingRank: ReadonlyMap<string, number>,
) {
  if (!trendingRank.size) {
    return items;
  }

  const fallbackRank = trendingRank.size;
  return items
    .map((item, index) => ({
      index,
      item,
      rank: trendingRank.get(getFixtureId(item)) ?? fallbackRank,
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.item);
}
