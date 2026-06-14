"use client";

import {
  calculateSurebet,
  FREEBET_CONDITIONS,
  FREEBET_CONDITION_CONVERSION_ONLY,
  FREEBET_CONDITION_LOSS_ONLY,
  PROCEDURE_TYPES,
} from "@/core";
import { Plus, RotateCcw, Search, Settings } from "lucide-react";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from "react";
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
import {
  type ProcedureShareEntryDetail,
  type ProcedureShareResultDetail,
  type ProcedureShareValues,
} from "./procedure-share-types";
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
  increase: string;
  cashback: string;
  freebet: boolean;
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
  hideTypeSelector?: boolean;
  readOnly?: boolean;
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
    increase: draft.increase ?? "",
    cashback: draft.cashback ?? "",
    freebet: Boolean(draft.freebet),
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

function formatDecimalDisplay(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return "";
  }

  return value.toFixed(fractionDigits).replace(".", ",");
}

function calculateAdjustedOdd(odd: number, increase: number) {
  if (odd <= 1) {
    return odd;
  }

  return 1 + (odd - 1) * (1 + increase / 100);
}

function calculateLayReturn(
  responsibility: number,
  effectiveOdd: number,
  commission: number,
  cashback: number,
) {
  if (responsibility <= 0 || effectiveOdd <= 1) {
    return 0;
  }

  const layStake = responsibility / (effectiveOdd - 1);
  const commissionMultiplier = 1 - commission / 100;
  const cashbackRate = cashback / 100;

  return (
    layStake *
    (effectiveOdd - 1 + commissionMultiplier - (effectiveOdd - 1) * cashbackRate)
  );
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
    increaseInput?: string;
    cashbackInput?: string;
    freebet?: boolean;
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
    const increase = parseDecimalInput(entry.increaseInput ?? "");
    const cashback = parseDecimalInput(entry.cashbackInput ?? "");
    const effectiveOdd = calculateAdjustedOdd(odd, increase);
    const stake =
      side === "lay" && effectiveOdd > 1
        ? riskValue / (effectiveOdd - 1)
        : riskValue;

    return {
      ...entry,
      side,
      stake,
      responsibility: side === "lay" ? riskValue : 0,
      odd,
      effectiveOdd,
      commission: parseDecimalInput(entry.commissionInput ?? ""),
      increase,
      cashback,
      freebet: Boolean(entry.freebet),
    };
  });
  
  const baseIndex = normalizedEntries.findIndex((entry) => entry.stake > 0);
  const fallbackInvestment = normalizedEntries.reduce(
    (sum, entry) =>
      sum +
      (entry.side === "lay" ? entry.responsibility : entry.freebet ? 0 : entry.stake),
    0,
  );

  let investment = fallbackInvestment;
  let returnByIndex = new Map<number, number>();

  if (baseIndex >= 0) {
    try {
      const calculation = calculateSurebet(
        normalizedEntries.map((entry) => ({
          odd: entry.odd,
          stake: entry.stake,
          tipo: entry.side === "lay" ? "L" : "B",
          responsabilidade: entry.responsibility,
          aumento_percentual: entry.increase,
          comissao_percentual: entry.commission,
          cashback_percentual: entry.cashback,
          freebet: entry.freebet,
        })),
        baseIndex,
      );

      investment = Number(calculation?.investimento_efetivo ?? fallbackInvestment);
      
      returnByIndex = new Map(
        normalizedEntries.map((_, index) => {
          const lucroLiquido = Number(calculation?.linhas?.[index]?.lucro_liquido ?? 0);

          return [index, lucroLiquido + investment]; 
        }),
      );
    } catch {
      returnByIndex = new Map(
        normalizedEntries.map((entry, index) => {
          const layReturn = calculateLayReturn(
            entry.responsibility,
            entry.effectiveOdd,
            entry.commission,
            entry.cashback,
          );
          const backReturn = entry.freebet
            ? entry.stake *
              ((entry.effectiveOdd - 1) * (1 - entry.commission / 100))
            : entry.stake *
              (1 +
                (entry.effectiveOdd - 1) * (1 - entry.commission / 100) -
                entry.cashback / 100);

          return [index, entry.side === "lay" ? layReturn : backReturn];
        }),
      );
    }
  } else {
    returnByIndex = new Map(
      normalizedEntries.map((entry, index) => {
        const layReturn = calculateLayReturn(
          entry.responsibility,
          entry.effectiveOdd,
          entry.commission,
          entry.cashback,
        );
        const backReturn = entry.freebet
          ? entry.stake *
            ((entry.effectiveOdd - 1) * (1 - entry.commission / 100))
          : entry.stake *
            (1 +
              (entry.effectiveOdd - 1) * (1 - entry.commission / 100) -
              entry.cashback / 100);

        return [index, entry.side === "lay" ? layReturn : backReturn];
      }),
    );
  }

  if (selectedResults.length === 0) {
    return 0;
  }

  const selectedResultSet = new Set(selectedResults);
  const selectedReturns = normalizedEntries
    .map((entry, index) =>
      selectedResultSet.has(entry.resultId) ? (returnByIndex.get(index) ?? 0) : null,
    )
    .filter((value): value is number => value !== null);

  if (selectedReturns.length === 0) {

    return selectedResultSet.has("defeat") ? -investment : 0;
  }


  const totalGrossReturn = selectedReturns.reduce(
    (sum, returnVal) => sum + returnVal,
    0,
  );


  return normalizeCurrencyAmount(totalGrossReturn - investment);
}

function getSportCardClass(selected: boolean) {
  return `min-w-0 rounded-[24px] border p-3 transition sm:p-4 ${
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

function getInitialCollectionProtectionDrafts(
  defaultValues: ProcedureModalProps["defaultValues"],
  procedureType: string,
) {
  if (defaultValues?.collectionProtections?.length) {
    return defaultValues.collectionProtections;
  }

  if (isFreebetProcedureType(procedureType)) {
    return defaultValues?.sportProtections;
  }

  return undefined;
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
        increase: draft.increase,
        cashback: draft.cashback,
        freebet: draft.freebet,
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
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]"
            />
            <input
              className="lz-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar casa..."
              type="search"
              value={search}
            />
          </div>

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
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-white"
              onClick={() => {
                setSearch("");
                onClear();
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar</span>
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
  hideTypeSelector = false,
  readOnly = false,
  defaultValues,
}: ProcedureModalProps) {
  const { showToast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const protectionKeyRef = useRef(1000);
  const collectionProtectionKeyRef = useRef(2000);
  const initialProcedureGroup = getProcedureGroupFromType(defaultValues?.procedureType);
  const initialProcedureType = getInitialProcedureType(defaultValues, typeOptions);
  const initialFreebetValueInput =
    defaultValues?.freebetValue === undefined
      ? ""
      : String(defaultValues.freebetValue);
  const initialFreebetCondition =
    defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0] ?? "";
  const initialFreebetCollectionBlocked =
    initialFreebetCondition === FREEBET_CONDITION_CONVERSION_ONLY;
  const initialProtectionKeys = getInitialProtectionKeys(
    defaultValues,
    initialProcedureType,
  );
  const initialCollectionProtectionKeys = getInitialCollectionProtectionKeys(
    defaultValues,
    initialProcedureType,
  );
  const initialSelectedHouses =
    defaultValues?.selectedHouses ?? parseHouseList(defaultValues?.houses);
  const initialCollectionHouses =
    defaultValues?.collectionHouses ??
    (isFreebetProcedureType(initialProcedureType) ? initialSelectedHouses : []);
  const usesDefaultTypeOptions = typeOptions === PROCEDURE_TYPES;
  const [selectedType, setSelectedType] = useState<ProcedureType>(
    initialProcedureType,
  );
  const [customProcedureType, setCustomProcedureType] = useState(
    defaultValues?.procedureType &&
      !getDefaultProcedureOptions(initialProcedureGroup, typeOptions).some(
        (option) => option.value === defaultValues.procedureType,
      )
      ? defaultValues.procedureType
      : "",
  );
  const [selectedGroup, setSelectedGroup] =
    useState<ProcedureGroup>(initialProcedureGroup);
  const [operationDate, setOperationDate] = useState(
    defaultValues?.operationDate ?? getTodayInputValue(),
  );
  const [collectionDate, setCollectionDate] = useState(
    defaultValues?.collectionDate ??
      (isFreebetProcedureType(initialProcedureType)
        ? (defaultValues?.operationDate ?? "")
        : ""),
  );
  const [conversionDate, setConversionDate] = useState(
    defaultValues?.conversionDate ??
      (initialProcedureType === FREEBET_CONVERSION_TYPE
        ? (defaultValues?.operationDate ?? "")
        : ""),
  );
  const [gameValue, setGameValue] = useState(
    defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""),
  );
  const [collectionGameValue, setCollectionGameValue] = useState(
    defaultValues?.collectionGame ??
      (isFreebetProcedureType(initialProcedureType)
        ? (defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""))
        : ""),
  );
  const [conversionGameValue, setConversionGameValue] = useState(
    defaultValues?.conversionGame ??
      (isFreebetProcedureType(initialProcedureType) &&
      defaultValues?.freebetVisibleScope === "conversion"
        ? (defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""))
        : ""),
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
  const [primaryIncrease, setPrimaryIncrease] = useState(
    defaultValues?.primaryIncrease ?? "",
  );
  const [primaryCashback, setPrimaryCashback] = useState(
    defaultValues?.primaryCashback ?? "",
  );
  const [primaryFreebet, setPrimaryFreebet] = useState(
    Boolean(defaultValues?.primaryFreebet),
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
  const [collectionPrimaryIncrease, setCollectionPrimaryIncrease] =
    useState(defaultValues?.collectionPrimaryIncrease ?? "");
  const [collectionPrimaryCashback, setCollectionPrimaryCashback] =
    useState(defaultValues?.collectionPrimaryCashback ?? "");
  const [collectionPrimaryFreebet, setCollectionPrimaryFreebet] = useState(
    Boolean(defaultValues?.collectionPrimaryFreebet),
  );
  const [protectionDrafts, setProtectionDrafts] = useState<
    Record<number, ProtectionDraft>
  >(createProtectionDraftRecord(initialProtectionKeys, defaultValues?.sportProtections));
  const [collectionProtectionDrafts, setCollectionProtectionDrafts] = useState<
    Record<number, ProtectionDraft>
  >(
    createProtectionDraftRecord(
      initialCollectionProtectionKeys,
      getInitialCollectionProtectionDrafts(defaultValues, initialProcedureType),
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
    initialSelectedHouses,
  );
  const [collectionHouses, setCollectionHouses] = useState<string[]>(
    initialCollectionHouses,
  );
  const [selectedFreebetHouse, setSelectedFreebetHouse] = useState(
    defaultValues?.selectedFreebetHouse ?? defaultValues?.freebetHouse ?? "",
  );
  const [freebetValueInput, setFreebetValueInput] = useState(
    initialFreebetValueInput,
  );
  const [freebetConditionValue, setFreebetConditionValue] = useState(
    initialFreebetCondition,
  );
  const [freebetCollectionOpen, setFreebetCollectionOpen] = useState(
    Boolean(defaultValues?.freebetCollectionOpen) &&
      !initialFreebetCollectionBlocked,
  );
  const [freebetConversionOpen, setFreebetConversionOpen] = useState(
    Boolean(defaultValues?.freebetConversionOpen),
  );
  const [sportsConfigOpen, setSportsConfigOpen] = useState<
    Record<string, boolean>
  >({});
  const [housePickerTarget, setHousePickerTarget] =
    useState<HousePickerTarget | null>(null);
  const [freebetHousePickerOpen, setFreebetHousePickerOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const isReadOnly = readOnly;
  const visibleGroups = isReadOnly
    ? PROCEDURE_GROUPS.filter((group) => group.id === selectedGroup)
    : usesDefaultTypeOptions
    ? PROCEDURE_GROUPS
    : PROCEDURE_GROUPS.filter((group) => group.id === selectedGroup);
  const defaultProcedureOptions = getDefaultProcedureOptions(
    selectedGroup,
    typeOptions,
  );
  const selectedProcedureOption = defaultProcedureOptions.find((option) =>
    isFreebetProcedureType(option.value) && isFreebetProcedureType(selectedType)
      ? true
      : option.value === selectedType,
  );
  const visibleProcedureOptions = isReadOnly
    ? [
        {
          value: selectedType,
          label: selectedProcedureOption?.label ?? selectedType,
        },
      ]
    : defaultProcedureOptions;
  const isNormalBet = selectedType === "Apostas Normais";
  const isFreebetType = isFreebetProcedureType(selectedType);
  const isConversionOnly =
    typeOptions.length === 1 && typeOptions[0] === FREEBET_CONVERSION_TYPE;
  const supportsGame = selectedGroup === "sports";
  const supportsProfitDistribution = selectedGroup === "sports";
  const showFreebetBeforeHouses = isFreebetType;
  const freebetVisibleScope = defaultValues?.freebetVisibleScope ?? "all";
  const showFreebetCollectionSection =
    showFreebetBeforeHouses && freebetVisibleScope !== "conversion";
  const showFreebetConversionSection =
    !isFreebetType || freebetVisibleScope !== "collection";
  const freebetCollectionBlocked =
    isFreebetType &&
    freebetConditionValue === FREEBET_CONDITION_CONVERSION_ONLY;
  const freebetConversionBlocked =
    isFreebetType &&
    freebetConditionValue === FREEBET_CONDITION_LOSS_ONLY &&
    collectionResultSelections.includes("principal");
  const freebetCollectionExpanded =
    freebetCollectionOpen && !freebetCollectionBlocked;
  const freebetConversionExpanded =
    freebetConversionOpen && !freebetConversionBlocked;
  const collectionDateForSubmit =
    freebetCollectionBlocked
      ? ""
      : collectionDate ||
        (collectionResultSelections.length > 0 ? operationDate : "");
  const conversionDateForSubmit =
    freebetConversionBlocked
      ? ""
      : conversionDate || (sportResultSelections.length > 0 ? operationDate : "");
  const operationDateForSubmit = isFreebetType
    ? collectionDateForSubmit || conversionDateForSubmit || operationDate
    : operationDate;
  const freebetGameForSubmit =
    freebetVisibleScope === "conversion"
      ? conversionGameValue || collectionGameValue
      : collectionGameValue || conversionGameValue;
  const sportEntries = [
    {
      resultId: "principal" as SportResultSelection,
      stakeInput: primaryStake,
      oddInput: primaryOdd,
      side: primarySide,
      layOddInput: primaryLayOdd,
      commissionInput: primaryCommission,
      increaseInput: primaryIncrease,
      cashbackInput: primaryCashback,
      freebet: primaryFreebet,
    },
    ...protectionKeys.map((key) => ({
      resultId: getProtectionResultId(key),
      stakeInput: protectionDrafts[key]?.stake ?? "",
      oddInput: protectionDrafts[key]?.odd ?? "",
      side: protectionDrafts[key]?.side ?? DEFAULT_BET_SIDE,
      layOddInput: protectionDrafts[key]?.layOdd ?? "",
      commissionInput: protectionDrafts[key]?.commission ?? "",
      increaseInput: protectionDrafts[key]?.increase ?? "",
      cashbackInput: protectionDrafts[key]?.cashback ?? "",
      freebet: Boolean(protectionDrafts[key]?.freebet),
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
      increaseInput: collectionPrimaryIncrease,
      cashbackInput: collectionPrimaryCashback,
      freebet: collectionPrimaryFreebet,
    },
    ...collectionProtectionKeys.map((key) => ({
      resultId: getProtectionResultId(key),
      stakeInput: collectionProtectionDrafts[key]?.stake ?? "",
      oddInput: collectionProtectionDrafts[key]?.odd ?? "",
      side: collectionProtectionDrafts[key]?.side ?? DEFAULT_BET_SIDE,
      layOddInput: collectionProtectionDrafts[key]?.layOdd ?? "",
      commissionInput: collectionProtectionDrafts[key]?.commission ?? "",
      increaseInput: collectionProtectionDrafts[key]?.increase ?? "",
      cashbackInput: collectionProtectionDrafts[key]?.cashback ?? "",
      freebet: Boolean(collectionProtectionDrafts[key]?.freebet),
    })),
  ];
  const hasSportsCalculationInput =
    primaryStake.trim() !== "" ||
    primaryOdd.trim() !== "" ||
    primaryLayOdd.trim() !== "" ||
    primaryCommission.trim() !== "" ||
    primaryIncrease.trim() !== "" ||
    primaryCashback.trim() !== "" ||
    primaryFreebet ||
    primarySide === "lay" ||
    Object.values(protectionDrafts).some(
      (draft) =>
        draft.stake.trim() !== "" ||
        draft.odd.trim() !== "" ||
        draft.layOdd.trim() !== "" ||
        draft.commission.trim() !== "" ||
        draft.increase.trim() !== "" ||
        draft.cashback.trim() !== "" ||
        draft.freebet ||
        draft.side === "lay",
    ) ||
    sportResultSelections.length > 0;
  const hasCollectionCalculationInput =
    collectionPrimaryStake.trim() !== "" ||
    collectionPrimaryOdd.trim() !== "" ||
    collectionPrimaryLayOdd.trim() !== "" ||
    collectionPrimaryCommission.trim() !== "" ||
    collectionPrimaryIncrease.trim() !== "" ||
    collectionPrimaryCashback.trim() !== "" ||
    collectionPrimaryFreebet ||
    collectionPrimarySide === "lay" ||
    Object.values(collectionProtectionDrafts).some(
      (draft) =>
        draft.stake.trim() !== "" ||
        draft.odd.trim() !== "" ||
        draft.layOdd.trim() !== "" ||
        draft.commission.trim() !== "" ||
        draft.increase.trim() !== "" ||
        draft.cashback.trim() !== "" ||
        draft.freebet ||
        draft.side === "lay",
    ) ||
    collectionResultSelections.length > 0;
  const calculatedSportsProfit = calculateSportsProfit(
    sportEntries,
    sportResultSelections,
  );
  const calculatedCollectionProfit = freebetCollectionBlocked
    ? 0
    : calculateSportsProfit(collectionEntries, collectionResultSelections);
  const sportsResultAmount = normalizeCurrencyAmount(
    hasSportsCalculationInput
      ? calculatedSportsProfit
      : parseDecimalInput(entryProfitValue),
  );
  const collectionResultAmount = normalizeCurrencyAmount(
    !freebetCollectionBlocked && hasCollectionCalculationInput
      ? calculatedCollectionProfit
      : 0,
  );
  const freebetCollectionResultAmount = collectionResultAmount;
  const freebetConversionResultAmount = normalizeCurrencyAmount(
    !freebetConversionBlocked && hasSportsCalculationInput ? sportsResultAmount : 0,
  );
  const freebetResultAmount = normalizeCurrencyAmount(
    (!freebetConversionBlocked && hasSportsCalculationInput) ||
      (!freebetCollectionBlocked && hasCollectionCalculationInput)
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
  const submittedHouses =
    selectedGroup === "expenses"
      ? ""
      : (isFreebetType
          ? [
              ...(freebetCollectionBlocked ? [] : collectionHouses.slice(1)),
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

  useEffect(() => {
    if (!isReadOnly || !open) {
      return;
    }

    const form = formRef.current;

    if (!form) {
      return;
    }

    const controls = Array.from(
      form.querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("button, input, select, textarea"),
    );
    const previousDisabled = new Map<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
      boolean
    >();

    controls.forEach((control) => {
      if (control.closest("[data-readonly-allowed='true']")) {
        return;
      }

      previousDisabled.set(control, control.disabled);
      control.disabled = true;
    });

    return () => {
      previousDisabled.forEach((wasDisabled, control) => {
        control.disabled = wasDisabled;
      });
    };
  }, [
    collectionProtectionKeys,
    freebetCollectionExpanded,
    freebetConversionExpanded,
    isReadOnly,
    open,
    protectionKeys,
    selectedType,
  ]);
  const procedureDetailsPayload = getProcedureDetailsPayload();
  const procedureDetailsValue = JSON.stringify(procedureDetailsPayload);

  function buildEntryDetail({
    scope,
    role,
    order,
    resultKey,
    house,
    stake,
    odd,
    side,
    layOdd,
    commission,
    increase,
    cashback,
    freebet,
    operationDate: detailOperationDate,
  }: {
    scope: ProcedureShareEntryDetail["scope"];
    role: ProcedureShareEntryDetail["role"];
    order: number;
    resultKey: string;
    house?: string;
    stake: string;
    odd: string;
    side: BetSide;
    layOdd: string;
    commission: string;
    increase: string;
    cashback: string;
    freebet: boolean;
    operationDate?: string;
  }): ProcedureShareEntryDetail {
    return {
      scope,
      role,
      order,
      resultKey,
      house: house ?? "",
      value: parseDecimalInput(stake),
      odd: parseDecimalInput(odd),
      side,
      layOdd: parseDecimalInput(layOdd),
      commission: parseDecimalInput(commission),
      increase: parseDecimalInput(increase),
      cashback: parseDecimalInput(cashback),
      freebet,
      operationDate: detailOperationDate ?? "",
    };
  }

  function buildResultDetails(
    scope: ProcedureShareResultDetail["scope"],
    selections: SportResultSelection[],
    keys: number[],
  ): ProcedureShareResultDetail[] {
    if (selections.includes("defeat")) {
      return [{ scope, resultKey: "defeat" }];
    }

    const results: ProcedureShareResultDetail[] = [];

    if (selections.includes("principal")) {
      results.push({ scope, resultKey: "principal" });
    }

    keys.forEach((key, index) => {
      if (selections.includes(getProtectionResultId(key))) {
        results.push({ scope, resultKey: getProtectionResultId(index) });
      }
    });

    return results;
  }

  function buildSportEntryDetails({
    scope,
    includePrimaryHouse,
    houses,
    primary,
    protections,
    operationDate: detailOperationDate,
  }: {
    scope: ProcedureShareEntryDetail["scope"];
    includePrimaryHouse: boolean;
    houses: string[];
    primary: {
      stake: string;
      odd: string;
      side: BetSide;
      layOdd: string;
      commission: string;
      increase: string;
      cashback: string;
      freebet: boolean;
    };
    protections: Array<{
      key: number;
      draft: ProtectionDraft;
    }>;
    operationDate?: string;
  }) {
    return [
      buildEntryDetail({
        scope,
        role: "principal",
        order: 0,
        resultKey: "principal",
        house: includePrimaryHouse ? (houses[0] ?? "") : "",
        stake: primary.stake,
        odd: primary.odd,
        side: primary.side,
        layOdd: primary.layOdd,
        commission: primary.commission,
        increase: primary.increase,
        cashback: primary.cashback,
        freebet: primary.freebet,
        operationDate: detailOperationDate,
      }),
      ...protections.map(({ draft }, index) =>
        buildEntryDetail({
          scope,
          role: "protecao",
          order: index,
          resultKey: getProtectionResultId(index),
          house: houses[index + 1] ?? "",
          stake: draft.stake,
          odd: draft.odd,
          side: draft.side,
          layOdd: draft.layOdd,
          commission: draft.commission,
          increase: draft.increase,
          cashback: draft.cashback,
          freebet: draft.freebet,
          operationDate: detailOperationDate,
        }),
      ),
    ];
  }

  function getProcedureDetailsPayload(): {
    entries: ProcedureShareEntryDetail[];
    results: ProcedureShareResultDetail[];
  } {
    if (selectedGroup !== "sports") {
      return {
        entries: [
          buildEntryDetail({
            scope: "sports",
            role: "principal",
            order: 0,
            resultKey: "principal",
            house: selectedGroup === "casino" ? (selectedHouses[0] ?? "") : "",
            stake: entryValueForSubmit,
            odd: "1",
            side: DEFAULT_BET_SIDE,
            layOdd: "",
            commission: "",
            increase: "",
            cashback: "",
            freebet: false,
            operationDate: operationDateForSubmit,
          }),
        ],
        results: procedureStatus === "Conclu\u00eddo"
          ? [{ scope: "sports", resultKey: "principal" }]
          : [],
      };
    }

    if (!isFreebetType) {
      return {
        entries: buildSportEntryDetails({
          scope: "sports",
          includePrimaryHouse: true,
          houses: selectedHouses,
          primary: {
            stake: primaryStake,
            odd: primaryOdd,
            side: primarySide,
            layOdd: primaryLayOdd,
            commission: primaryCommission,
            increase: primaryIncrease,
            cashback: primaryCashback,
            freebet: primaryFreebet,
          },
          protections: (isNormalBet ? [] : protectionKeys).map((key) => ({
            key,
            draft: createProtectionDraft(protectionDrafts[key]),
          })),
          operationDate: operationDateForSubmit,
        }),
        results: buildResultDetails(
          "sports",
          sportResultSelections,
          isNormalBet ? [] : protectionKeys,
        ),
      };
    }

    const conversionEntries = freebetConversionBlocked
      ? []
      : buildSportEntryDetails({
          scope: "freebet_conversion",
          includePrimaryHouse: false,
          houses: selectedHouses,
          primary: {
            stake: primaryStake,
            odd: primaryOdd,
            side: primarySide,
            layOdd: primaryLayOdd,
            commission: primaryCommission,
            increase: primaryIncrease,
            cashback: primaryCashback,
            freebet: primaryFreebet,
          },
          protections: protectionKeys.map((key) => ({
            key,
            draft: createProtectionDraft(protectionDrafts[key]),
          })),
          operationDate: conversionDateForSubmit,
        });
    const conversionResults = freebetConversionBlocked
      ? []
      : buildResultDetails(
          "freebet_conversion",
          sportResultSelections,
          protectionKeys,
        );
    const collectionEntriesForSubmit = freebetCollectionBlocked
      ? []
      : buildSportEntryDetails({
          scope: "freebet_collection",
          includePrimaryHouse: true,
          houses: [selectedFreebetHouse, ...collectionHouses.slice(1)],
          primary: {
            stake: collectionPrimaryStake,
            odd: collectionPrimaryOdd,
            side: collectionPrimarySide,
            layOdd: collectionPrimaryLayOdd,
            commission: collectionPrimaryCommission,
            increase: collectionPrimaryIncrease,
            cashback: collectionPrimaryCashback,
            freebet: collectionPrimaryFreebet,
          },
          protections: collectionProtectionKeys.map((key) => ({
            key,
            draft: createProtectionDraft(collectionProtectionDrafts[key]),
          })),
          operationDate: collectionDateForSubmit,
        });
    const collectionResultsForSubmit = freebetCollectionBlocked
      ? []
      : buildResultDetails(
          "freebet_collection",
          collectionResultSelections,
          collectionProtectionKeys,
        );

    return {
      entries: [
        ...collectionEntriesForSubmit,
        ...conversionEntries,
      ],
      results: [...collectionResultsForSubmit, ...conversionResults],
    };
  }

  function getProcedureSharePayload(): ProcedureShareValues {
    const resultAmount =
      selectedGroup === "sports"
        ? isFreebetType
          ? freebetResultAmount
          : sportsResultAmount
        : entryProfitAmount;
    const housesText =
      selectedGroup === "expenses"
        ? ""
        : submittedHouses || selectedHouses.filter(Boolean).join(", ");
    const shareSelectedHouses =
      selectedGroup === "expenses" ? [] : selectedHouses;
    const shareCollectionHouses =
      selectedGroup === "expenses" ? [] : collectionHouses;

    return {
      version: 1,
      procedureType: selectedType,
      operationDate: operationDateForSubmit,
      collectionDate: collectionDateForSubmit,
      conversionDate: conversionDateForSubmit,
      game: isFreebetType ? freebetGameForSubmit : gameValue,
      collectionGame: isFreebetType ? collectionGameValue : "",
      conversionGame: isFreebetType ? conversionGameValue : "",
      conversionBatchId: defaultValues?.conversionBatchId,
      houses: housesText,
      entryValue: resultAmount,
      note: noteValue,
      freebetHouse: selectedFreebetHouse,
      freebetValue: parseDecimalInput(freebetValueInput),
      freebetCondition: freebetConditionValue,
      procedureStatus,
      selectedHouses: shareSelectedHouses,
      collectionHouses: shareCollectionHouses,
      selectedFreebetHouse,
      primaryStake,
      primaryOdd,
      primarySide,
      primaryLayOdd,
      primaryCommission,
      primaryIncrease,
      primaryCashback,
      primaryFreebet,
      sportProtections: (isNormalBet ? [] : protectionKeys).map((key) =>
        createProtectionDraft(protectionDrafts[key]),
      ),
      sportResultSelections: buildResultDetails(
        "sports",
        sportResultSelections,
        isNormalBet ? [] : protectionKeys,
      ).map((result) => result.resultKey),
      collectionPrimaryStake,
      collectionPrimaryOdd,
      collectionPrimarySide,
      collectionPrimaryLayOdd,
      collectionPrimaryCommission,
      collectionPrimaryIncrease,
      collectionPrimaryCashback,
      collectionPrimaryFreebet,
      collectionProtections: collectionProtectionKeys.map((key) =>
        createProtectionDraft(collectionProtectionDrafts[key]),
      ),
      collectionResultSelections: freebetCollectionBlocked
        ? []
        : buildResultDetails(
            "freebet_collection",
            collectionResultSelections,
            collectionProtectionKeys,
          ).map((result) => result.resultKey),
      freebetCollectionOpen: freebetCollectionOpen && !freebetCollectionBlocked,
      freebetConversionOpen,
      freebetVisibleScope,
      procedureEntries: procedureDetailsPayload.entries,
      procedureResults: procedureDetailsPayload.results,
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

  function handleFreebetConditionChange(value: string) {
    setFreebetConditionValue(value);

    if (value === FREEBET_CONDITION_CONVERSION_ONLY) {
      setFreebetCollectionOpen(false);
      setFreebetConversionOpen(true);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isFreebetType && !selectedFreebetHouse.trim()) {
      event.preventDefault();
      setFreebetHousePickerOpen(true);
      showToast({
        title: "Informe a casa da freebet.",
        tone: "error",
      });
    }
  }

  function isReadOnlyInteractionAllowed(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(target.closest("[data-readonly-allowed='true']"))
    );
  }

  function handleReadOnlyFormInteraction(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    if (!isReadOnly || isReadOnlyInteractionAllowed(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }

    handleSubmit(event);
  }

  function renderSportsBetFields({
    stakeName,
    oddName,
    stakeValue,
    oddValue,
    side,
    layOddValue,
    commissionValue,
    increaseValue,
    cashbackValue,
    freebetChecked,
    configOpen,
    onStakeChange,
    onOddChange,
    onToggleSide,
    onLayOddChange,
    onCommissionChange,
    onIncreaseChange,
    onCashbackChange,
    onFreebetChange,
    onToggleConfig,
  }: {
    stakeName: string;
    oddName: string;
    stakeValue: string;
    oddValue: string;
    side: BetSide;
    layOddValue: string;
    commissionValue: string;
    increaseValue: string;
    cashbackValue: string;
    freebetChecked: boolean;
    configOpen: boolean;
    onStakeChange: (value: string) => void;
    onOddChange: (value: string) => void;
    onToggleSide: () => void;
    onLayOddChange: (value: string) => void;
    onCommissionChange: (value: string) => void;
    onIncreaseChange: (value: string) => void;
    onCashbackChange: (value: string) => void;
    onFreebetChange: (checked: boolean) => void;
    onToggleConfig: () => void;
  }) {
    const isLay = side === "lay";
    const displayedOddValue = isLay ? (layOddValue || oddValue) : oddValue;
    const responsibilityValue = stakeValue;
    const layOddNumber = parseDecimalInput(displayedOddValue);
    const responsibilityNumber = parseDecimalInput(responsibilityValue);
    const displayedLayStake =
      isLay && layOddNumber > 1
        ? formatDecimalDisplay(responsibilityNumber / (layOddNumber - 1))
        : "";
    const hasCustomConfig =
      parseDecimalInput(increaseValue) !== 0 ||
      parseDecimalInput(commissionValue) !== 0 ||
      parseDecimalInput(cashbackValue) !== 0 ||
      freebetChecked;
    const configFieldClass =
      "flex min-h-[84px] flex-col justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm";

    return (
      <>
        {isLay ? (
          <label className="min-w-0 space-y-2 text-sm sm:col-span-2">
            <span className="block text-[var(--text-muted)]">
              Responsabilidade
            </span>
            <input
              className="lz-input w-full rounded-2xl px-3 py-3"
              inputMode="decimal"
              name={stakeName}
              onChange={(event) => onStakeChange(event.target.value)}
              placeholder="0,00"
              value={responsibilityValue}
            />
          </label>
        ) : (
          <label className="min-w-0 space-y-2 text-sm">
            <span className="block text-[var(--text-muted)]">Stake</span>
            <input
              className="lz-input w-full rounded-2xl px-3 py-3"
              inputMode="decimal"
              name={stakeName}
              onChange={(event) => onStakeChange(event.target.value)}
              placeholder="0,00"
              value={stakeValue}
            />
          </label>
        )}

        <div className="min-w-0 space-y-2 text-sm">
          <span className="block text-[var(--text-muted)]">
            {isLay ? "Stake" : "Odd"}
          </span>
          {isLay ? (
            <input
              className="lz-input min-w-0 w-full rounded-2xl px-3 py-3"
              inputMode="decimal"
              onChange={(event) => {
                const nextStake = parseDecimalInput(event.target.value);
                const effectiveOdd = parseDecimalInput(displayedOddValue);

                if (effectiveOdd > 1) {
                  onStakeChange(
                    formatDecimalDisplay(nextStake * (effectiveOdd - 1)),
                  );
                }
              }}
              placeholder="0,00"
              value={displayedLayStake}
            />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:grid-cols-[minmax(0,1fr)_48px_48px]">
              <input
                className="lz-input min-w-0 flex-1 rounded-2xl px-3 py-3"
                inputMode="decimal"
                name={oddName}
                onChange={(event) => onOddChange(event.target.value)}
                placeholder="0.000"
                value={displayedOddValue}
              />
              <button
                aria-label="Alternar para lay"
                className="lz-button-secondary rounded-2xl px-2 py-3 text-sm font-bold transition sm:px-3"
                onClick={onToggleSide}
                title="Back"
                type="button"
              >
                B
              </button>
              <button
                aria-expanded={configOpen}
                aria-label="ConfiguraÃ§Ãµes da entrada"
                className={`inline-flex items-center justify-center rounded-2xl border px-2 py-3 transition sm:px-3 ${
                  configOpen || hasCustomConfig
                    ? "border-[rgba(216,31,89,0.48)] bg-[rgba(216,31,89,0.16)] text-white"
                    : "border-white/10 bg-white/4 text-[var(--text-dim)] hover:border-white/20 hover:text-white"
                }`}
                onClick={onToggleConfig}
                title="ConfiguraÃ§Ãµes"
                type="button"
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={1.7} />
              </button>
            </div>
          )}
        </div>

        {isLay ? (
          <div className="min-w-0 space-y-2 text-sm">
            <span className="block text-[var(--text-muted)]">Odd Lay</span>
            <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2 sm:grid-cols-[minmax(0,1fr)_48px_48px]">
              <input
                className="lz-input min-w-0 w-full rounded-2xl px-3 py-3"
                inputMode="decimal"
                name={oddName}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  onLayOddChange(nextValue);

                  if (!oddValue.trim()) {
                    onOddChange(nextValue);
                  }
                }}
                placeholder="0.000"
                value={displayedOddValue}
              />
              <button
                aria-label="Alternar para back"
                className="rounded-2xl border border-[rgba(216,31,89,0.48)] bg-[rgba(216,31,89,0.18)] px-2 py-3 text-sm font-bold text-white shadow-[0_12px_32px_rgba(216,31,89,0.16)] transition sm:px-3"
                onClick={onToggleSide}
                title="Lay"
                type="button"
              >
                L
              </button>
            <button
              aria-expanded={configOpen}
              aria-label="Configurações da entrada"
              className={`inline-flex items-center justify-center rounded-2xl border px-2 py-3 transition sm:px-3 ${
                configOpen || hasCustomConfig
                  ? "border-[rgba(216,31,89,0.48)] bg-[rgba(216,31,89,0.16)] text-white"
                  : "border-white/10 bg-white/4 text-[var(--text-dim)] hover:border-white/20 hover:text-white"
              }`}
              onClick={onToggleConfig}
              title="Configurações"
              type="button"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </div>
        </div>
        ) : null}

        {configOpen ? (
          <div className="grid min-w-0 items-stretch gap-3 sm:col-span-2 sm:grid-cols-2 2xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <label className={configFieldClass}>
              <span className="text-[var(--text-muted)]">Aumento (%)</span>
              <input
                className="lz-input w-full rounded-xl px-3 py-2 text-sm"
                inputMode="decimal"
                onChange={(event) => onIncreaseChange(event.target.value)}
                placeholder="0,00"
                value={increaseValue}
              />
            </label>

            <label className={configFieldClass}>
              <span className="text-[var(--text-muted)]">Comissão (%)</span>
              <input
                className="lz-input w-full rounded-xl px-3 py-2 text-sm"
                inputMode="decimal"
                onChange={(event) => onCommissionChange(event.target.value)}
                placeholder="0,00"
                value={commissionValue}
              />
            </label>

            <label className={configFieldClass}>
              <span className="text-[var(--text-muted)]">Cashback (%)</span>
              <input
                className="lz-input w-full rounded-xl px-3 py-2 text-sm"
                inputMode="decimal"
                onChange={(event) => onCashbackChange(event.target.value)}
                placeholder="0,00"
                value={cashbackValue}
              />
            </label>

            <label className="inline-flex min-h-[56px] items-center gap-2 px-1 text-sm text-[var(--text-muted)] 2xl:min-h-[84px] 2xl:min-w-28 2xl:justify-center">
              <input
                checked={freebetChecked}
                className="lz-checkbox"
                onChange={(event) => onFreebetChange(event.target.checked)}
                type="checkbox"
              />
              <span>Freebet</span>
            </label>
          </div>
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
    setPrimaryIncrease("");
    setPrimaryCashback("");
    setPrimaryFreebet(false);
    setProtectionDrafts({});
    setSportResultSelections([]);
    setSportsConfigOpen({});
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

  function moveSportsFieldsToCollection() {
    const nextCollectionKeys = protectionKeys.map(() =>
      getNextCollectionProtectionKey(),
    );
    const nextCollectionDrafts = nextCollectionKeys.reduce<
      Record<number, ProtectionDraft>
    >((record, nextKey, index) => {
      const sourceKey = protectionKeys[index];
      record[nextKey] = createProtectionDraft(protectionDrafts[sourceKey]);
      return record;
    }, {});

    setCollectionPrimaryStake(primaryStake);
    setCollectionPrimaryOdd(primaryOdd);
    setCollectionPrimarySide(primarySide);
    setCollectionPrimaryLayOdd(primaryLayOdd);
    setCollectionPrimaryCommission(primaryCommission);
    setCollectionPrimaryIncrease(primaryIncrease);
    setCollectionPrimaryCashback(primaryCashback);
    setCollectionPrimaryFreebet(primaryFreebet);
    setCollectionProtectionKeys(nextCollectionKeys);
    setCollectionProtectionDrafts(nextCollectionDrafts);
    setCollectionResultSelections([...sportResultSelections]);
    setCollectionHouses([...selectedHouses]);
    setCollectionDate((current) => current || operationDate);
    setCollectionGameValue((current) => current || gameValue);
    setFreebetCollectionOpen(true);
    resetSportsCalculationState();
    setProtectionKeys([]);
    setSelectedHouses([]);
  }

  function moveCollectionFieldsToSports() {
    const nextProtectionKeys = collectionProtectionKeys.map(() =>
      getNextProtectionKey(),
    );
    const nextProtectionDrafts = nextProtectionKeys.reduce<
      Record<number, ProtectionDraft>
    >((record, nextKey, index) => {
      const sourceKey = collectionProtectionKeys[index];
      record[nextKey] = createProtectionDraft(collectionProtectionDrafts[sourceKey]);
      return record;
    }, {});

    setPrimaryStake(collectionPrimaryStake);
    setPrimaryOdd(collectionPrimaryOdd);
    setPrimarySide(collectionPrimarySide);
    setPrimaryLayOdd(collectionPrimaryLayOdd);
    setPrimaryCommission(collectionPrimaryCommission);
    setPrimaryIncrease(collectionPrimaryIncrease);
    setPrimaryCashback(collectionPrimaryCashback);
    setPrimaryFreebet(collectionPrimaryFreebet);
    setProtectionKeys(nextProtectionKeys);
    setProtectionDrafts(nextProtectionDrafts);
    setSportResultSelections([...collectionResultSelections]);
    setSelectedHouses([...collectionHouses]);
    setGameValue((current) => current || collectionGameValue);
  }

  function selectProcedureGroup(group: ProcedureGroup) {
    if (group === selectedGroup) {
      return;
    }

    const nextOptions = getDefaultProcedureOptions(group, typeOptions);
    const nextType = nextOptions[0]?.value ?? selectedType;
    const nextIsFreebet = isFreebetProcedureType(nextType);
    const currentIsFreebet = isFreebetProcedureType(selectedType);

    setSelectedGroup(group);
    setSelectedType(nextType);
    setCustomProcedureType("");

    if (!currentIsFreebet && nextIsFreebet && hasSportsCalculationInput) {
      moveSportsFieldsToCollection();
    } else if (nextIsFreebet) {
      setFreebetCollectionOpen(true);
    }

    if (currentIsFreebet && !nextIsFreebet && !hasSportsCalculationInput) {
      moveCollectionFieldsToSports();
    }

    if (!nextIsFreebet) {
      setFreebetCollectionOpen(false);
      setFreebetConversionOpen(false);
    }

    if (group === "sports" && nextType !== "Apostas Normais" && protectionKeys.length === 0) {
      setProtectionKeys([getNextProtectionKey()]);
    }

    if (group === "sports" && nextIsFreebet && collectionProtectionKeys.length === 0) {
      setCollectionProtectionKeys([getNextCollectionProtectionKey()]);
    }
  }

  function selectProcedureType(type: string) {
    if (
      type === selectedType ||
      (isFreebetProcedureType(type) && isFreebetProcedureType(selectedType))
    ) {
      return;
    }

    const currentIsFreebet = isFreebetProcedureType(selectedType);
    const nextIsFreebet = isFreebetProcedureType(type);

    setSelectedType(type);
    setCustomProcedureType("");

    if (!currentIsFreebet && nextIsFreebet && hasSportsCalculationInput) {
      moveSportsFieldsToCollection();
    } else if (nextIsFreebet) {
      setFreebetCollectionOpen(true);
    }

    if (currentIsFreebet && !nextIsFreebet && !hasSportsCalculationInput) {
      moveCollectionFieldsToSports();
    }

    if (!nextIsFreebet) {
      setFreebetCollectionOpen(false);
      setFreebetConversionOpen(false);
    }

    if (type === "Apostas Normais" || selectedGroup !== "sports") {
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
    setSportsConfigOpen((current) => {
      const next = { ...current };
      delete next[`sports-protection-${key}`];
      return next;
    });
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
    setSportsConfigOpen((current) => {
      const next = { ...current };
      delete next[`collection-protection-${key}`];
      return next;
    });
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

  function toggleSportsConfig(key: string) {
    setSportsConfigOpen((current) => ({
      ...current,
      [key]: !current[key],
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
    const nextFreebetCondition =
      defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0] ?? "";
    const nextFreebetCollectionBlocked =
      nextFreebetCondition === FREEBET_CONDITION_CONVERSION_ONLY;
    const shouldSeedFreebetValue = isFreebetProcedureType(nextType);
    const nextProtectionKeys = getInitialProtectionKeys(defaultValues, nextType);
    const nextCollectionProtectionKeys = getInitialCollectionProtectionKeys(
      defaultValues,
      nextType,
    );
    const nextSelectedHouses =
      defaultValues?.selectedHouses ?? parseHouseList(defaultValues?.houses);
    const nextCollectionHouses =
      defaultValues?.collectionHouses ??
      (isFreebetProcedureType(nextType) ? nextSelectedHouses : []);

    setSelectedGroup(nextGroup);
    setSelectedType(nextType);
    setCustomProcedureType(
      defaultValues?.procedureType &&
        !getDefaultProcedureOptions(nextGroup, typeOptions).some(
          (option) => option.value === defaultValues.procedureType,
        )
        ? defaultValues.procedureType
        : "",
    );
    setOperationDate(defaultValues?.operationDate ?? getTodayInputValue());
    setCollectionDate(
      defaultValues?.collectionDate ??
        (isFreebetProcedureType(nextType) ? (defaultValues?.operationDate ?? "") : ""),
    );
    setConversionDate(
      defaultValues?.conversionDate ??
        (nextType === FREEBET_CONVERSION_TYPE
          ? (defaultValues?.operationDate ?? "")
          : ""),
    );
    setGameValue(defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""));
    setCollectionGameValue(
      defaultValues?.collectionGame ??
        (isFreebetProcedureType(nextType)
          ? (defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""))
          : ""),
    );
    setConversionGameValue(
      defaultValues?.conversionGame ??
        (isFreebetProcedureType(nextType) &&
        defaultValues?.freebetVisibleScope === "conversion"
          ? (defaultValues?.game === "-" ? "" : (defaultValues?.game ?? ""))
          : ""),
    );
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
    setPrimaryIncrease(defaultValues?.primaryIncrease ?? "");
    setPrimaryCashback(defaultValues?.primaryCashback ?? "");
    setPrimaryFreebet(Boolean(defaultValues?.primaryFreebet));
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
    setCollectionPrimaryIncrease(defaultValues?.collectionPrimaryIncrease ?? "");
    setCollectionPrimaryCashback(defaultValues?.collectionPrimaryCashback ?? "");
    setCollectionPrimaryFreebet(Boolean(defaultValues?.collectionPrimaryFreebet));
    setProtectionDrafts(
      createProtectionDraftRecord(
        nextProtectionKeys,
        defaultValues?.sportProtections,
      ),
    );
    setCollectionProtectionDrafts(
      createProtectionDraftRecord(
        nextCollectionProtectionKeys,
        getInitialCollectionProtectionDrafts(defaultValues, nextType),
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
    setSelectedHouses(nextSelectedHouses);
    setCollectionHouses(nextCollectionHouses);
    setSelectedFreebetHouse(
      defaultValues?.selectedFreebetHouse ?? defaultValues?.freebetHouse ?? "",
    );
    setFreebetValueInput(nextFreebetValue);
    setFreebetConditionValue(nextFreebetCondition);
    setFreebetCollectionOpen(
      Boolean(defaultValues?.freebetCollectionOpen) && !nextFreebetCollectionBlocked,
    );
    setFreebetConversionOpen(Boolean(defaultValues?.freebetConversionOpen));
    setSportsConfigOpen({});
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
          <span className="inline-flex items-center justify-center gap-2">
            {mode === "create" ? (
              <Plus aria-hidden="true" className="h-4 w-4" />
            ) : null}
            <span>{triggerLabel}</span>
          </span>
        </button>
      ) : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-black/65 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-full items-start justify-center py-2 md:py-4">
          <div className="lz-panel w-full max-w-7xl rounded-[26px] shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:rounded-[34px] lg:[zoom:0.75]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
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
              className="space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6"
              onChangeCapture={handleReadOnlyFormInteraction}
              onClickCapture={handleReadOnlyFormInteraction}
              onInputCapture={handleReadOnlyFormInteraction}
              onKeyDownCapture={handleReadOnlyFormInteraction}
              onSubmit={handleFormSubmit}
              ref={formRef}
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
              <input
                name="procedureDetails"
                type="hidden"
                value={procedureDetailsValue}
              />

              {mode === "edit" && procedureId ? (
                <input name="procedureId" type="hidden" value={procedureId} />
              ) : null}
              {defaultValues?.originIds?.map((originId) => (
                <input key={originId} name="originIds" type="hidden" value={originId} />
              ))}

              {!hideTypeSelector ? (
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
                    <label className="block max-w-md space-y-2 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                        Ou digite o tipo
                      </span>
                      <input
                        className="lz-input w-full rounded-2xl px-3 py-3"
                        maxLength={60}
                        onChange={(event) => {
                          const value = event.target.value.slice(0, 60);
                          setCustomProcedureType(value);
                          const normalized = value.trim().replace(/\s+/g, " ");

                          if (normalized) {
                            setSelectedType(normalized);
                          }
                        }}
                        placeholder="Ex.: Reembolso, bônus, missão..."
                        type="text"
                        value={customProcedureType}
                      />
                    </label>
                    <input name="procedureType" type="hidden" value={selectedType} />
                  </div>
                </div>
              ) : (
                <input name="procedureType" type="hidden" value={selectedType} />
              )}

              <input name="operationDate" type="hidden" value={operationDateForSubmit} />
              {isFreebetType ? (
                <>
                  <input name="game" type="hidden" value={freebetGameForSubmit} />
                  <input
                    name="collectionGame"
                    type="hidden"
                    value={collectionGameValue}
                  />
                  <input
                    name="conversionGame"
                    type="hidden"
                    value={conversionGameValue}
                  />
                  <input
                    name="conversionBatchId"
                    type="hidden"
                    value={defaultValues?.conversionBatchId ?? ""}
                  />
                </>
              ) : null}

              <div
                className={`grid gap-4 ${
                  supportsGame && !isFreebetType ? "md:grid-cols-2" : "md:grid-cols-1"
                }`}
              >
                {!isFreebetType ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Data</span>
                    <DatePickerField
                      onChange={setOperationDate}
                      value={operationDate}
                    />
                  </label>
                ) : null}

                {supportsGame && !isFreebetType ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-white">Jogo</span>
                    <input
                      className="lz-input w-full rounded-2xl px-3 py-3"
                      maxLength={120}
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
                      onValueChange={handleFreebetConditionChange}
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
                    {!isReadOnly ? (
                      <button
                        aria-label="Recolher observações"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-white/20 hover:text-white"
                        onClick={() => setNoteExpanded(false)}
                        type="button"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <textarea
                    className="lz-textarea h-[58px] min-h-[58px] w-full resize-y rounded-2xl px-3 py-3 text-sm leading-6"
                    onChange={(event) => setNoteValue(event.target.value)}
                    placeholder="Adicione qualquer contexto importante"
                    value={noteValue}
                  />
                </div>
              ) : isReadOnly ? null : (
                <button
                  className="inline-flex items-center gap-1.5 text-left text-sm font-medium text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => setNoteExpanded(true)}
                  type="button"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Adicionar observações</span>
                </button>
              )}

              {showFreebetCollectionSection ? (
                <div className="min-w-0 space-y-4 rounded-[24px] border border-white/10 bg-white/4 p-3 sm:p-4">
                  <button
                    aria-label={
                      freebetCollectionExpanded ? "Fechar coleta" : "Abrir coleta"
                    }
                    aria-expanded={freebetCollectionExpanded}
                    className={`group flex w-full items-center justify-between gap-3 text-left transition ${
                      freebetCollectionBlocked
                        ? "cursor-not-allowed opacity-50"
                        : ""
                    }`}
                    data-readonly-allowed="true"
                    disabled={freebetCollectionBlocked}
                    onClick={() => {
                      if (freebetCollectionBlocked) {
                        return;
                      }

                      setFreebetCollectionOpen((current) => !current);
                    }}
                    type="button"
                  >
                    <span className="text-sm font-semibold text-white">Coleta</span>
                    <DisclosureIcon open={freebetCollectionExpanded} />
                  </button>

                  {freebetCollectionExpanded ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-white">Data da coleta</span>
                          <DatePickerField
                            onChange={setCollectionDate}
                            value={collectionDate}
                          />
                        </label>

                        <label className="space-y-2 text-sm">
                          <span className="font-medium text-white">Jogo</span>
                          <input
                            className="lz-input w-full rounded-2xl px-3 py-3"
                            onChange={(event) =>
                              setCollectionGameValue(event.target.value)
                            }
                            placeholder="Ex.: Barcelona x Real Madrid"
                            type="text"
                            value={collectionGameValue}
                          />
                        </label>
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
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

                          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                            {renderSportsBetFields({
                              stakeName: "collectionPrimaryStake",
                              oddName: "collectionPrimaryOdd",
                              stakeValue: collectionPrimaryStake,
                              oddValue: collectionPrimaryOdd,
                              side: collectionPrimarySide,
                              layOddValue: collectionPrimaryLayOdd,
                              commissionValue: collectionPrimaryCommission,
                              increaseValue: collectionPrimaryIncrease,
                              cashbackValue: collectionPrimaryCashback,
                              freebetChecked: collectionPrimaryFreebet,
                              configOpen: Boolean(
                                sportsConfigOpen["collection-primary"],
                              ),
                              onStakeChange: setCollectionPrimaryStake,
                              onOddChange: setCollectionPrimaryOdd,
                              onToggleSide: () =>
                                setCollectionPrimarySide((current) =>
                                  current === "back" ? "lay" : "back",
                                ),
                              onLayOddChange: setCollectionPrimaryLayOdd,
                              onCommissionChange: setCollectionPrimaryCommission,
                              onIncreaseChange: setCollectionPrimaryIncrease,
                              onCashbackChange: setCollectionPrimaryCashback,
                              onFreebetChange: setCollectionPrimaryFreebet,
                              onToggleConfig: () =>
                                toggleSportsConfig("collection-primary"),
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
                                {!isReadOnly ? (
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
                                ) : null}
                              </div>

                              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
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
                                  increaseValue:
                                    collectionProtectionDrafts[key]?.increase ?? "",
                                  cashbackValue:
                                    collectionProtectionDrafts[key]?.cashback ?? "",
                                  freebetChecked: Boolean(
                                    collectionProtectionDrafts[key]?.freebet,
                                  ),
                                  configOpen: Boolean(
                                    sportsConfigOpen[`collection-protection-${key}`],
                                  ),
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
                                  onIncreaseChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "increase",
                                      value,
                                    ),
                                  onCashbackChange: (value) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "cashback",
                                      value,
                                    ),
                                  onFreebetChange: (checked) =>
                                    setCollectionProtectionDraftValue(
                                      key,
                                      "freebet",
                                      checked,
                                    ),
                                  onToggleConfig: () =>
                                    toggleSportsConfig(
                                      `collection-protection-${key}`,
                                    ),
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!isReadOnly &&
                      collectionProtectionKeys.length < MAX_SPORT_PROTECTIONS ? (
                        <button
                          className="lz-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium"
                          onClick={addCollectionProtection}
                          type="button"
                        >
                          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>Adicionar proteção</span>
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

              {supportsProfitDistribution && showFreebetConversionSection ? (
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
                      ? "min-w-0 space-y-4 rounded-[24px] border border-white/10 bg-white/4 p-3 sm:p-4"
                        : "space-y-4"
                    }
                  >
                  {isFreebetType ? (
                    <button
                      aria-label={
                        freebetConversionExpanded
                          ? "Fechar conversão"
                          : "Abrir conversão"
                      }
                      aria-expanded={freebetConversionExpanded}
                      className={`group flex w-full items-center justify-between gap-3 text-left transition ${
                        freebetConversionBlocked
                          ? "cursor-not-allowed opacity-50"
                          : ""
                      }`}
                      data-readonly-allowed="true"
                      disabled={freebetConversionBlocked}
                      onClick={() => {
                        if (freebetConversionBlocked) {
                          return;
                        }

                        setFreebetConversionOpen((current) => !current);
                      }}
                      type="button"
                    >
                      <span className="text-sm font-semibold text-white">
                        Conversão
                      </span>
                      <DisclosureIcon open={freebetConversionExpanded} />
                    </button>
                  ) : null}

                  {!isFreebetType || freebetConversionExpanded ? (
                    <>
                  {isFreebetType ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Data da conversão</span>
                        <DatePickerField
                          onChange={setConversionDate}
                          value={conversionDate}
                        />
                      </label>

                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Jogo</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          onChange={(event) =>
                            setConversionGameValue(event.target.value)
                          }
                          placeholder="Ex.: Barcelona x Real Madrid"
                          type="text"
                          value={conversionGameValue}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
                    <div
                      className={getSportCardClass(
                        sportResultSelections.includes("principal"),
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Principal</p>
                      </div>

                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
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
                          increaseValue: primaryIncrease,
                          cashbackValue: primaryCashback,
                          freebetChecked: primaryFreebet,
                          configOpen: Boolean(sportsConfigOpen["sports-primary"]),
                          onStakeChange: setPrimaryStake,
                          onOddChange: setPrimaryOdd,
                          onToggleSide: () =>
                            setPrimarySide((current) =>
                              current === "back" ? "lay" : "back",
                            ),
                          onLayOddChange: setPrimaryLayOdd,
                          onCommissionChange: setPrimaryCommission,
                          onIncreaseChange: setPrimaryIncrease,
                          onCashbackChange: setPrimaryCashback,
                          onFreebetChange: setPrimaryFreebet,
                          onToggleConfig: () =>
                            toggleSportsConfig("sports-primary"),
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
                                {!isReadOnly ? (
                                  <button
                                    aria-label={`Remover proteção ${index + 1}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-[rgba(255,107,133,0.28)] hover:bg-[rgba(255,107,133,0.12)] hover:text-[var(--negative)]"
                                    onClick={() => removeProtection(key, index)}
                                    type="button"
                                  >
                                    <CloseIcon className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>

                              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
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
                                  increaseValue:
                                    protectionDrafts[key]?.increase ?? "",
                                  cashbackValue:
                                    protectionDrafts[key]?.cashback ?? "",
                                  freebetChecked: Boolean(
                                    protectionDrafts[key]?.freebet,
                                  ),
                                  configOpen: Boolean(
                                    sportsConfigOpen[`sports-protection-${key}`],
                                  ),
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
                                  onIncreaseChange: (value) =>
                                    setProtectionDraftValue(
                                      key,
                                      "increase",
                                      value,
                                    ),
                                  onCashbackChange: (value) =>
                                    setProtectionDraftValue(
                                      key,
                                      "cashback",
                                      value,
                                    ),
                                  onFreebetChange: (checked) =>
                                    setProtectionDraftValue(
                                      key,
                                      "freebet",
                                      checked,
                                    ),
                                  onToggleConfig: () =>
                                    toggleSportsConfig(
                                      `sports-protection-${key}`,
                                    ),
                                })}
                              </div>
                            </div>
                          );
                        })
                      : null}
                  </div>

                  {!isReadOnly &&
                  !isNormalBet &&
                  protectionKeys.length < MAX_SPORT_PROTECTIONS ? (
                    <button
                      className="lz-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium"
                      onClick={addProtection}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Adicionar proteção</span>
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
                      <div
                        className={`grid gap-3 ${
                          freebetVisibleScope === "all"
                            ? "lg:grid-cols-3"
                            : "lg:grid-cols-1"
                        }`}
                      >
                        {freebetVisibleScope !== "conversion" ? (
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
                        ) : null}

                        {freebetVisibleScope !== "collection" ? (
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
                        ) : null}

                        {freebetVisibleScope === "all" ? (
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
                        ) : null}
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
                  {selectedGroup === "expenses" ? (
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Descrição</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          name="game"
                          onChange={(event) => setGameValue(event.target.value)}
                          placeholder="Ex.: depósito, taxa, compra"
                          type="text"
                          value={gameValue}
                        />
                      </label>

                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Valor</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          onChange={(event) => setEntryProfitValue(event.target.value)}
                          placeholder="0,00"
                          step="0.01"
                          type="number"
                          value={entryProfitValue}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <span className="font-medium text-white">Casa</span>
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
                          {casinoResultInputLabel}
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
                        <span className="font-medium text-white">Descrição</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          name="game"
                          onChange={(event) => setGameValue(event.target.value)}
                          placeholder="Ex.: missão semanal, giros, método"
                          type="text"
                          value={gameValue}
                        />
                      </label>
                    </div>
                  )}

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
                {!isReadOnly ? (
                  <button
                    aria-label="Copiar link do procedimento"
                    className="lz-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full p-0"
                    onClick={handleCopyProcedure}
                    title="Copiar link"
                    type="button"
                  >
                    <CopyIcon />
                  </button>
                ) : null}
                <button
                  className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-medium"
                  data-readonly-allowed="true"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  {isReadOnly ? "Fechar" : "Cancelar"}
                </button>
                {!isReadOnly ? (
                  <FormSubmitButton
                    className="lz-button-primary rounded-full px-5 py-2.5 text-sm font-semibold"
                    pendingLabel={mode === "edit" ? "Salvando..." : "Criando..."}
                  >
                    {submitLabel}
                  </FormSubmitButton>
                ) : null}
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
