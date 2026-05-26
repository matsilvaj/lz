"use client";

import { calculateSurebet, FREEBET_CONDITIONS, PROCEDURE_TYPES } from "@/core";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { useToast } from "@/app/_components/toast-provider";

import { copyTextToClipboard } from "./clipboard";
import { DatePickerField } from "./date-picker-field";
import { LzSelect } from "./lz-select";
import {
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  formatCurrency,
} from "./ui";
import { buildProcedureShareUrl } from "./procedure-share";
import { type ProcedureShareValues } from "./procedure-share-types";
import { saveProcedureAction, updateProcedureAction } from "../procedure-actions";

type ProcedureType = string;
type ProcedureGroup = "sports" | "casino" | "expenses";
type SportResultSelection = "principal" | "defeat" | `protection-${number}`;
type BetSide = "back" | "lay";
type ProtectionDraft = {
  stake: string;
  odd: string;
  side: BetSide;
  layOdd: string;
  commission: string;
};
type ProcedureStatus = "Pendente" | "Concluído";
type HousePickerTarget = {
  section: "main" | "collection";
  index: number;
};

type ProcedureModalProps = {
  mode?: "create" | "edit";
  procedureId?: number;
  triggerLabel?: string;
  triggerClassName?: string;
  title?: string;
  submitLabel?: string;
  returnTo: string;
  typeOptions?: readonly ProcedureType[];
  bookmakers?: string[];
  onTrigger?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  defaultValues?: ProcedureShareValues & {
    procedureType?: ProcedureType;
    operationDate?: string;
    game?: string;
    houses?: string;
    entryValue?: number;
    equalProfit?: boolean;
    protections?: number[];
    note?: string;
    hitDouble?: boolean;
    doubleValue?: number;
    freebetHouse?: string;
    freebetValue?: number;
    freebetCondition?: string;
    procedureStatus?: ProcedureStatus;
    originIds?: number[];
  };
};

type HousePickerDialogProps = {
  open: boolean;
  title: string;
  options: string[];
  multiple?: boolean;
  selectedValues: string[];
  onClose: () => void;
  onToggle: (value: string) => void;
  onClear: () => void;
};

const FREEBET_COLLECTION_TYPE = "Coletar Freebet";
const FREEBET_CONVERSION_TYPE = "Converter Freebet";
const FREEBET_TYPES = [FREEBET_COLLECTION_TYPE, FREEBET_CONVERSION_TYPE];

const PROCEDURE_GROUPS: Array<{
  id: ProcedureGroup;
  label: string;
}> = [
  { id: "sports", label: "Esportes" },
  { id: "casino", label: "Cassino" },
  { id: "expenses", label: "Gastos" },
];

const SPORTS_PROCEDURE_OPTIONS = [
  { value: "SureBet", label: "SureBet" },
  { value: "Tentativa de Duplo", label: "Tentativa de DG" },
  { value: "Super Odd's", label: "Super Odd's" },
  { value: "Aumentadas", label: "Aumentadas" },
  { value: "Apostas Normais", label: "Apostas Normais" },
  { value: FREEBET_COLLECTION_TYPE, label: "Freebet" },
];

const CASINO_PROCEDURE_OPTIONS = [
  { value: "Giros Grátis", label: "Giros Grátis" },
  { value: "Missões", label: "Missões" },
  { value: "Métodos", label: "Métodos" },
];

const EXPENSE_PROCEDURE_OPTIONS = [{ value: "Gastos", label: "Gastos" }];

const PROCEDURE_STATUS_OPTIONS: ProcedureStatus[] = ["Pendente", "Concluído"];
const MAX_SPORT_PROTECTIONS = 11;
const DEFAULT_BET_SIDE: BetSide = "back";

function createProtectionDraft(
  draft: Partial<ProtectionDraft> = {},
): ProtectionDraft {
  return {
    stake: draft.stake ?? "",
    odd: draft.odd ?? "",
    side: draft.side ?? DEFAULT_BET_SIDE,
    layOdd: draft.layOdd ?? "",
    commission: draft.commission ?? "",
  };
}

function toProcedureOptions(typeOptions: readonly ProcedureType[]) {
  return typeOptions.reduce<Array<{ value: ProcedureType; label: string }>>(
    (options, type) => {
      if (isFreebetProcedureType(type)) {
        if (!options.some((option) => isFreebetProcedureType(option.value))) {
          options.push({ value: type, label: "Freebet" });
        }

        return options;
      }

      options.push({ value: type, label: type });
      return options;
    },
    [],
  );
}

function getDefaultProcedureOptions(
  group: ProcedureGroup,
  typeOptions: readonly ProcedureType[],
) {
  if (typeOptions !== PROCEDURE_TYPES) {
    return toProcedureOptions(typeOptions);
  }

  if (group === "casino") {
    return CASINO_PROCEDURE_OPTIONS;
  }

  if (group === "expenses") {
    return EXPENSE_PROCEDURE_OPTIONS;
  }

  return SPORTS_PROCEDURE_OPTIONS;
}

function getProcedureGroupFromType(type: string | undefined): ProcedureGroup {
  if (!type) {
    return "sports";
  }

  if (
    type === "Cassino" ||
    CASINO_PROCEDURE_OPTIONS.some((option) => option.value === type)
  ) {
    return "casino";
  }

  if (isFreebetProcedureType(type)) {
    return "sports";
  }

  if (EXPENSE_PROCEDURE_OPTIONS.some((option) => option.value === type)) {
    return "expenses";
  }

  return "sports";
}

function isFreebetProcedureType(type: string | undefined) {
  return FREEBET_TYPES.includes(String(type ?? ""));
}

function parseDecimalInput(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrencyAmount(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return 0;
  }

  return value;
}

function getResultLabel(value: number, total = false) {
  const normalizedValue = normalizeCurrencyAmount(value);
  const suffix = total ? " total" : "";

  if (normalizedValue < 0) {
    return `Perda${suffix}`;
  }

  if (normalizedValue > 0) {
    return `Lucro${suffix}`;
  }

  return "Resultado";
}

function getScopedResultLabel(value: number, scope: string) {
  const label = getResultLabel(value);
  return label === "Resultado" ? `Resultado da ${scope}` : `${label} da ${scope}`;
}

function getResultAmountClass(value: number) {
  const normalizedValue = normalizeCurrencyAmount(value);

  if (normalizedValue < 0) {
    return "text-[var(--negative)]";
  }

  if (normalizedValue > 0) {
    return "text-[var(--positive)]";
  }

  return "text-white";
}

function formatProcedureCurrency(value: number) {
  return formatCurrency(normalizeCurrencyAmount(value));
}

function getProtectionResultId(key: number): SportResultSelection {
  return `protection-${key}`;
}

function calculateSportsProfit(
  entries: Array<{
    resultId: SportResultSelection;
    stakeInput: string;
    oddInput: string;
    side: BetSide;
    layOddInput?: string;
    commissionInput?: string;
  }>,
  selectedResults: SportResultSelection[],
) {
  const normalizedEntries = entries.map((entry) => {
    const side = entry.side === "lay" ? "lay" : "back";
    const riskValue = parseDecimalInput(entry.stakeInput);
    const layOddInput = entry.layOddInput ?? "";
    const odd =
      side === "lay"
        ? parseDecimalInput(layOddInput.trim() ? layOddInput : entry.oddInput)
        : parseDecimalInput(entry.oddInput);
    const stake = side === "lay" && odd > 1 ? riskValue / (odd - 1) : riskValue;

    return {
      ...entry,
      side,
      stake,
      responsibility: side === "lay" ? riskValue : 0,
      odd,
      commission: parseDecimalInput(entry.commissionInput ?? ""),
    };
  });
  const baseIndex = normalizedEntries.findIndex((entry) => entry.stake > 0);
  const fallbackInvestment = normalizedEntries.reduce(
    (sum, entry) =>
      sum + (entry.side === "lay" ? entry.responsibility : entry.stake),
    0,
  );

  let investment = fallbackInvestment;
  let returnsByIndex = new Map<number, number>();

  if (baseIndex >= 0) {
    try {
      const calculation = calculateSurebet(
        normalizedEntries.map((entry) => ({
          odd: entry.odd,
          stake: entry.stake,
          tipo: entry.side === "lay" ? "L" : "B",
          responsabilidade: entry.responsibility,
          comissao_percentual: entry.commission,
        })),
        baseIndex,
      );

      investment = Number(calculation?.investimento_efetivo ?? fallbackInvestment);
      returnsByIndex = new Map(
        normalizedEntries.map((_, index) => [
          index,
          Number(calculation?.linhas?.[index]?.retorno_bruto ?? 0),
        ]),
      );
    } catch {
      returnsByIndex = new Map(
        normalizedEntries.map((entry, index) => {
          const layReturn =
            entry.odd > 1
              ? entry.responsibility +
                (entry.responsibility / (entry.odd - 1)) *
                  (1 - entry.commission / 100)
              : 0;

          return [
            index,
            entry.side === "lay" ? layReturn : entry.stake * entry.odd,
          ];
        }),
      );
    }
  } else {
    returnsByIndex = new Map(
      normalizedEntries.map((entry, index) => {
        const layReturn =
          entry.odd > 1
            ? entry.responsibility +
              (entry.responsibility / (entry.odd - 1)) *
                (1 - entry.commission / 100)
            : 0;

        return [
          index,
          entry.side === "lay" ? layReturn : entry.stake * entry.odd,
        ];
      }),
    );
  }

  if (selectedResults.includes("defeat")) {
    return -investment;
  }

  if (selectedResults.length === 0) {
    return 0;
  }

  const selectedResultSet = new Set(selectedResults);
  const totalReturn = normalizedEntries.reduce((sum, entry, index) => {
    const entryReturn = returnsByIndex.get(index) ?? 0;

    if (entry.side === "lay") {
      return selectedResultSet.has(entry.resultId) ? sum : sum + entryReturn;
    }

    if (!selectedResultSet.has(entry.resultId)) {
      return sum;
    }

    return sum + entryReturn;
  }, 0);

  return normalizeCurrencyAmount(totalReturn - investment);
}

function getSportCardClass(selected: boolean) {
  return `rounded-[24px] border p-4 transition ${
    selected
      ? "border-[rgba(216,31,89,0.72)] bg-[rgba(216,31,89,0.12)] shadow-[0_0_0_1px_rgba(216,31,89,0.22),0_18px_48px_rgba(216,31,89,0.12)]"
      : "border-white/10 bg-[rgba(255,255,255,0.035)]"
  }`;
}

function DisclosureIcon({ open }: { open: boolean }) {
  return (
    <span className="inline-flex h-9 w-12 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition group-hover:border-white/20 group-hover:text-white">
      {open ? <CloseIcon /> : <ChevronDownIcon />}
    </span>
  );
}

function RiskWarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.75 20.25 19H3.75L12 4.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 9.5v4.25M12 16.5h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function parseHouseList(value: string | undefined) {
  return String(value ?? "")
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialProcedureType(
  defaultValues: ProcedureModalProps["defaultValues"],
  typeOptions: readonly ProcedureType[],
) {
  const initialGroup = getProcedureGroupFromType(defaultValues?.procedureType);
  const options = getDefaultProcedureOptions(initialGroup, typeOptions);

  return defaultValues?.procedureType ?? options[0]?.value ?? "SureBet";
}

function getInitialProtectionKeys(
  defaultValues: ProcedureModalProps["defaultValues"],
  procedureType: string,
) {
  if (defaultValues?.sportProtections?.length) {
    return defaultValues.sportProtections.map((_, index) => index);
  }

  if (defaultValues?.protections?.length) {
    return defaultValues.protections.map((_, index) => index);
  }

  if (!defaultValues && procedureType !== "Apostas Normais") {
    return [0];
  }

  return [];
}

function getInitialCollectionProtectionKeys(
  defaultValues: ProcedureModalProps["defaultValues"],
  procedureType: string,
) {
  if (defaultValues?.collectionProtections?.length) {
    return defaultValues.collectionProtections.map((_, index) => index);
  }

  return isFreebetProcedureType(procedureType)
    ? getInitialProtectionKeys(defaultValues, procedureType)
    : [];
}

function getInitialBetSide(value: unknown): BetSide {
  return value === "lay" ? "lay" : DEFAULT_BET_SIDE;
}

function getInitialResultSelections(
  values: unknown,
): SportResultSelection[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (value): value is SportResultSelection =>
      value === "principal" ||
      value === "defeat" ||
      /^protection-\d+$/.test(String(value)),
  );
}

function createProtectionDraftRecord(
  keys: number[],
  drafts:
    | ProcedureShareValues["sportProtections"]
    | ProcedureShareValues["collectionProtections"],
) {
  return keys.reduce<Record<number, ProtectionDraft>>((record, key, index) => {
    const draft = drafts?.[index];

    if (draft) {
      record[key] = createProtectionDraft({
        stake: draft.stake,
        odd: draft.odd,
        side: getInitialBetSide(draft.side),
        layOdd: draft.layOdd,
        commission: draft.commission,
      });
    }

    return record;
  }, {});
}

function HousePickerDialog({
  open,
  title,
  options,
  multiple = false,
  selectedValues,
  onClose,
  onToggle,
  onClear,
}: HousePickerDialogProps) {
  const [search, setSearch] = useState("");

  const visibleOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  function handleClose() {
    setSearch("");
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="lz-panel w-full max-w-xl rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>

          <button
            aria-label="Fechar"
            className="lz-button-secondary inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
            onClick={handleClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <input
            className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar casa..."
            type="search"
            value={search}
          />

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleOptions.length === 0 ? (
              <p className="px-1 py-3 text-sm text-[var(--text-muted)]">
                Nenhuma casa encontrada.
              </p>
            ) : (
              visibleOptions.map((option) => {
                const active = selectedValues.includes(option);

                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={option}
                    onClick={() => {
                      onToggle(option);
                      if (!multiple) {
                        handleClose();
                      }
                    }}
                    type="button"
                  >
                    <span>{option}</span>
                    {active ? <span>Selecionada</span> : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              className="text-sm text-[var(--text-dim)] transition hover:text-white"
              onClick={() => {
                setSearch("");
                onClear();
              }}
              type="button"
            >
              Limpar
            </button>

            {multiple ? (
              <button
                className="lz-button-primary rounded-full px-4 py-2 text-sm font-semibold"
                onClick={handleClose}
                type="button"
              >
                Concluir
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ProcedureModal({
  mode = "create",
  procedureId,
  triggerLabel = "Abrir modal",
  triggerClassName,
  title = "Novo Procedimento",
  submitLabel = "Criar procedimento",
  returnTo,
  typeOptions = PROCEDURE_TYPES,
  bookmakers = [],
  onTrigger,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  defaultValues,
}: ProcedureModalProps) {
  const { showToast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const protectionKeyRef = useRef(1000);
  const collectionProtectionKeyRef = useRef(2000);
  const initialProcedureGroup = getProcedureGroupFromType(defaultValues?.procedureType);
  const initialProcedureType = getInitialProcedureType(defaultValues, typeOptions);
  const initialFreebetValueInput =
    defaultValues?.freebetValue === undefined
      ? ""
      : String(defaultValues.freebetValue);
  const initialProtectionKeys = getInitialProtectionKeys(
    defaultValues,
    initialProcedureType,
  );
  const initialCollectionProtectionKeys = getInitialCollectionProtectionKeys(
    defaultValues,
    initialProcedureType,
  );
  const usesDefaultTypeOptions = typeOptions === PROCEDURE_TYPES;
  const [selectedType, setSelectedType] = useState<ProcedureType>(
    initialProcedureType,
  );
  const [selectedGroup, setSelectedGroup] =
    useState<ProcedureGroup>(initialProcedureGroup);
  const [operationDate, setOperationDate] = useState(
    defaultValues?.operationDate ?? getTodayInputValue(),
  );
  const [gameValue, setGameValue] = useState(
    defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""),
  );
  const [protectionKeys, setProtectionKeys] = useState<number[]>(
    initialProtectionKeys,
  );
  const [collectionProtectionKeys, setCollectionProtectionKeys] = useState<number[]>(
    initialCollectionProtectionKeys,
  );
  const [procedureStatus, setProcedureStatus] =
    useState<ProcedureStatus>(defaultValues?.procedureStatus ?? "Pendente");
  const [entryProfitValue, setEntryProfitValue] = useState(
    defaultValues?.entryValue === undefined ? "" : String(defaultValues.entryValue),
  );
  const [primaryStake, setPrimaryStake] = useState(
    defaultValues?.primaryStake ??
      (isFreebetProcedureType(initialProcedureType) ? initialFreebetValueInput : ""),
  );
  const [primaryOdd, setPrimaryOdd] = useState(defaultValues?.primaryOdd ?? "");
  const [primarySide, setPrimarySide] = useState<BetSide>(
    getInitialBetSide(defaultValues?.primarySide),
  );
  const [primaryLayOdd, setPrimaryLayOdd] = useState(
    defaultValues?.primaryLayOdd ?? "",
  );
  const [primaryCommission, setPrimaryCommission] = useState(
    defaultValues?.primaryCommission ?? "",
  );
  const [collectionPrimaryStake, setCollectionPrimaryStake] = useState(
    defaultValues?.collectionPrimaryStake ??
      (isFreebetProcedureType(initialProcedureType) ? initialFreebetValueInput : ""),
  );
  const [collectionPrimaryOdd, setCollectionPrimaryOdd] = useState(
    defaultValues?.collectionPrimaryOdd ?? "",
  );
  const [collectionPrimarySide, setCollectionPrimarySide] =
    useState<BetSide>(getInitialBetSide(defaultValues?.collectionPrimarySide));
  const [collectionPrimaryLayOdd, setCollectionPrimaryLayOdd] = useState(
    defaultValues?.collectionPrimaryLayOdd ?? "",
  );
  const [collectionPrimaryCommission, setCollectionPrimaryCommission] =
    useState(defaultValues?.collectionPrimaryCommission ?? "");
  const [protectionDrafts, setProtectionDrafts] = useState<
    Record<number, ProtectionDraft>
  >(createProtectionDraftRecord(initialProtectionKeys, defaultValues?.sportProtections));
  const [collectionProtectionDrafts, setCollectionProtectionDrafts] = useState<
    Record<number, ProtectionDraft>
  >(
    createProtectionDraftRecord(
      initialCollectionProtectionKeys,
      defaultValues?.collectionProtections,
    ),
  );
  const [sportResultSelections, setSportResultSelections] = useState<
    SportResultSelection[]
  >(getInitialResultSelections(defaultValues?.sportResultSelections));
  const [collectionResultSelections, setCollectionResultSelections] = useState<
    SportResultSelection[]
  >(getInitialResultSelections(defaultValues?.collectionResultSelections));
  const [noteExpanded, setNoteExpanded] = useState(Boolean(defaultValues?.note));
  const [noteValue, setNoteValue] = useState(defaultValues?.note ?? "");
  const [selectedHouses, setSelectedHouses] = useState<string[]>(
    defaultValues?.selectedHouses ?? parseHouseList(defaultValues?.houses),
  );
  const [collectionHouses, setCollectionHouses] = useState<string[]>(
    defaultValues?.collectionHouses ?? [],
  );
  const [selectedFreebetHouse, setSelectedFreebetHouse] = useState(
    defaultValues?.selectedFreebetHouse ?? defaultValues?.freebetHouse ?? "",
  );
  const [freebetValueInput, setFreebetValueInput] = useState(
    initialFreebetValueInput,
  );
  const [freebetConditionValue, setFreebetConditionValue] = useState(
    defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0] ?? "",
  );
  const [freebetCollectionOpen, setFreebetCollectionOpen] = useState(
    Boolean(defaultValues?.freebetCollectionOpen),
  );
  const [freebetConversionOpen, setFreebetConversionOpen] = useState(
    Boolean(defaultValues?.freebetConversionOpen),
  );
  const [housePickerTarget, setHousePickerTarget] =
    useState<HousePickerTarget | null>(null);
  const [freebetHousePickerOpen, setFreebetHousePickerOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const visibleGroups = usesDefaultTypeOptions
    ? PROCEDURE_GROUPS
    : PROCEDURE_GROUPS.filter((group) => group.id === selectedGroup);
  const visibleProcedureOptions = getDefaultProcedureOptions(selectedGroup, typeOptions);
  const isNormalBet = selectedType === "Apostas Normais";
  const isFreebetType = isFreebetProcedureType(selectedType);
  const isConversionOnly =
    typeOptions.length === 1 && typeOptions[0] === FREEBET_CONVERSION_TYPE;
  const supportsGame = selectedGroup === "sports";
  const supportsProfitDistribution = selectedGroup === "sports";
  const showFreebetBeforeHouses = isFreebetType;
  const sportEntries = [
    {
      resultId: "principal" as SportResultSelection,
      stakeInput: primaryStake,
      oddInput: primaryOdd,
      side: primarySide,
      layOddInput: primaryLayOdd,
      commissionInput: primaryCommission,
    },
    ...protectionKeys.map((key) => ({
      resultId: getProtectionResultId(key),
      stakeInput: protectionDrafts[key]?.stake ?? "",
      oddInput: protectionDrafts[key]?.odd ?? "",
      side: protectionDrafts[key]?.side ?? DEFAULT_BET_SIDE,
      layOddInput: protectionDrafts[key]?.layOdd ?? "",
      commissionInput: protectionDrafts[key]?.commission ?? "",
    })),
  ];
  const collectionEntries = [
    {
      resultId: "principal" as SportResultSelection,
      stakeInput: collectionPrimaryStake,
      oddInput: collectionPrimaryOdd,
      side: collectionPrimarySide,
      layOddInput: collectionPrimaryLayOdd,
      commissionInput: collectionPrimaryCommission,
    },
    ...collectionProtectionKeys.map((key) => ({
      resultId: getProtectionResultId(key),
      stakeInput: collectionProtectionDrafts[key]?.stake ?? "",
      oddInput: collectionProtectionDrafts[key]?.odd ?? "",
      side: collectionProtectionDrafts[key]?.side ?? DEFAULT_BET_SIDE,
      layOddInput: collectionProtectionDrafts[key]?.layOdd ?? "",
      commissionInput: collectionProtectionDrafts[key]?.commission ?? "",
    })),
  ];
  const hasSportsCalculationInput =
    primaryStake.trim() !== "" ||
    primaryOdd.trim() !== "" ||
    primaryLayOdd.trim() !== "" ||
    primaryCommission.trim() !== "" ||
    primarySide === "lay" ||
    Object.values(protectionDrafts).some(
      (draft) =>
        draft.stake.trim() !== "" ||
        draft.odd.trim() !== "" ||
        draft.layOdd.trim() !== "" ||
        draft.commission.trim() !== "" ||
        draft.side === "lay",
    ) ||
    sportResultSelections.length > 0;
  const hasCollectionCalculationInput =
    collectionPrimaryStake.trim() !== "" ||
    collectionPrimaryOdd.trim() !== "" ||
    collectionPrimaryLayOdd.trim() !== "" ||
    collectionPrimaryCommission.trim() !== "" ||
    collectionPrimarySide === "lay" ||
    Object.values(collectionProtectionDrafts).some(
      (draft) =>
        draft.stake.trim() !== "" ||
        draft.odd.trim() !== "" ||
        draft.layOdd.trim() !== "" ||
        draft.commission.trim() !== "" ||
        draft.side === "lay",
    ) ||
    collectionResultSelections.length > 0;
  const calculatedSportsProfit = calculateSportsProfit(
    sportEntries,
    sportResultSelections,
  );
  const calculatedCollectionProfit = calculateSportsProfit(
    collectionEntries,
    collectionResultSelections,
  );
  const sportsResultAmount = normalizeCurrencyAmount(
    hasSportsCalculationInput
      ? calculatedSportsProfit
      : parseDecimalInput(entryProfitValue),
  );
  const collectionResultAmount = normalizeCurrencyAmount(
    hasCollectionCalculationInput ? calculatedCollectionProfit : 0,
  );
  const freebetCollectionResultAmount = collectionResultAmount;
  const freebetConversionResultAmount = normalizeCurrencyAmount(
    hasSportsCalculationInput ? sportsResultAmount : 0,
  );
  const freebetResultAmount = normalizeCurrencyAmount(
    hasSportsCalculationInput || hasCollectionCalculationInput
      ? freebetCollectionResultAmount + freebetConversionResultAmount
      : parseDecimalInput(entryProfitValue),
  );
  const entryProfitAmount = normalizeCurrencyAmount(
    parseDecimalInput(entryProfitValue),
  );
  const sportsResultLabel = getResultLabel(sportsResultAmount, true);
  const freebetCollectionResultLabel = getScopedResultLabel(
    freebetCollectionResultAmount,
    "coleta",
  );
  const freebetConversionResultLabel = getScopedResultLabel(
    freebetConversionResultAmount,
    "conversão",
  );
  const freebetResultLabel = getResultLabel(freebetResultAmount, true);
  const casinoResultInputLabel = `${getResultLabel(entryProfitAmount)} R$`;
  const sportResultOptions: Array<{
    value: SportResultSelection;
    label: string;
  }> = [
    { value: "principal", label: "Principal" },
    ...(!isNormalBet
      ? protectionKeys.map((key, index) => ({
          value: getProtectionResultId(key),
          label: `Proteção ${index + 1}`,
        }))
      : []),
    { value: "defeat", label: "Derrota" },
  ];
  const collectionResultOptions: Array<{
    value: SportResultSelection;
    label: string;
  }> = [
    { value: "principal", label: "Principal" },
    ...collectionProtectionKeys.map((key, index) => ({
      value: getProtectionResultId(key),
      label: `Proteção ${index + 1}`,
    })),
    { value: "defeat", label: "Derrota" },
  ];
  const submittedHouses = (
    isFreebetType
      ? [
          ...collectionHouses.slice(1),
          ...selectedHouses.slice(1),
          selectedFreebetHouse,
        ]
      : selectedHouses
  )
    .filter(Boolean)
    .filter((house, index, houses) => houses.indexOf(house) === index)
    .join(", ");
  const entryValueForSubmit =
    selectedGroup === "sports"
      ? (isFreebetType ? freebetResultAmount : sportsResultAmount).toFixed(2)
      : entryProfitValue.trim()
        ? entryProfitAmount.toFixed(2)
        : entryProfitValue;
  const selectedHousePickerValue = housePickerTarget
    ? housePickerTarget.section === "collection"
      ? collectionHouses[housePickerTarget.index]
      : selectedHouses[housePickerTarget.index]
    : "";

  function getProcedureSharePayload(): ProcedureShareValues {
    const resultAmount =
      selectedGroup === "sports"
        ? isFreebetType
          ? freebetResultAmount
          : sportsResultAmount
        : entryProfitAmount;
    const housesText = submittedHouses || selectedHouses.filter(Boolean).join(", ");

    return {
      version: 1,
      procedureType: selectedType,
      operationDate,
      game: gameValue,
      houses: housesText,
      entryValue: resultAmount,
      note: noteValue,
      freebetHouse: selectedFreebetHouse,
      freebetValue: parseDecimalInput(freebetValueInput),
      freebetCondition: freebetConditionValue,
      procedureStatus,
      selectedHouses,
      collectionHouses,
      selectedFreebetHouse,
      primaryStake,
      primaryOdd,
      primarySide,
      primaryLayOdd,
      primaryCommission,
      sportProtections: protectionKeys.map((key) =>
        createProtectionDraft(protectionDrafts[key]),
      ),
      sportResultSelections,
      collectionPrimaryStake,
      collectionPrimaryOdd,
      collectionPrimarySide,
      collectionPrimaryLayOdd,
      collectionPrimaryCommission,
      collectionProtections: collectionProtectionKeys.map((key) =>
        createProtectionDraft(collectionProtectionDrafts[key]),
      ),
      collectionResultSelections,
      freebetCollectionOpen,
      freebetConversionOpen,
    };
  }

  async function handleCopyProcedure() {
    const copied = await copyTextToClipboard(
      buildProcedureShareUrl(getProcedureSharePayload()),
    );

    showToast({
      title: copied
        ? "Link do procedimento copiado."
        : "Não foi possível copiar o link.",
      tone: copied ? "success" : "error",
    });
  }

  function renderSportsBetFields({
    stakeName,
    oddName,
    stakeValue,
    oddValue,
    side,
    layOddValue,
    commissionValue,
    onStakeChange,
    onOddChange,
    onToggleSide,
    onLayOddChange,
    onCommissionChange,
  }: {
    stakeName: string;
    oddName: string;
    stakeValue: string;
    oddValue: string;
    side: BetSide;
    layOddValue: string;
    commissionValue: string;
    onStakeChange: (value: string) => void;
    onOddChange: (value: string) => void;
    onToggleSide: () => void;
    onLayOddChange: (value: string) => void;
    onCommissionChange: (value: string) => void;
  }) {
    const isLay = side === "lay";

    return (
      <>
        <label className="space-y-2 text-sm">
          <span className="text-[var(--text-muted)]">Valor R$</span>
          <input
            className="lz-input w-full rounded-2xl px-3 py-3"
            inputMode="decimal"
            name={stakeName}
            onChange={(event) => onStakeChange(event.target.value)}
            placeholder="0,00"
            value={stakeValue}
          />
          {isLay ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-gold)]">
              <RiskWarningIcon />
              Valor do risco!
            </p>
          ) : null}
        </label>

        <div className="space-y-2 text-sm">
          <span className="text-[var(--text-muted)]">Odd</span>
          <div className="flex gap-2">
            <input
              className="lz-input min-w-0 flex-1 rounded-2xl px-3 py-3"
              inputMode="decimal"
              name={oddName}
              onChange={(event) => onOddChange(event.target.value)}
              placeholder="0.000"
              value={oddValue}
            />
            <button
              aria-label={isLay ? "Alternar para back" : "Alternar para lay"}
              className={`min-w-12 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                isLay
                  ? "border border-[rgba(255,217,64,0.55)] bg-[var(--accent-gold)] text-black shadow-[0_12px_32px_rgba(255,217,64,0.18)]"
                  : "lz-button-secondary"
              }`}
              onClick={onToggleSide}
              title={isLay ? "Lay" : "Back"}
              type="button"
            >
              {isLay ? "L" : "B"}
            </button>
          </div>
        </div>

        {isLay ? (
          <>
            <label className="space-y-2 text-sm">
              <span className="text-[var(--text-muted)]">Comissão %</span>
              <input
                className="lz-input w-full rounded-2xl px-3 py-3"
                inputMode="decimal"
                onChange={(event) => onCommissionChange(event.target.value)}
                placeholder="0,00"
                value={commissionValue}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-[var(--text-muted)]">Odd Lay</span>
              <input
                className="lz-input w-full rounded-2xl px-3 py-3"
                inputMode="decimal"
                onChange={(event) => onLayOddChange(event.target.value)}
                placeholder="0.000"
                value={layOddValue}
              />
            </label>
          </>
        ) : null}
      </>
    );
  }

  function getNextProtectionKey() {
    protectionKeyRef.current += 1;
    return protectionKeyRef.current;
  }

  function getNextCollectionProtectionKey() {
    collectionProtectionKeyRef.current += 1;
    return collectionProtectionKeyRef.current;
  }

  function resetSportsCalculationState() {
    setPrimaryStake("");
    setPrimaryOdd("");
    setPrimarySide(DEFAULT_BET_SIDE);
    setPrimaryLayOdd("");
    setPrimaryCommission("");
    setProtectionDrafts({});
    setSportResultSelections([]);
  }

  function resetCollectionCalculationState() {
    setCollectionPrimaryStake("");
    setCollectionPrimaryOdd("");
    setCollectionPrimarySide(DEFAULT_BET_SIDE);
    setCollectionPrimaryLayOdd("");
    setCollectionPrimaryCommission("");
    setCollectionProtectionDrafts({});
    setCollectionResultSelections([]);
  }

  function addProtection() {
    setProtectionKeys((current) => {
      if (current.length >= MAX_SPORT_PROTECTIONS) {
        return current;
      }

      return [...current, getNextProtectionKey()];
    });
  }

  function addCollectionProtection() {
    setCollectionProtectionKeys((current) => {
      if (current.length >= MAX_SPORT_PROTECTIONS) {
        return current;
      }

      return [...current, getNextCollectionProtectionKey()];
    });
  }

  function selectProcedureGroup(group: ProcedureGroup) {
    const nextOptions = getDefaultProcedureOptions(group, typeOptions);
    const nextType = nextOptions[0]?.value ?? selectedType;

    setSelectedGroup(group);
    setSelectedType(nextType);
    setFreebetCollectionOpen(false);
    setFreebetConversionOpen(false);
    resetSportsCalculationState();
    resetCollectionCalculationState();
    if (isFreebetProcedureType(nextType)) {
      setPrimaryStake(freebetValueInput);
      setCollectionPrimaryStake(freebetValueInput);
    }
    setProtectionKeys(
      group === "sports" && nextType !== "Apostas Normais"
        ? [getNextProtectionKey()]
        : [],
    );
    setCollectionProtectionKeys(
      group === "sports" && isFreebetProcedureType(nextType)
        ? [getNextCollectionProtectionKey()]
        : [],
    );
  }

  function selectProcedureType(type: string) {
    setSelectedType(type);
    setFreebetCollectionOpen(false);
    setFreebetConversionOpen(false);
    resetSportsCalculationState();
    resetCollectionCalculationState();
    if (isFreebetProcedureType(type)) {
      setPrimaryStake(freebetValueInput);
      setCollectionPrimaryStake(freebetValueInput);
    }

    if (type === "Apostas Normais" || selectedGroup !== "sports") {
      setProtectionKeys([]);
      setCollectionProtectionKeys([]);
      return;
    }

    if (protectionKeys.length === 0) {
      setProtectionKeys([getNextProtectionKey()]);
    }

    if (isFreebetProcedureType(type) && collectionProtectionKeys.length === 0) {
      setCollectionProtectionKeys([getNextCollectionProtectionKey()]);
    }
  }

  function setSelectedHouseAtIndex(index: number, value: string) {
    setSelectedHouses((current) => {
      const next = [...current];

      while (next.length <= index) {
        next.push("");
      }

      next[index] = value;
      return next;
    });
  }

  function setCollectionHouseAtIndex(index: number, value: string) {
    setCollectionHouses((current) => {
      const next = [...current];

      while (next.length <= index) {
        next.push("");
      }

      next[index] = value;
      return next;
    });
  }

  function clearSelectedHouseAtIndex(index: number) {
    setSelectedHouses((current) => {
      const next = [...current];
      next[index] = "";
      return next;
    });
  }

  function clearCollectionHouseAtIndex(index: number) {
    setCollectionHouses((current) => {
      const next = [...current];
      next[index] = "";
      return next;
    });
  }

  function removeProtection(key: number, protectionIndex: number) {
    setProtectionKeys((current) => current.filter((item) => item !== key));
    setProtectionDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSportResultSelections((current) =>
      current.filter((item) => item !== getProtectionResultId(key)),
    );
    setSelectedHouses((current) =>
      current.filter((_, houseIndex) => houseIndex !== protectionIndex + 1),
    );
  }

  function removeCollectionProtection(key: number, protectionIndex: number) {
    setCollectionProtectionKeys((current) =>
      current.filter((item) => item !== key),
    );
    setCollectionProtectionDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setCollectionResultSelections((current) =>
      current.filter((item) => item !== getProtectionResultId(key)),
    );
    setCollectionHouses((current) =>
      current.filter((_, houseIndex) => houseIndex !== protectionIndex + 1),
    );
  }

  function setProtectionDraftValue<K extends keyof ProtectionDraft>(
    key: number,
    field: K,
    value: ProtectionDraft[K],
  ) {
    setProtectionDrafts((current) => ({
      ...current,
      [key]: {
        ...createProtectionDraft(current[key]),
        [field]: value,
      },
    }));
  }

  function setCollectionProtectionDraftValue<K extends keyof ProtectionDraft>(
    key: number,
    field: K,
    value: ProtectionDraft[K],
  ) {
    setCollectionProtectionDrafts((current) => ({
      ...current,
      [key]: {
        ...createProtectionDraft(current[key]),
        [field]: value,
      },
    }));
  }

  function getNextResultSelections(
    current: SportResultSelection[],
    value: SportResultSelection,
  ): SportResultSelection[] {
    if (value === "defeat") {
      return current.includes("defeat") ? [] : ["defeat"];
    }

    const withoutDefeat = current.filter((item) => item !== "defeat");

    if (withoutDefeat.includes(value)) {
      return withoutDefeat.filter((item) => item !== value);
    }

    return [...withoutDefeat, value];
  }

  function toggleSportResultSelection(value: SportResultSelection) {
    setSportResultSelections((current) => getNextResultSelections(current, value));
  }

  function toggleCollectionResultSelection(value: SportResultSelection) {
    setCollectionResultSelections((current) =>
      getNextResultSelections(current, value),
    );
  }

  function toggleSelectedFreebetHouse(value: string) {
    setSelectedFreebetHouse((current) => (current === value ? "" : value));
  }

  function clearSelectedFreebetHouse() {
    setSelectedFreebetHouse("");
  }

  function handleFreebetValueChange(value: string) {
    const previousValue = freebetValueInput;

    setFreebetValueInput(value);
    setCollectionPrimaryStake((current) =>
      current.trim() === "" || current === previousValue ? value : current,
    );
    setPrimaryStake((current) =>
      current.trim() === "" || current === previousValue ? value : current,
    );
  }

  function resetFormState() {
    const nextGroup = getProcedureGroupFromType(defaultValues?.procedureType);
    const nextType = getInitialProcedureType(defaultValues, typeOptions);
    const nextFreebetValue =
      defaultValues?.freebetValue === undefined
        ? ""
        : String(defaultValues.freebetValue);
    const shouldSeedFreebetValue = isFreebetProcedureType(nextType);
    const nextProtectionKeys = getInitialProtectionKeys(defaultValues, nextType);
    const nextCollectionProtectionKeys = getInitialCollectionProtectionKeys(
      defaultValues,
      nextType,
    );

    setSelectedGroup(nextGroup);
    setSelectedType(nextType);
    setOperationDate(defaultValues?.operationDate ?? getTodayInputValue());
    setGameValue(defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""));
    setProtectionKeys(nextProtectionKeys);
    setCollectionProtectionKeys(nextCollectionProtectionKeys);
    setProcedureStatus(defaultValues?.procedureStatus ?? "Pendente");
    setEntryProfitValue(
      defaultValues?.entryValue === undefined ? "" : String(defaultValues.entryValue),
    );
    setPrimaryStake(
      defaultValues?.primaryStake ??
        (shouldSeedFreebetValue ? nextFreebetValue : ""),
    );
    setPrimaryOdd(defaultValues?.primaryOdd ?? "");
    setPrimarySide(getInitialBetSide(defaultValues?.primarySide));
    setPrimaryLayOdd(defaultValues?.primaryLayOdd ?? "");
    setPrimaryCommission(defaultValues?.primaryCommission ?? "");
    setCollectionPrimaryStake(
      defaultValues?.collectionPrimaryStake ??
        (shouldSeedFreebetValue ? nextFreebetValue : ""),
    );
    setCollectionPrimaryOdd(defaultValues?.collectionPrimaryOdd ?? "");
    setCollectionPrimarySide(getInitialBetSide(defaultValues?.collectionPrimarySide));
    setCollectionPrimaryLayOdd(defaultValues?.collectionPrimaryLayOdd ?? "");
    setCollectionPrimaryCommission(
      defaultValues?.collectionPrimaryCommission ?? "",
    );
    setProtectionDrafts(
      createProtectionDraftRecord(
        nextProtectionKeys,
        defaultValues?.sportProtections,
      ),
    );
    setCollectionProtectionDrafts(
      createProtectionDraftRecord(
        nextCollectionProtectionKeys,
        defaultValues?.collectionProtections,
      ),
    );
    setSportResultSelections(
      getInitialResultSelections(defaultValues?.sportResultSelections),
    );
    setCollectionResultSelections(
      getInitialResultSelections(defaultValues?.collectionResultSelections),
    );
    setNoteExpanded(Boolean(defaultValues?.note));
    setNoteValue(defaultValues?.note ?? "");
    setSelectedHouses(defaultValues?.selectedHouses ?? parseHouseList(defaultValues?.houses));
    setCollectionHouses(defaultValues?.collectionHouses ?? []);
    setSelectedFreebetHouse(
      defaultValues?.selectedFreebetHouse ?? defaultValues?.freebetHouse ?? "",
    );
    setFreebetValueInput(nextFreebetValue);
    setFreebetConditionValue(
      defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0] ?? "",
    );
    setFreebetCollectionOpen(Boolean(defaultValues?.freebetCollectionOpen));
    setFreebetConversionOpen(Boolean(defaultValues?.freebetConversionOpen));
    setHousePickerTarget(null);
    setFreebetHousePickerOpen(false);
  }

  function setOpen(nextValue: boolean) {
    onOpenChange?.(nextValue);

    if (controlledOpen === undefined) {
      setInternalOpen(nextValue);
    }

    if (!nextValue) {
      resetFormState();
    }
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          className={
            triggerClassName ??
            "lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
          }
          onClick={() => {
            resetFormState();
            onTrigger?.();
            setOpen(true);
          }}
          type="button"
        >
          {triggerLabel}
        </button>
      ) : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center py-2 md:py-4">
          <div className="lz-panel w-full max-w-7xl rounded-[34px] shadow-[0_30px_90px_rgba(0,0,0,0.5)] md:[zoom:0.8]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">{title}</h2>

              <button
                aria-label="Fechar"
                className="lz-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full p-0"
                onClick={() => setOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <form
              action={mode === "edit" ? updateProcedureAction : saveProcedureAction}
              className="space-y-6 px-6 py-6"
            >
              <input name="returnTo" type="hidden" value={returnTo} />
              <input
                name="houses"
                type="hidden"
                value={submittedHouses}
              />
              <input name="entryValue" type="hidden" value={entryValueForSubmit} />
              <input name="procedureStatus" type="hidden" value={procedureStatus} />
              <input
                name="doubleValue"
                type="hidden"
                value={defaultValues?.doubleValue ?? ""}
              />
              <input
                name="freebetHouse"
                type="hidden"
                value={isFreebetType ? selectedFreebetHouse : ""}
              />
              <input
                name="freebetValue"
                type="hidden"
                value={isFreebetType ? freebetValueInput : ""}
              />
              <input
                name="freebetCondition"
                type="hidden"
                value={isFreebetType ? freebetConditionValue : ""}
              />

              {mode === "edit" && procedureId ? (
                <input name="procedureId" type="hidden" value={procedureId} />
              ) : null}
              {defaultValues?.originIds?.map((originId) => (
                <input key={originId} name="originIds" type="hidden" value={originId} />
              ))}

              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {visibleGroups.map((group) => {
                    const active = selectedGroup === group.id;

                    return (
                      <button
                        className={`rounded-[22px] px-4 py-3 text-sm font-semibold transition ${
                          active ? "lz-button-primary" : "lz-button-secondary"
                        }`}
                        key={group.id}
                        onClick={() => selectProcedureGroup(group.id)}
                        type="button"
                      >
                        {group.label}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Tipo de procedimento</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleProcedureOptions.map((option) => {
                      const active = isFreebetProcedureType(option.value)
                        ? isFreebetType
                        : selectedType === option.value;

                      return (
                        <button
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            active ? "lz-button-primary" : "lz-button-secondary"
                          }`}
                          key={option.value}
                          onClick={() => {
                            if (active && isFreebetProcedureType(option.value)) {
                              return;
                            }

                            selectProcedureType(option.value);
                          }}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <input name="procedureType" type="hidden" value={selectedType} />
                </div>
              </div>

              <div className={`grid gap-4 ${supportsGame ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Data</span>
                  <DatePickerField
                    name="operationDate"
                    onChange={setOperationDate}
                    value={operationDate}
                  />
                </label>

                {supportsGame ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Jogo</span>
                    <input
                      className="lz-input w-full rounded-2xl px-3 py-3"
                      name="game"
                      onChange={(event) => setGameValue(event.target.value)}
                      placeholder="Ex.: Barcelona x Real Madrid"
                      type="text"
                      value={gameValue}
                    />
                  </label>
                ) : null}
              </div>

              {isFreebetType ? (
                <div className="grid gap-4 rounded-[24px] border border-white/10 bg-white/4 p-4 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <span className="font-medium text-white">Casa da freebet</span>
                    <button
                      className={`w-full rounded-2xl px-3 py-3 text-left transition ${
                        isConversionOnly
                          ? "cursor-default border border-white/10 bg-white/5 text-[var(--text-dim)]"
                          : "lz-button-secondary"
                      }`}
                      disabled={isConversionOnly}
                      onClick={() => setFreebetHousePickerOpen(true)}
                      type="button"
                    >
                      {selectedFreebetHouse || "Escolher casa"}
                    </button>
                  </div>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Valor da freebet</span>
                    <input
                      className="lz-input w-full rounded-2xl px-3 py-3"
                      onChange={(event) =>
                        handleFreebetValueChange(event.target.value)
                      }
                      placeholder="0,00"
                      step="0.01"
                      type="number"
                      value={freebetValueInput}
                    />
                  </label>

                  <div className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium text-white">
                      Condição da freebet
                    </span>
                    <LzSelect
                      className="w-full rounded-2xl px-3 py-3 text-sm"
                      onValueChange={setFreebetConditionValue}
                      options={FREEBET_CONDITIONS.map((condition) => ({
                        value: condition,
                        label: condition,
                      }))}
                      value={freebetConditionValue}
                    />
                  </div>
                </div>
              ) : null}

              <input name="note" type="hidden" value={noteValue} />

              {noteExpanded ? (
                <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">Observações</p>
                    <button
                      aria-label="Recolher observações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-white/20 hover:text-white"
                      onClick={() => setNoteExpanded(false)}
                      type="button"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <textarea
                    className="lz-textarea h-[58px] min-h-[58px] w-full resize-y rounded-2xl px-3 py-3 text-sm leading-6"
                    onChange={(event) => setNoteValue(event.target.value)}
                    placeholder="Adicione qualquer contexto importante"
                    value={noteValue}
                  />
                </div>
              ) : (
                <button
                  className="text-left text-sm font-medium text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => setNoteExpanded(true)}
                  type="button"
                >
                  Adicionar observações
                </button>
              )}

              {showFreebetBeforeHouses ? (
                <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <button
                    aria-label={
                      freebetCollectionOpen ? "Fechar coleta" : "Abrir coleta"
                    }
                    aria-expanded={freebetCollectionOpen}
                    className="group flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setFreebetCollectionOpen((current) => !current)}
                    type="button"
                  >
                    <span className="text-sm font-semibold text-white">Coleta</span>
                    <DisclosureIcon open={freebetCollectionOpen} />
                  </button>

                  {freebetCollectionOpen ? (
                    <>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div
                          className={getSportCardClass(
                            collectionResultSelections.includes("principal"),
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-white">
                              Principal
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {renderSportsBetFields({
                              stakeName: "collectionPrimaryStake",
                              oddName: "collectionPrimaryOdd",
                              stakeValue: collectionPrimaryStake,
                              oddValue: collectionPrimaryOdd,
                              side: collectionPrimarySide,
                              layOddValue: collectionPrimaryLayOdd,
                              commissionValue: collectionPrimaryCommission,
                              onStakeChange: setCollectionPrimaryStake,
                              onOddChange: setCollectionPrimaryOdd,
                              onToggleSide: () =>
                                setCollectionPrimarySide((current) =>
                                  current === "back" ? "lay" : "back",
                                ),
                              onLayOddChange: setCollectionPrimaryLayOdd,
                              onCommissionChange: setCollectionPrimaryCommission,
                            })}
                          </div>
                        </div>

                        {collectionProtectionKeys.map((key, index) => {
                          const protectionResultId = getProtectionResultId(key);
                          const protectionSelected =
                            collectionResultSelections.includes(protectionResultId);

                          return (
                            <div
                              className={getSportCardClass(protectionSelected)}
                              key={key}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-white">
                                  Proteção {index + 1}
                                </p>
                                <button
                                  aria-label={`Remover proteção ${index + 1}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-[rgba(255,107,133,0.28)] hover:bg-[rgba(255,107,133,0.12)] hover:text-[var(--negative)]"
                                  onClick={() =>
                                    removeCollectionProtection(key, index)
                                  }
                                  type="button"
                                >
                                  <CloseIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2 text-sm sm:col-span-2">
                                  <span className="text-[var(--text-muted)]">Casa</span>
                                  <button
                                    className="lz-button-secondary w-full rounded-2xl px-3 py-3 text-left"
                                    onClick={() =>
                                      setHousePickerTarget({
                                        section: "collection",
                                        index: index + 1,
                                      })
                                    }
                                    type="button"
                                  >
                                    {collectionHouses[index + 1] || "Escolher casa"}
                                  </button>
                                </div>

                                {renderSportsBetFields({
                                  stakeName: "collectionProtectionStake",
                                  oddName: "collectionProtectionOdd",
                                  stakeValue:
                                    collectionProtectionDrafts[key]?.stake ?? "",
                                  oddValue:
                                    collectionProtectionDrafts[key]?.odd ?? "",
                                  side:
                                    collectionProtectionDrafts[key]?.side ??
                                    DEFAULT_BET_SIDE,
                                  layOddValue:
                                    collectionProtectionDrafts[key]?.layOdd ?? "",
                                  commissionValue:
                                    collectionProtectionDrafts[key]?.commission ?? "",
                                  onStakeChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "stake",
                                      value,
                                    ),
                                  onOddChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "odd",
                                      value,
                                    ),
                                  onToggleSide: () =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "side",
                                      (collectionProtectionDrafts[key]?.side ??
                                        DEFAULT_BET_SIDE) === "back"
                                        ? "lay"
                                        : "back",
                                    ),
                                  onLayOddChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "layOdd",
                                      value,
                                    ),
                                  onCommissionChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "commission",
                                      value,
                                    ),
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {collectionProtectionKeys.length < MAX_SPORT_PROTECTIONS ? (
                        <button
                          className="lz-button-secondary rounded-full px-3 py-2 text-sm font-medium"
                          onClick={addCollectionProtection}
                          type="button"
                        >
                          Adicionar proteção
                        </button>
                      ) : null}

                      <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                          Resultado da coleta
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {collectionResultOptions.map((option) => {
                            const active = collectionResultSelections.includes(
                              option.value,
                            );
                            const defeat = option.value === "defeat";

                            return (
                              <button
                                aria-pressed={active}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  active
                                    ? defeat
                                      ? "border border-[rgba(255,96,96,0.45)] bg-[rgba(255,96,96,0.16)] text-[var(--negative)]"
                                      : "lz-button-primary"
                                    : "lz-button-secondary"
                                }`}
                                key={option.value}
                                onClick={() =>
                                  toggleCollectionResultSelection(option.value)
                                }
                                type="button"
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </>
                  ) : null}
                </div>
              ) : null}

              {supportsProfitDistribution ? (
                <div
                  className={
                    isFreebetType
                      ? "space-y-4"
                      : "space-y-4 rounded-[26px] border border-white/10 bg-white/4 p-4"
                  }
                >
                  <div
                    className={
                      isFreebetType
                        ? "space-y-4 rounded-[24px] border border-white/10 bg-white/4 p-4"
                        : "space-y-4"
                    }
                  >
                  {isFreebetType ? (
                    <button
                      aria-label={
                        freebetConversionOpen
                          ? "Fechar conversão"
                          : "Abrir conversão"
                      }
                      aria-expanded={freebetConversionOpen}
                      className="group flex w-full items-center justify-between gap-3 text-left"
                      onClick={() =>
                        setFreebetConversionOpen((current) => !current)
                      }
                      type="button"
                    >
                      <span className="text-sm font-semibold text-white">
                        Conversão
                      </span>
                      <DisclosureIcon open={freebetConversionOpen} />
                    </button>
                  ) : null}

                  {!isFreebetType || freebetConversionOpen ? (
                    <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div
                      className={getSportCardClass(
                        sportResultSelections.includes("principal"),
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Principal</p>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {!isFreebetType ? (
                          <div className="space-y-2 text-sm sm:col-span-2">
                            <span className="text-[var(--text-muted)]">Casa</span>
                            <button
                              className="lz-button-secondary w-full rounded-2xl px-3 py-3 text-left"
                              onClick={() =>
                                setHousePickerTarget({ section: "main", index: 0 })
                              }
                              type="button"
                            >
                              {selectedHouses[0] || "Escolher casa"}
                            </button>
                          </div>
                        ) : null}

                        {renderSportsBetFields({
                          stakeName: "primaryStake",
                          oddName: "primaryOdd",
                          stakeValue: primaryStake,
                          oddValue: primaryOdd,
                          side: primarySide,
                          layOddValue: primaryLayOdd,
                          commissionValue: primaryCommission,
                          onStakeChange: setPrimaryStake,
                          onOddChange: setPrimaryOdd,
                          onToggleSide: () =>
                            setPrimarySide((current) =>
                              current === "back" ? "lay" : "back",
                            ),
                          onLayOddChange: setPrimaryLayOdd,
                          onCommissionChange: setPrimaryCommission,
                        })}
                      </div>
                    </div>

                    {!isNormalBet
                      ? protectionKeys.map((key, index) => {
                          const protectionResultId = getProtectionResultId(key);
                          const protectionSelected =
                            sportResultSelections.includes(protectionResultId);

                          return (
                            <div
                              className={getSportCardClass(protectionSelected)}
                              key={key}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-white">
                                  Proteção {index + 1}
                                </p>
                                <button
                                  aria-label={`Remover proteção ${index + 1}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-[rgba(255,107,133,0.28)] hover:bg-[rgba(255,107,133,0.12)] hover:text-[var(--negative)]"
                                  onClick={() => removeProtection(key, index)}
                                  type="button"
                                >
                                  <CloseIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2 text-sm sm:col-span-2">
                                  <span className="text-[var(--text-muted)]">Casa</span>
                                  <button
                                    className="lz-button-secondary w-full rounded-2xl px-3 py-3 text-left"
                                    onClick={() =>
                                      setHousePickerTarget({
                                        section: "main",
                                        index: index + 1,
                                      })
                                    }
                                    type="button"
                                  >
                                    {selectedHouses[index + 1] || "Escolher casa"}
                                  </button>
                                </div>

                                {renderSportsBetFields({
                                  stakeName: "protectionStake",
                                  oddName: "protectionOdd",
                                  stakeValue: protectionDrafts[key]?.stake ?? "",
                                  oddValue: protectionDrafts[key]?.odd ?? "",
                                  side:
                                    protectionDrafts[key]?.side ??
                                    DEFAULT_BET_SIDE,
                                  layOddValue:
                                    protectionDrafts[key]?.layOdd ?? "",
                                  commissionValue:
                                    protectionDrafts[key]?.commission ?? "",
                                  onStakeChange: (value) =>
                                    setProtectionDraftValue(key, "stake", value),
                                  onOddChange: (value) =>
                                    setProtectionDraftValue(key, "odd", value),
                                  onToggleSide: () =>
                                    setProtectionDraftValue(
                                      key,
                                      "side",
                                      (protectionDrafts[key]?.side ??
                                        DEFAULT_BET_SIDE) === "back"
                                        ? "lay"
                                        : "back",
                                    ),
                                  onLayOddChange: (value) =>
                                    setProtectionDraftValue(key, "layOdd", value),
                                  onCommissionChange: (value) =>
                                    setProtectionDraftValue(
                                      key,
                                      "commission",
                                      value,
                                    ),
                                })}
                              </div>
                            </div>
                          );
                        })
                      : null}
                  </div>

                  {!isNormalBet &&
                  protectionKeys.length < MAX_SPORT_PROTECTIONS ? (
                    <button
                      className="lz-button-secondary rounded-full px-3 py-2 text-sm font-medium"
                      onClick={addProtection}
                      type="button"
                    >
                      Adicionar proteção
                    </button>
                  ) : null}

                  {isFreebetType ? (
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        Resultado da conversão
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sportResultOptions.map((option) => {
                          const active = sportResultSelections.includes(
                            option.value,
                          );
                          const defeat = option.value === "defeat";

                          return (
                            <button
                              aria-pressed={active}
                              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                active
                                  ? defeat
                                    ? "border border-[rgba(255,96,96,0.45)] bg-[rgba(255,96,96,0.16)] text-[var(--negative)]"
                                    : "lz-button-primary"
                                  : "lz-button-secondary"
                              }`}
                              key={option.value}
                              onClick={() =>
                                toggleSportResultSelection(option.value)
                              }
                              type="button"
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {!isFreebetType ? (
                    <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                      <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                          Resultado
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sportResultOptions.map((option) => {
                            const active = sportResultSelections.includes(
                              option.value,
                            );
                            const defeat = option.value === "defeat";

                            return (
                              <button
                                aria-pressed={active}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  active
                                    ? defeat
                                      ? "border border-[rgba(255,96,96,0.45)] bg-[rgba(255,96,96,0.16)] text-[var(--negative)]"
                                      : "lz-button-primary"
                                    : "lz-button-secondary"
                                }`}
                                key={option.value}
                                onClick={() =>
                                  toggleSportResultSelection(option.value)
                                }
                                type="button"
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                          {sportsResultLabel}
                        </p>
                        <p
                          className={`mt-2 text-xl font-semibold ${getResultAmountClass(
                            sportsResultAmount,
                          )}`}
                        >
                          {formatProcedureCurrency(sportsResultAmount)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                    </>
                  ) : null}
                  </div>

                  {isFreebetType ? (
                    <div className="space-y-4 rounded-[26px] border border-white/10 bg-white/4 p-4">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {freebetCollectionResultLabel}
                          </p>
                          <p
                            className={`mt-2 text-xl font-semibold ${getResultAmountClass(
                              freebetCollectionResultAmount,
                            )}`}
                          >
                            {formatProcedureCurrency(freebetCollectionResultAmount)}
                          </p>
                        </div>

                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {freebetConversionResultLabel}
                          </p>
                          <p
                            className={`mt-2 text-xl font-semibold ${getResultAmountClass(
                              freebetConversionResultAmount,
                            )}`}
                          >
                            {formatProcedureCurrency(freebetConversionResultAmount)}
                          </p>
                        </div>

                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-4">
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {freebetResultLabel}
                          </p>
                          <p
                            className={`mt-2 text-xl font-semibold ${getResultAmountClass(
                              freebetResultAmount,
                            )}`}
                          >
                            {formatProcedureCurrency(freebetResultAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-white/10 bg-white/4 p-1">
                    <div className="grid grid-cols-2 gap-1">
                      {PROCEDURE_STATUS_OPTIONS.map((status) => (
                        <button
                          className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                            procedureStatus === status
                              ? "lz-button-primary"
                              : "text-[var(--text-secondary)]"
                          }`}
                          key={status}
                          onClick={() => setProcedureStatus(status)}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-[26px] border border-white/10 bg-white/4 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-sm">
                      <span className="font-medium text-white">
                        {selectedGroup === "expenses" ? "Casa/Cassino" : "Casa"}
                      </span>
                      <button
                        className="lz-button-secondary w-full rounded-2xl px-3 py-3 text-left"
                        onClick={() =>
                          setHousePickerTarget({ section: "main", index: 0 })
                        }
                        type="button"
                      >
                        {selectedHouses[0] || "Escolher casa"}
                      </button>
                    </div>

                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-white">
                        {selectedGroup === "expenses"
                          ? "Valor gasto"
                          : casinoResultInputLabel}
                      </span>
                      <input
                        className="lz-input w-full rounded-2xl px-3 py-3"
                        onChange={(event) => setEntryProfitValue(event.target.value)}
                        placeholder="0,00"
                        step="0.01"
                        type="number"
                        value={entryProfitValue}
                      />
                    </label>

                    <label className="space-y-2 text-sm md:col-span-2">
                      <span className="font-medium text-white">
                        {selectedGroup === "expenses" ? "Categoria/descrição" : "Descrição"}
                      </span>
                      <input
                        className="lz-input w-full rounded-2xl px-3 py-3"
                        name="game"
                        onChange={(event) => setGameValue(event.target.value)}
                        placeholder={
                          selectedGroup === "expenses"
                            ? "Ex.: depósito, taxa, compra"
                            : "Ex.: missão semanal, giros, método"
                        }
                        type="text"
                        value={gameValue}
                      />
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/4 p-1">
                    <div className="grid grid-cols-2 gap-1">
                      {PROCEDURE_STATUS_OPTIONS.map((status) => (
                        <button
                          className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                            procedureStatus === status
                              ? "lz-button-primary"
                              : "text-[var(--text-secondary)]"
                          }`}
                          key={status}
                          onClick={() => setProcedureStatus(status)}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  aria-label="Copiar link do procedimento"
                  className="lz-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full p-0"
                  onClick={handleCopyProcedure}
                  title="Copiar link"
                  type="button"
                >
                  <CopyIcon />
                </button>
                <button
                  className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-medium"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <FormSubmitButton
                  className="lz-button-primary rounded-full px-5 py-2.5 text-sm font-semibold"
                  pendingLabel={mode === "edit" ? "Salvando..." : "Criando..."}
                >
                  {submitLabel}
                </FormSubmitButton>
              </div>
            </form>
          </div>
          </div>

          <HousePickerDialog
            onClear={() => {
              if (!housePickerTarget) {
                return;
              }

              if (housePickerTarget.section === "collection") {
                clearCollectionHouseAtIndex(housePickerTarget.index);
              } else {
                clearSelectedHouseAtIndex(housePickerTarget.index);
              }
            }}
            onClose={() => setHousePickerTarget(null)}
            onToggle={(value) => {
              if (!housePickerTarget) {
                return;
              }

              if (housePickerTarget.section === "collection") {
                setCollectionHouseAtIndex(housePickerTarget.index, value);
              } else {
                setSelectedHouseAtIndex(housePickerTarget.index, value);
              }
            }}
            open={housePickerTarget !== null}
            options={bookmakers}
            selectedValues={
              selectedHousePickerValue ? [selectedHousePickerValue] : []
            }
            title="Escolher casa"
          />

          <HousePickerDialog
            onClear={clearSelectedFreebetHouse}
            onClose={() => setFreebetHousePickerOpen(false)}
            onToggle={toggleSelectedFreebetHouse}
            open={freebetHousePickerOpen}
            options={bookmakers}
            selectedValues={selectedFreebetHouse ? [selectedFreebetHouse] : []}
            title="Escolher casa da freebet"
          />
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
