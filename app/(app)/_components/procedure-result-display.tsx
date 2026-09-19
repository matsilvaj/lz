import { isFreebetProcedure } from "@/lib/procedures";

import { UserRound } from "lucide-react";

type ResultDisplayEntry = {
  escopo: string;
  resultado_chave: string;
  casa: string;
  data_operacao: string;
  parceiro_nome?: string | null;
};

type ResultDisplayProcedure = {
  tipo_procedimento: string;
  data_operacao: string;
  casas_envolvidas: string;
  casa_destino_freebet?: string;
  entradas?: ResultDisplayEntry[];
  resultados?: Array<{ escopo: string; resultado_chave: string }>;
};

type ProcedureMultiple = { count: number; label: string; houses: string[] };

export const MULTIPLE_OPTIONS = [
  { value: "2", label: "Duplo" },
  { value: "3", label: "Triplo" },
  { value: "4", label: "Quádruplo" },
];

const MULTIPLE_SLOT_CLASS = "flex w-[74px] shrink-0 justify-start";

function getEntryHouse(procedure: ResultDisplayProcedure, entry: ResultDisplayEntry) {
  const house = entry.casa.trim();

  // A casa da freebet não é gravada na entrada principal da conversão.
  if (
    !house &&
    entry.escopo === "freebet_conversion" &&
    entry.resultado_chave === "principal"
  ) {
    return procedure.casa_destino_freebet?.trim() ?? "";
  }

  return house;
}

function getResultHouses(procedure: ResultDisplayProcedure, scope?: string) {
  const selected = new Set(
    (procedure.resultados ?? [])
      .filter(
        (result) =>
          result.resultado_chave !== "defeat" &&
          (!scope || result.escopo === scope),
      )
      .map((result) => `${result.escopo}:${result.resultado_chave}`),
  );

  return [
    ...new Set(
      (procedure.entradas ?? [])
        .filter((entry) => selected.has(`${entry.escopo}:${entry.resultado_chave}`))
        .map((entry) => getEntryHouse(procedure, entry))
        .filter(Boolean),
    ),
  ];
}

export function getProcedureMultiples(procedure: ResultDisplayProcedure) {
  const countByScope = new Map<string, number>();

  for (const result of procedure.resultados ?? []) {
    if (result.resultado_chave !== "defeat") {
      countByScope.set(result.escopo, (countByScope.get(result.escopo) ?? 0) + 1);
    }
  }

  const multiples = new Map<string, ProcedureMultiple>();

  for (const [scope, total] of countByScope) {
    if (total < 2) {
      continue;
    }

    const count = Math.min(total, 4);
    multiples.set(scope, {
      count,
      label: MULTIPLE_OPTIONS[count - 2]?.label ?? "Quádruplo",
      houses: getResultHouses(procedure, scope),
    });
  }

  return multiples;
}

export function ProcedureMultipleTag({ multiple }: { multiple?: ProcedureMultiple }) {
  if (!multiple) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center rounded-full border border-[rgba(139,123,255,0.28)] bg-[rgba(139,123,255,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#b9adff]"
      title={
        multiple.houses.length > 0
          ? `Bateu em: ${multiple.houses.join(", ")}`
          : undefined
      }
    >
      {multiple.label}
    </span>
  );
}

export function ProcedureHousesDisplay({
  houses: housesText,
  procedure,
}: {
  houses?: string;
  procedure: ResultDisplayProcedure;
}) {
  const houses = String(housesText ?? procedure.casas_envolvidas ?? "")
    .split(/[,|]/)
    .map((house) => house.trim())
    .filter(Boolean);

  if (houses.length === 0) {
    return <>-</>;
  }

  const winners = new Set(
    getResultHouses(procedure).map((house) => house.toLowerCase()),
  );
  // Parceiros de cada casa (a mesma casa pode ser sua e de um parceiro).
  const partnersByHouse = new Map<string, Set<string>>();

  for (const entry of procedure.entradas ?? []) {
    const partner = entry.parceiro_nome?.trim();
    const house = entry.casa.trim().toLowerCase();

    if (partner && house) {
      partnersByHouse.set(house, (partnersByHouse.get(house) ?? new Set()).add(partner));
    }
  }

  return (
    <>
      {houses.map((house, index) => (
        <span key={`${house}-${index}`}>
          {index > 0 ? <span className="text-[var(--text-dim)]">, </span> : null}
          <span
            className={
              winners.size === 0
                ? undefined
                : winners.has(house.toLowerCase())
                  ? "font-semibold text-white"
                  : "text-[var(--text-dim)]"
            }
          >
            {house}
          </span>
          {[...(partnersByHouse.get(house.toLowerCase()) ?? [])].map((partner) => (
            <span
              className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap align-baseline text-violet-300"
              key={partner}
              title={`Casa do parceiro ${partner}`}
            >
              <UserRound aria-hidden="true" className="h-3 w-3 shrink-0 self-center" />
              <span>{partner}</span>
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

export function ProcedureMultipleSlot({
  procedure,
}: {
  procedure?: ResultDisplayProcedure | null;
}) {
  const multiples = procedure ? [...getProcedureMultiples(procedure).values()] : [];
  const best = multiples.reduce<ProcedureMultiple | undefined>(
    (current, item) => (!current || item.count > current.count ? item : current),
    undefined,
  );
  const multiple = best
    ? { ...best, houses: [...new Set(multiples.flatMap((item) => item.houses))] }
    : undefined;

  return (
    <span className={MULTIPLE_SLOT_CLASS}>
      <ProcedureMultipleTag multiple={multiple} />
    </span>
  );
}

function getProcedureScopeDate(procedure: ResultDisplayProcedure, scope: string) {
  const scopeEntries = (procedure.entradas ?? []).filter(
    (entry) => entry.escopo === scope,
  );
  const entryDate = scopeEntries
    .map((entry) => entry.data_operacao)
    .find((date) => String(date ?? "").trim());

  if (entryDate) {
    return entryDate;
  }

  const hasScopeResult = (procedure.resultados ?? []).some(
    (result) => result.escopo === scope,
  );

  if (scopeEntries.length > 0) {
    return hasScopeResult ? procedure.data_operacao : "";
  }

  if (
    (scope === "freebet_collection" &&
      procedure.tipo_procedimento === "Coletar Freebet") ||
    (scope === "freebet_conversion" &&
      procedure.tipo_procedimento === "Converter Freebet")
  ) {
    return procedure.data_operacao;
  }

  return "";
}

export function ProcedureDateDisplay({
  compact = false,
  procedure,
}: {
  compact?: boolean;
  procedure: ResultDisplayProcedure;
}) {
  const multiples = getProcedureMultiples(procedure);

  if (compact) {
    const tags = [...multiples.values()];
    const best = tags.reduce<ProcedureMultiple | undefined>(
      (current, item) => (!current || item.count > current.count ? item : current),
      undefined,
    );
    const dates = isFreebetProcedure(procedure.tipo_procedimento)
      ? [
          ["Coleta", getProcedureScopeDate(procedure, "freebet_collection")],
          ["Conversão", getProcedureScopeDate(procedure, "freebet_conversion")],
        ].filter(([, value]) => value)
      : [["", procedure.data_operacao]];

    return (
      <div className="flex flex-wrap items-center gap-2">
        {best ? (
          <ProcedureMultipleTag
            multiple={{ ...best, houses: [...new Set(tags.flatMap((item) => item.houses))] }}
          />
        ) : null}
        {dates.map(([label, value]) => (
          <span key={label || "date"}>
            {label ? <span className="text-[var(--text-dim)]">{label} </span> : null}
            {value || "-"}
          </span>
        ))}
      </div>
    );
  }

  if (!isFreebetProcedure(procedure.tipo_procedimento)) {
    return (
      <div className="flex items-center">
        <span className={MULTIPLE_SLOT_CLASS}>
          <ProcedureMultipleTag multiple={multiples.get("sports")} />
        </span>
        <span className="flex-1 text-center">
          {procedure.data_operacao || (
            <span className="text-[var(--text-dim)]">-</span>
          )}
        </span>
      </div>
    );
  }

  const dateItems = [
    {
      label: "Coleta",
      scope: "freebet_collection",
      value: getProcedureScopeDate(procedure, "freebet_collection"),
    },
    {
      label: "Conversão",
      scope: "freebet_conversion",
      value: getProcedureScopeDate(procedure, "freebet_conversion"),
    },
  ].filter((item) => item.value);
  const collection = multiples.get("freebet_collection");
  const conversion = multiples.get("freebet_conversion");
  const sharedMultiple =
    collection && conversion
      ? {
          ...(collection.count >= conversion.count ? collection : conversion),
          houses: [...new Set([...collection.houses, ...conversion.houses])],
        }
      : undefined;

  return (
    <div className="flex items-center">
      {sharedMultiple ? (
        <span className={MULTIPLE_SLOT_CLASS}>
          <ProcedureMultipleTag multiple={sharedMultiple} />
        </span>
      ) : null}

      <div className="flex flex-1 flex-col gap-1.5">
        {dateItems.length === 0 ? (
          <span className="text-center text-[var(--text-dim)]">-</span>
        ) : null}
        {dateItems.map((item) => (
          <div className="flex items-center" key={item.label}>
            {sharedMultiple ? null : (
              <span className={MULTIPLE_SLOT_CLASS}>
                <ProcedureMultipleTag multiple={multiples.get(item.scope)} />
              </span>
            )}
            <span className="flex flex-1 justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                <span className="text-[var(--text-dim)]">{item.label}</span>
                <span>{item.value}</span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
