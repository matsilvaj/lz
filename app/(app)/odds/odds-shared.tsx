"use client";


import {
  formatCompetitionName,
  formatNationalTeamName,
} from "@/lib/monitor-odds/display-names";

export type OddsFeedItem = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  league_logo_url: string | null;
  league_country_flag_url: string | null;
  bookmaker_slug: string;
  bookmaker_name: string;
  bookmaker_event_url: string | null;
  market_code: string;
  market_name: string;
  selection: string;
  price: number;
  pa_category: string;
  confidence_score: number | null;
  odd_updated_at: string | null;
  commission_percent?: number;
  raw_price?: number;
};

export type OddsEvent = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  league_logo_url: string | null;
  league_country_flag_url: string | null;
  bookmaker_count: number;
  odd_count: number;
  latest_odd_updated_at: string | null;
  odds: OddsFeedItem[];
};

export type BookmakerFilterOption = {
  key: string;
  name: string;
};

const leagueCountryNames: Record<string, string> = {
  albania: "Albânia",
  algeria: "Argélia",
  andorra: "Andorra",
  angola: "Angola",
  argentina: "Argentina",
  armenia: "Armênia",
  aruba: "Aruba",
  australia: "Austrália",
  austria: "Áustria",
  azerbaijan: "Azerbaijão",
  bahrain: "Bahrein",
  belarus: "Belarus",
  belgium: "Bélgica",
  bolivia: "Bolívia",
  "bosnia-herzegovina": "Bósnia e Herzegovina",
  bosnia: "Bósnia e Herzegovina",
  brazil: "Brasil",
  bulgaria: "Bulgária",
  canada: "Canadá",
  chile: "Chile",
  china: "China",
  colombia: "Colômbia",
  "costa-rica": "Costa Rica",
  croatia: "Croácia",
  cyprus: "Chipre",
  "czech-republic": "República Tcheca",
  czechia: "República Tcheca",
  denmark: "Dinamarca",
  ecuador: "Equador",
  egypt: "Egito",
  england: "Inglaterra",
  estonia: "Estônia",
  "faroe-islands": "Ilhas Faroé",
  finland: "Finlândia",
  france: "França",
  georgia: "Geórgia",
  germany: "Alemanha",
  gibraltar: "Gibraltar",
  greece: "Grécia",
  hungary: "Hungria",
  iceland: "Islândia",
  india: "Índia",
  indonesia: "Indonésia",
  iran: "Irã",
  ireland: "Irlanda",
  israel: "Israel",
  italy: "Itália",
  japan: "Japão",
  kazakhstan: "Cazaquistão",
  kosovo: "Kosovo",
  latvia: "Letônia",
  lithuania: "Lituânia",
  luxembourg: "Luxemburgo",
  malaysia: "Malásia",
  malta: "Malta",
  mexico: "México",
  moldova: "Moldávia",
  montenegro: "Montenegro",
  morocco: "Marrocos",
  netherlands: "Holanda",
  "new-zealand": "Nova Zelândia",
  nigeria: "Nigéria",
  "north-macedonia": "Macedônia do Norte",
  "northern-ireland": "Irlanda do Norte",
  norway: "Noruega",
  paraguay: "Paraguai",
  peru: "Peru",
  poland: "Polônia",
  portugal: "Portugal",
  qatar: "Catar",
  romania: "Romênia",
  russia: "Rússia",
  "san-marino": "San Marino",
  "saudi-arabia": "Arábia Saudita",
  scotland: "Escócia",
  serbia: "Sérvia",
  singapore: "Singapura",
  slovakia: "Eslováquia",
  slovenia: "Eslovênia",
  "south-africa": "África do Sul",
  "south-korea": "Coreia do Sul",
  spain: "Espanha",
  sweden: "Suécia",
  switzerland: "Suíça",
  thailand: "Tailândia",
  tunisia: "Tunísia",
  turkey: "Turquia",
  ukraine: "Ucrânia",
  uruguay: "Uruguai",
  usa: "Estados Unidos",
  "united-states": "Estados Unidos",
  venezuela: "Venezuela",
  vietnam: "Vietnã",
  wales: "País de Gales",
  world: "Mundo",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
});

export function formatDate(value: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return dateFormatter.format(date);
}

export function formatTime(value: string | null) {
  if (!value) return "Sem horário";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem horário";

  return timeFormatter.format(date);
}

export function normalizeLabelKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatLeagueCountry(value: string | null) {
  if (!value) return "";
  return leagueCountryNames[normalizeLabelKey(value)] ?? value;
}

export function formatLeagueName(value: string, country?: string | null) {
  const normalizedCountry = normalizeLabelKey(country ?? "");
  let formatted = formatCompetitionName(value, country).replace(
    /\bbrasileirao\b/gi,
    "Brasileirão",
  );
  const isBrazilianLeague =
    normalizedCountry === "brazil" || normalizeLabelKey(formatted).includes("brasileirao");

  if (isBrazilianLeague) {
    formatted = formatted.replace(/\bserie\b/gi, "Série");
  }

  return formatted;
}

export function formatLeagueLine(event: OddsEvent) {
  const country = formatLeagueCountry(event.league_country);
  const leagueName = formatLeagueName(event.league_name, event.league_country);
  return country ? `${leagueName} - ${country}` : leagueName;
}

export function formatFixtureTeams(event: Pick<OddsEvent, "away_team" | "home_team">) {
  const homeTeam = formatNationalTeamName(event.home_team);
  const awayTeam = formatNationalTeamName(event.away_team);

  return {
    awayTeam,
    homeTeam,
    label: `${homeTeam} x ${awayTeam}`,
  };
}

export function BookmakerToggleButton({
  active,
  name,
  onClick,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.18)] text-white"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block truncate">{name}</span>
    </button>
  );
}
