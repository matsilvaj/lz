"use client";

import { FREEBET_CONDITION_CONVERSION_ONLY, calculateSurebet } from "@/core";
import {
  CornerDownRight,
  Lock,
  LockOpen,
  Minus,
  Plus,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProcedureShareValues } from "../_components/procedure-share-types";

import { useToast } from "@/app/_components/toast-provider";
import {
  decodeCalculatorPayload,
  encodeCalculatorPayload,
  type SharedCalculatorLine,
  type SharedCalculatorPayload,
} from "@/lib/calculator-share";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
import { LzSelect } from "../_components/lz-select";
import { ProcedureModal } from "../_components/procedure-modal";
import { formatCurrency } from "../_components/ui";

type CalculatorWorkspaceProps = {
  bookmakers: string[];
  initialSearchParams?: Record<string, string | string[] | undefined>;
};

type CalculatorProcedureDefaults = ProcedureShareValues & {
  originIds?: number[];
};

type CalculatorLine = CalculatorLineFields & {
  children: CalculatorLineFields[];
};

type CalculatorLineFields = {
  house: string;
  odd: string;
  stake: string;
  stakeEdited: boolean;
  tipo: "B" | "L";
  responsabilidade: string;
  responsabilidadeEdited: boolean;
  aumento_percentual: string;
  comissao_percentual: string;
  cashback_percentual: string;
  freebet: boolean;
};

type CalculatorResultLine = {
  stake?: number;
  responsabilidade?: number;
  lucro_liquido?: number;
  custo?: number;
  cashback?: number;
  retorno_bruto?: number;
  retorno_grupo?: number;
  custo_grupo?: number;
  cashback_grupo?: number;
  filhas?: CalculatorResultLine[];
  math?: {
    M?: number;
  };
};

type MemberPath = { group: number; child: number | null };

const MAX_CHILD_LINES = 5;

type CalculatorResult = {
  linhas?: CalculatorResultLine[];
  investimento_efetivo?: number;
  lucro_liquido: number;
  lucro_percentual: number;
  duplo_calculado_final: number;
};

type BookmakerAutocompleteInputProps = {
  placeholder: string;
  bookmakers: string[];
  onValueChange: (value: string) => void;
  value: string;
};

function createInitialFields(): CalculatorLineFields {
  return {
    house: "",
    odd: "2",
    stake: "100",
    stakeEdited: false,
    tipo: "B",
    responsabilidade: "0",
    responsabilidadeEdited: false,
    aumento_percentual: "0",
    comissao_percentual: "0",
    cashback_percentual: "0",
    freebet: false,
  };
}

function createInitialLine(): CalculatorLine {
  return { ...createInitialFields(), children: [] };
}

function createConversionLine(house: string, freebetValue: number): CalculatorLine {
  return {
    ...createInitialLine(),
    house,
    stake: String(freebetValue || 0),
    freebet: true,
  };
}

function clampInteger(value: unknown, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function toSharedString(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

function normalizeSharedCalculatorLine(line: SharedCalculatorLine): CalculatorLine {
  const children = Array.isArray(line.filhas)
    ? (line.filhas as SharedCalculatorLine[])
        .filter((child) => child && typeof child === "object")
        .slice(0, MAX_CHILD_LINES)
        .map((child) => normalizeSharedCalculatorFields(child))
    : [];

  return { ...normalizeSharedCalculatorFields(line), children };
}

function toSharedFields(line: CalculatorLineFields): SharedCalculatorLine {
  return {
    house: line.house,
    odd: line.odd,
    stake: line.stake,
    stakeEdited: line.stakeEdited,
    tipo: line.tipo,
    responsabilidade: line.responsabilidade,
    responsabilidadeEdited: line.responsabilidadeEdited,
    aumento_percentual: line.aumento_percentual,
    comissao_percentual: line.comissao_percentual,
    cashback_percentual: line.cashback_percentual,
    freebet: line.freebet,
  };
}

function toCalculationFields(line: CalculatorLineFields, locked: boolean) {
  return {
    odd: toNumber(line.odd),
    stake: locked ? toNumber(line.stake) : 0,
    tipo: line.tipo,
    responsabilidade: toNumber(line.responsabilidade),
    aumento_percentual: toNumber(line.aumento_percentual),
    comissao_percentual: toNumber(line.comissao_percentual),
    cashback_percentual: toNumber(line.cashback_percentual),
    freebet: line.freebet,
  };
}

function normalizeSharedCalculatorFields(
  line: SharedCalculatorLine,
): CalculatorLineFields {
  const initialLine = createInitialFields();

  return {
    house: toSharedString(line.house, initialLine.house),
    odd: toSharedString(line.odd, initialLine.odd),
    stake: toSharedString(line.stake, initialLine.stake),
    stakeEdited: Boolean(line.stakeEdited),
    tipo:
      toSharedString(line.tipo, initialLine.tipo).toUpperCase().startsWith("L")
        ? "L"
        : "B",
    responsabilidade: toSharedString(
      line.responsabilidade,
      initialLine.responsabilidade,
    ),
    responsabilidadeEdited: Boolean(line.responsabilidadeEdited),
    aumento_percentual: toSharedString(
      line.aumento_percentual,
      initialLine.aumento_percentual,
    ),
    comissao_percentual: toSharedString(
      line.comissao_percentual,
      initialLine.comissao_percentual,
    ),
    cashback_percentual: toSharedString(
      line.cashback_percentual,
      initialLine.cashback_percentual,
    ),
    freebet: Boolean(line.freebet),
  };
}

function copyTextFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 8.5A2.5 2.5 0 0 1 10.5 6h7A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-7A2.5 2.5 0 0 1 8 17.5v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5 15.5V6.5A2.5 2.5 0 0 1 7.5 4h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getProfitClass(value: number) {
  return value >= 0 ? "text-emerald-400" : "text-rose-400";
}

function formatPercent(value: number) {
  return `${value.toFixed(4)}%`;
}

function toNumber(value: string) {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCalculatedValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function formatRealOddValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : "0.000";
}

function formatProcedureNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || Math.abs(parsed) < 0.005) {
    return "";
  }

  return String(Math.round(parsed * 100) / 100);
}

function calculateEffectiveOdd(line: CalculatorLineFields) {
  const odd = toNumber(line.odd);

  if (odd <= 1) {
    return odd;
  }

  return 1 + (odd - 1) * (1 + toNumber(line.aumento_percentual) / 100);
}

function calculateRealOdd(line: CalculatorLineFields) {
  const effectiveOdd = calculateEffectiveOdd(line);
  const commissionMultiplier = 1 - toNumber(line.comissao_percentual) / 100;
  const cashbackRate = toNumber(line.cashback_percentual) / 100;

  if (line.tipo === "L") {
    return (
      effectiveOdd -
      1 +
      commissionMultiplier -
      (effectiveOdd - 1) * cashbackRate
    );
  }

  if (line.freebet) {
    return (effectiveOdd - 1) * commissionMultiplier;
  }

  return 1 + (effectiveOdd - 1) * commissionMultiplier - cashbackRate;
}

function roundCurrencyValue(value: number) {
  return Math.round(value * 100) / 100;
}

const calculatorConfigFieldClass =
  "grid min-w-0 grid-cols-[minmax(0,1fr)_64px] items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-2.5 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_74px] sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm";

const calculatorConfigInputClass =
  "lz-input min-w-0 w-full rounded-xl px-2 py-1 text-right text-xs sm:py-1.5 sm:text-sm";

const maxCalculatorColumnsPerRow = 5;

function getInitialSearchParam(
  params: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = params[name];

  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function getAllInitialSearchParams(
  params: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = params[name];

  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function BookmakerAutocompleteInput({
  placeholder,
  bookmakers,
  onValueChange,
  value,
}: BookmakerAutocompleteInputProps) {
  const generatedId = useId();
  const menuId = `${generatedId}-bookmaker-menu`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const normalizedValue = value.trim().toLowerCase();
  const visibleBookmakers = useMemo(() => {
    const availableBookmakers = bookmakers.filter(Boolean);

    if (!normalizedValue) {
      return availableBookmakers.slice(0, 10);
    }

    return availableBookmakers
      .filter((bookmaker) =>
        bookmaker.toLowerCase().includes(normalizedValue),
      )
      .slice(0, 10);
  }, [bookmakers, normalizedValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = inputRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (inputRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(bookmaker: string) {
    onValueChange(bookmaker);
    setOpen(false);
  }

  return (
    <>
      <input
        aria-autocomplete="list"
        aria-controls={menuId}
        aria-expanded={open}
        className="calculator-house-input min-w-0 flex-1 rounded-lg bg-transparent px-0 text-base font-semibold text-white outline-none"
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        type="text"
        value={value}
      />

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90]"
              style={{
                left: `${menuStyle.left}px`,
                top: `${menuStyle.top}px`,
                width: `${menuStyle.width}px`,
              }}
            >
              <div
                className="rounded-[22px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                id={menuId}
                ref={menuRef}
                role="listbox"
              >
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {visibleBookmakers.length > 0 ? (
                    visibleBookmakers.map((bookmaker) => {
                      const active = bookmaker === value;

                      return (
                        <button
                          aria-selected={active}
                          className={`flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-left text-sm transition ${
                            active
                              ? "border border-[rgba(255,119,163,0.18)] bg-[rgba(216,31,89,0.18)] text-white"
                              : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                          }`}
                          key={bookmaker}
                          onClick={() => handleSelect(bookmaker)}
                          role="option"
                          type="button"
                        >
                          <span className="min-w-0 truncate">{bookmaker}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      Nenhuma casa encontrada.
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function CalculatorWorkspace({
  bookmakers,
  initialSearchParams = {},
}: CalculatorWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const searchParams = useMemo(
    () => ({
      get: (name: string) => getInitialSearchParam(initialSearchParams, name),
      getAll: (name: string) =>
        getAllInitialSearchParams(initialSearchParams, name),
    }),
    [initialSearchParams],
  );
  const conversionPreset = useMemo(() => {
    if (searchParams.get("mode") !== "convert-freebet") {
      return null;
    }

    const house = searchParams.get("house") ?? "";
    const freebetValue = Number(searchParams.get("freebetValue") ?? 0);
    const entryValue = Number(searchParams.get("entryValue") ?? 0);
    const conversionBatchId = searchParams.get("conversionBatchId") ?? "";
    const freebetCondition = searchParams.get("freebetCondition") ?? "";
    const originIds = searchParams
      .getAll("originIds")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
    const key = JSON.stringify({
      house,
      freebetValue,
      entryValue,
      conversionBatchId,
      freebetCondition,
      originIds,
    });

    return {
      key,
      house,
      freebetValue: Number.isFinite(freebetValue) ? freebetValue : 0,
      entryValue: Number.isFinite(entryValue) ? entryValue : 0,
      freebetCondition,
      conversionBatchId,
      originIds,
    };
  }, [searchParams]);
  const sharedPreset = useMemo(() => {
    const sharedValue = searchParams.get("calc");

    if (!sharedValue) {
      return null;
    }

    const payload = decodeCalculatorPayload(sharedValue);

    if (!payload || !Array.isArray(payload.lines)) {
      return null;
    }

    const sharedLines = payload.lines
      .slice(0, 10)
      .map((line) => normalizeSharedCalculatorLine(line));

    if (sharedLines.length === 0) {
      return null;
    }

    const nextLineCount = clampInteger(
      payload.lineCount ?? sharedLines.length,
      2,
      10,
    );
    const linesWithMinimum = [...sharedLines];

    while (linesWithMinimum.length < nextLineCount) {
      linesWithMinimum.push(createInitialLine());
    }

    return {
      key: `shared:${sharedValue}`,
      eventName:
        typeof payload.eventName === "string"
          ? payload.eventName
              .replace(/\p{Cc}/gu, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180)
          : "",
      lineCount: nextLineCount,
      workspaceIndex: clampInteger(payload.workspaceIndex, 0, nextLineCount - 1),
      configExpanded: Boolean(payload.configExpanded),
      lines: linesWithMinimum.slice(0, nextLineCount),
    };
  }, [searchParams]);
  const appliedPresetRef = useRef<string | null>(null);
  const [lineCount, setLineCount] = useState(() => sharedPreset?.lineCount ?? 2);
  const [workspaceIndex, setWorkspaceIndex] = useState(
    () => sharedPreset?.workspaceIndex ?? 0,
  );
  const [configExpanded, setConfigExpanded] = useState(
    () => sharedPreset?.configExpanded ?? false,
  );
  const [lines, setLines] = useState<CalculatorLine[]>(() =>
    sharedPreset
      ? sharedPreset.lines
      : conversionPreset
      ? [createConversionLine(conversionPreset.house, conversionPreset.freebetValue), createInitialLine()]
      : [createInitialLine(), createInitialLine()],
  );
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [procedureModalKey, setProcedureModalKey] = useState(0);
  const [procedureChoiceOpen, setProcedureChoiceOpen] = useState(false);
  const [activeProcedureDefaults, setActiveProcedureDefaults] =
    useState<CalculatorProcedureDefaults | null>(null);

  useEffect(() => {
    if (sharedPreset) {
      if (appliedPresetRef.current === sharedPreset.key) {
        return;
      }

      setLineCount(sharedPreset.lineCount);
      setWorkspaceIndex(sharedPreset.workspaceIndex);
      setConfigExpanded(sharedPreset.configExpanded);
      setLines(sharedPreset.lines);
      appliedPresetRef.current = sharedPreset.key;
      return;
    }

    if (!conversionPreset) {
      appliedPresetRef.current = null;
      return;
    }

    if (appliedPresetRef.current === conversionPreset.key) {
      return;
    }

    setLineCount(2);
    setWorkspaceIndex(0);
    setConfigExpanded(false);
    setLines([
      createConversionLine(conversionPreset.house, conversionPreset.freebetValue),
      createInitialLine(),
    ]);
    appliedPresetRef.current = conversionPreset.key;
  }, [sharedPreset, conversionPreset]);

  function mapMember(
    path: MemberPath,
    update: (member: CalculatorLineFields) => CalculatorLineFields,
  ) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== path.group) {
          return line;
        }

        if (path.child === null) {
          return { ...line, ...update(line), children: line.children };
        }

        return {
          ...line,
          children: line.children.map((child, childIndex) =>
            childIndex === path.child ? update(child) : child,
          ),
        };
      }),
    );
  }

  function updateMember(path: MemberPath, patch: Partial<CalculatorLineFields>) {
    mapMember(path, (member) => ({ ...member, ...patch }));
  }

  function updateLine(index: number, patch: Partial<CalculatorLineFields>) {
    updateMember({ group: index, child: null }, patch);
  }

  function isMemberLocked(path: MemberPath, member: CalculatorLineFields) {
    return path.group === workspaceIndex || member.stakeEdited;
  }

  function getDisplayedStake(path: MemberPath) {
    const line = lines[path.group];
    const member = path.child === null ? line : line?.children[path.child];
    const result =
      path.child === null
        ? calculation?.linhas?.[path.group]
        : calculation?.linhas?.[path.group]?.filhas?.[path.child];

    if (!member) {
      return "0";
    }

    if (isMemberLocked(path, member) || !result) {
      return member.stake;
    }

    return formatCalculatedValue(result.stake);
  }

  function lockGroupMembers(
    line: CalculatorLine,
    groupIndex: number,
    keep: (child: number | null) => boolean,
  ): CalculatorLine {
    const lockMember = (member: CalculatorLineFields, child: number | null) =>
      keep(child) || member.stakeEdited
        ? member
        : {
            ...member,
            stake: getDisplayedStake({ group: groupIndex, child }),
            stakeEdited: true,
          };

    return {
      ...lockMember(line, null),
      children: line.children.map((child, childIndex) => lockMember(child, childIndex)),
    };
  }

  function toggleMemberLock(path: MemberPath) {
    if (path.group === workspaceIndex) {
      return;
    }

    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== path.group) {
          return line;
        }

        const member = path.child === null ? line : line.children[path.child];

        if (!member) {
          return line;
        }

        if (!member.stakeEdited) {
          const stake = getDisplayedStake(path);
          return path.child === null
            ? { ...line, stake, stakeEdited: true }
            : {
                ...line,
                children: line.children.map((child, childIndex) =>
                  childIndex === path.child ? { ...child, stake, stakeEdited: true } : child,
                ),
              };
        }

        const locked = lockGroupMembers(line, lineIndex, (child) => child === path.child);

        return path.child === null
          ? { ...locked, stakeEdited: false }
          : {
              ...locked,
              children: locked.children.map((child, childIndex) =>
                childIndex === path.child ? { ...child, stakeEdited: false } : child,
              ),
            };
      }),
    );
  }

  function addChildLine(groupIndex: number) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== groupIndex || line.children.length >= MAX_CHILD_LINES) {
          return line;
        }

        const base = lineIndex === workspaceIndex;
        const locked = base ? line : lockGroupMembers(line, lineIndex, () => false);

        return {
          ...locked,
          children: [
            ...locked.children,
            {
              ...createInitialFields(),
              odd: line.odd,
              stake: base ? "" : "0",
              stakeEdited: base,
            },
          ],
        };
      }),
    );
  }

  function removeChildLine(groupIndex: number, childIndex: number) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== groupIndex) {
          return line;
        }

        const children = line.children.filter((_, index) => index !== childIndex);
        const hasFreeMember =
          !line.stakeEdited || children.some((child) => !child.stakeEdited);

        return {
          ...line,
          stakeEdited:
            lineIndex !== workspaceIndex && !hasFreeMember ? false : line.stakeEdited,
          children,
        };
      }),
    );
  }

  function resetCalculator() {
    if (conversionPreset || sharedPreset) {
      appliedPresetRef.current = null;
      router.replace(pathname);
    }

    setLineCount(2);
    setWorkspaceIndex(0);
    setConfigExpanded(false);
    setLines([createInitialLine(), createInitialLine()]);
  }

  function updateLineCount(nextCount: number) {
    setLineCount(nextCount);
    setLines((current) => {
      if (nextCount <= current.length) {
        return current.slice(0, nextCount);
      }

      const additional = Array.from(
        { length: nextCount - current.length },
        () => createInitialLine(),
      );

      return [...current, ...additional];
    });
    setWorkspaceIndex((current) => Math.min(current, nextCount - 1));
  }

  function toggleLineType(path: MemberPath) {
    mapMember(path, (member) => {
      const nextType = member.tipo === "B" ? "L" : "B";

      return {
        ...member,
        tipo: nextType,
        responsabilidade: nextType === "B" ? "0" : member.responsabilidade,
        responsabilidadeEdited: false,
      };
    });
  }

  function shouldLockOnEdit(path: MemberPath) {
    return path.group !== workspaceIndex || path.child !== null;
  }

  function handleStakeChange(path: MemberPath, value: string) {
    mapMember(path, (member) => ({
      ...member,
      stake: value,
      stakeEdited: shouldLockOnEdit(path),
      responsabilidadeEdited:
        member.tipo === "L" ? false : member.responsabilidadeEdited,
    }));
  }

  function handleResponsabilidadeChange(path: MemberPath, value: string) {
    mapMember(path, (member) => {
      const odd = toNumber(member.odd);
      const responsibility = toNumber(value);

      return {
        ...member,
        responsabilidade: value,
        responsabilidadeEdited: true,
        stake:
          odd > 1 && value !== ""
            ? formatCalculatedValue(responsibility / (odd - 1))
            : member.stake,
        stakeEdited: shouldLockOnEdit(path),
      };
    });
  }

  function fixStake(index: number, stake: string) {
    setLines((current) =>
      current.map((line, lineIndex) => ({
        ...line,
        stake: lineIndex === index ? stake : line.stake,
        stakeEdited: false,
        responsabilidadeEdited: false,
        children: line.children.map((child, childIndex) => ({
          ...child,
          stake: getDisplayedStake({ group: lineIndex, child: childIndex }),
          stakeEdited: true,
        })),
      })),
    );
    setWorkspaceIndex(index);
  }

  async function copyCalculationLink() {
    if (typeof window === "undefined") {
      return;
    }

    const payload: SharedCalculatorPayload = {
      version: 1,
      lineCount,
      workspaceIndex,
      configExpanded,
      lines: lines.slice(0, lineCount).map((line) => ({
        ...toSharedFields(line),
        filhas: line.children.map(toSharedFields),
      })),
    };
    const params = new URLSearchParams();
    params.set("calc", encodeCalculatorPayload(payload));
    const shareUrl = `${window.location.origin}${pathname}?${params.toString()}`;

    try {
      let copied = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        copied = copyTextFallback(shareUrl);
      }

      if (!copied) {
        throw new Error("Clipboard unavailable");
      }

      showToast({
        title: "Link do cálculo copiado.",
        tone: "success",
      });
    } catch {
      showToast({
        title: "Não foi possível copiar o link.",
        tone: "error",
      });
    }
  }

  let calculationError = "";
  let calculation: CalculatorResult | null = null;

  try {
    calculation = calculateSurebet(
      lines.map((line, index) => ({
        ...toCalculationFields(line, index === workspaceIndex || line.stakeEdited),
        filhas: line.children.map((child) =>
          toCalculationFields(child, index === workspaceIndex || child.stakeEdited),
        ),
      })),
      workspaceIndex,
    ) as CalculatorResult;
  } catch (error) {
    calculationError =
      error instanceof Error ? error.message : "Não foi possível calcular.";
  }

  const stakeTotal =
    calculation?.linhas?.reduce(
      (total, line) =>
        total +
        Number(line.stake ?? 0) +
        (line.filhas ?? []).reduce((sum, child) => sum + Number(child.stake ?? 0), 0),
      0,
    ) ?? 0;
  const hasLayLine = lines.some(
    (line) => line.tipo === "L" || line.children.some((child) => child.tipo === "L"),
  );
  const totalColumns = lines.reduce((total, line) => total + 1 + line.children.length, 0);
  const columnsPerRow = Math.min(totalColumns, maxCalculatorColumnsPerRow);
  const procedureLineOrder = [
    workspaceIndex,
    ...Array.from({ length: lineCount }, (_, index) => index).filter(
      (index) => index !== workspaceIndex,
    ),
  ];
  const toProcedureEntry = (
    line: CalculatorLineFields,
    resultLine: CalculatorResultLine | undefined,
  ) => {
    const stake = resultLine?.stake ?? toNumber(line.stake);
    const responsibility =
      resultLine?.responsabilidade ?? toNumber(line.responsabilidade);
    const side: "lay" | "back" = line.tipo === "L" ? "lay" : "back";
    const procedureStake = side === "lay" && responsibility > 0
      ? responsibility
      : stake;

    return {
      house: line.house.trim(),
      odd: formatProcedureNumber(line.odd),
      stake: formatProcedureNumber(procedureStake),
      side,
      layOdd: side === "lay" ? formatProcedureNumber(line.odd) : "",
      commission: formatProcedureNumber(line.comissao_percentual),
      increase: formatProcedureNumber(line.aumento_percentual),
      cashback: formatProcedureNumber(line.cashback_percentual),
      freebet: line.freebet,
    };
  };
  const procedureEntries = procedureLineOrder.map((lineIndex) => {
    const line = lines[lineIndex] ?? createInitialLine();
    const resultLine = calculation?.linhas?.[lineIndex];

    return {
      ...toProcedureEntry(line, resultLine),
      children: line.children
        .map((child, childIndex) =>
          toProcedureEntry(child, resultLine?.filhas?.[childIndex]),
        )
        .filter((child) => child.stake !== ""),
    };
  });
  const procedureChildren = procedureEntries.reduce<
    Record<string, ReturnType<typeof toProcedureEntry>[]>
  >((record, entry, index) => {
    if (entry.children.length > 0) {
      record[index === 0 ? "principal" : `protection-${index - 1}`] = entry.children;
    }

    return record;
  }, {});
  const procedurePrimary = procedureEntries[0] ?? {
    house: "",
    odd: "",
    stake: "",
    side: "back" as const,
    layOdd: "",
    commission: "",
    increase: "",
    cashback: "",
    freebet: false,
    children: [],
  };
  const procedureProtections = procedureEntries.slice(1);
  const procedureSelectedHouses = procedureEntries.map((entry) => entry.house);
  const firstFreebetEntry = procedureEntries.find((entry) => entry.freebet);
  const hasFreebetEntry = Boolean(firstFreebetEntry);

  function buildProcedureDefaultValues(asFreebetConversion: boolean) {
    const freebetHouse = conversionPreset?.house ?? procedurePrimary.house;
    const freebetValue = conversionPreset?.freebetValue;
    const eventName = sharedPreset?.eventName ?? "";
    const isConversion = asFreebetConversion || Boolean(conversionPreset);

    return {
      version: 1,
      game: eventName,
      collectionGame: isConversion ? "" : eventName,
      conversionGame: isConversion ? eventName : "",
      procedureType:
        asFreebetConversion || conversionPreset ? "Converter Freebet" : "SureBet",
      houses: procedureSelectedHouses.filter(Boolean).join(", "),
      entryValue: calculation?.lucro_liquido ?? 0,
      doubleValue:
        asFreebetConversion || conversionPreset
          ? 0
          : calculation?.duplo_calculado_final ?? 0,
      hitDouble: false,
      freebetHouse,
      freebetValue,
      freebetCondition:
        conversionPreset?.freebetCondition ||
        (conversionPreset && !conversionPreset.originIds.length
          ? FREEBET_CONDITION_CONVERSION_ONLY
          : undefined),
      conversionBatchId: conversionPreset?.conversionBatchId ?? "",
      originIds: conversionPreset?.originIds ?? [],
      selectedHouses: procedureSelectedHouses,
      selectedFreebetHouse: freebetHouse,
      primaryStake: procedurePrimary.stake,
      primaryOdd: procedurePrimary.odd,
      primarySide: procedurePrimary.side,
      primaryLayOdd: procedurePrimary.layOdd,
      primaryCommission: procedurePrimary.commission,
      primaryIncrease: procedurePrimary.increase,
      primaryCashback: procedurePrimary.cashback,
      primaryFreebet: procedurePrimary.freebet,
      sportChildren: procedureChildren,
      collectionChildren: procedureChildren,
      sportProtections: procedureProtections.map((entry) => ({
        stake: entry.stake,
        odd: entry.odd,
        side: entry.side,
        layOdd: entry.layOdd,
        commission: entry.commission,
        increase: entry.increase,
        cashback: entry.cashback,
        freebet: entry.freebet,
      })),
      sportResultSelections: [],
      collectionHouses: procedureSelectedHouses,
      collectionPrimaryStake: procedurePrimary.stake,
      collectionPrimaryOdd: procedurePrimary.odd,
      collectionPrimarySide: procedurePrimary.side,
      collectionPrimaryLayOdd: procedurePrimary.layOdd,
      collectionPrimaryCommission: procedurePrimary.commission,
      collectionPrimaryIncrease: procedurePrimary.increase,
      collectionPrimaryCashback: procedurePrimary.cashback,
      collectionPrimaryFreebet: procedurePrimary.freebet,
      collectionProtections: procedureProtections.map((entry) => ({
        stake: entry.stake,
        odd: entry.odd,
        side: entry.side,
        layOdd: entry.layOdd,
        commission: entry.commission,
        increase: entry.increase,
        cashback: entry.cashback,
        freebet: entry.freebet,
      })),
      collectionResultSelections: [],
      freebetCollectionOpen: !asFreebetConversion && !conversionPreset,
      freebetConversionOpen: asFreebetConversion || Boolean(conversionPreset),
      freebetVisibleScope:
        asFreebetConversion || conversionPreset ? "conversion" : "all",
    } satisfies CalculatorProcedureDefaults;
  }

  function openProcedureModal(asFreebetConversion: boolean) {
    setActiveProcedureDefaults(buildProcedureDefaultValues(asFreebetConversion));
    setProcedureModalKey((current) => current + 1);
    setProcedureModalOpen(true);
  }

  function handleNewProcedureClick() {
    if (hasFreebetEntry && !conversionPreset) {
      setProcedureChoiceOpen(true);
      return;
    }

    openProcedureModal(Boolean(conversionPreset));
  }

  function renderMemberInputs(
    path: MemberPath,
    member: CalculatorLineFields,
    memberResult: CalculatorResultLine | undefined,
    compact = false,
  ) {
    const inputPadding = compact ? "py-2.5" : "py-3";
    const hasCustomConfig =
      member.freebet ||
      toNumber(member.aumento_percentual) !== 0 ||
      toNumber(member.comissao_percentual) !== 0 ||
      toNumber(member.cashback_percentual) !== 0;
    const realOddValue = memberResult?.math?.M ?? calculateRealOdd(member);
    const displayedStake = getDisplayedStake(path);
    const displayedResponsabilidade =
      member.responsabilidadeEdited || !memberResult
        ? member.responsabilidade
        : formatCalculatedValue(memberResult.responsabilidade);
    const isBaseMother = path.group === workspaceIndex && path.child === null;
    const isBaseGroup = path.group === workspaceIndex;
    const locked = isMemberLocked(path, member);
    const showLock = !isBaseMother;

    return (
      <div className="flex flex-col gap-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text-secondary)]">Odd</span>
          <div className="relative">
            <input
              className={`lz-input w-full rounded-2xl px-3 ${inputPadding} text-white ${
                hasCustomConfig ? "pr-[7.3rem]" : ""
              }`}
              onChange={(event) => updateMember(path, { odd: event.target.value })}
              step="0.01"
              type="number"
              value={member.odd}
            />
            {hasCustomConfig ? (
              <span className="pointer-events-none absolute right-2 top-1/2 inline-flex max-w-[6.7rem] -translate-y-1/2 items-center truncate rounded-xl border border-[rgba(255,119,163,0.28)] bg-[rgba(216,31,89,0.24)] px-2.5 py-1 text-[11px] font-semibold text-[#fff7fa] shadow-[0_10px_24px_rgba(216,31,89,0.14)] sm:text-xs">
                Real: {formatRealOddValue(realOddValue)}
              </span>
            ) : null}
          </div>
        </label>

        <div
          className={
            hasLayLine ? "flex min-h-[156px] flex-col justify-center gap-4" : "space-y-4"
          }
        >
          {member.tipo === "L" ? (
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--text-secondary)]">Responsabilidade</span>
              <input
                className={`lz-input w-full rounded-2xl px-3 ${inputPadding} text-white`}
                onChange={(event) =>
                  handleResponsabilidadeChange(path, event.target.value)
                }
                step="0.01"
                type="number"
                value={displayedResponsabilidade}
              />
            </label>
          ) : null}

          <div className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text-secondary)]">Stake</span>
            <div className="flex gap-2">
              <div className="relative w-full">
                <input
                  className={`lz-input w-full rounded-2xl px-3 ${inputPadding} text-white ${
                    showLock ? "pr-10" : ""
                  } ${
                    showLock && locked && !isBaseGroup
                      ? "border-[rgba(255,119,163,0.55)]! bg-[rgba(216,31,89,0.08)]!"
                      : ""
                  }`}
                  onChange={(event) => handleStakeChange(path, event.target.value)}
                  step="0.01"
                  type="number"
                  value={displayedStake}
                />
                {showLock ? (
                  <button
                    aria-label={locked ? "Liberar stake" : "Travar stake"}
                    className={`absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition disabled:cursor-default ${
                      locked
                        ? "text-[#ff77a3]"
                        : "text-[var(--text-dim)] hover:text-white"
                    }`}
                    disabled={isBaseGroup}
                    onClick={() => toggleMemberLock(path)}
                    title={
                      isBaseGroup
                        ? "Na casa base a stake é sempre digitada"
                        : locked
                          ? "Stake travada. Clique para calcular automaticamente"
                          : "Stake calculada. Clique para travar"
                    }
                    type="button"
                  >
                    {locked ? (
                      <Lock aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <LockOpen aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>
              <button
                className="lz-button-secondary min-w-11 rounded-2xl px-3 py-2.5 text-sm font-semibold"
                onClick={() => toggleLineType(path)}
                type="button"
              >
                {member.tipo}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderHouseField(
    value: string,
    placeholder: string,
    onValueChange: (house: string) => void,
    compact = false,
  ) {
    return (
      <div className="space-y-2 text-sm">
        <span className="font-medium text-[var(--text-secondary)]">Casa</span>
        <div className={`lz-input flex w-full rounded-2xl px-3 ${compact ? "py-2.5" : "py-3"}`}>
          <BookmakerAutocompleteInput
            bookmakers={bookmakers}
            onValueChange={onValueChange}
            placeholder={placeholder}
            value={value}
          />
        </div>
      </div>
    );
  }

  function renderMemberConfig(
    path: MemberPath,
    member: CalculatorLineFields,
    alwaysOpen = false,
  ) {
    const expanded = alwaysOpen || configExpanded;
    const hasCustomConfig =
      member.freebet ||
      toNumber(member.aumento_percentual) !== 0 ||
      toNumber(member.comissao_percentual) !== 0 ||
      toNumber(member.cashback_percentual) !== 0;

    return (
      <div
        className={`rounded-[24px] border p-3 transition ${
          hasCustomConfig
            ? "border-[rgba(255,119,163,0.24)] bg-[rgba(255,255,255,0.05)]"
            : "border-white/10 bg-white/4"
        }`}
      >
        {alwaysOpen ? (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Configurações
            </p>
            {hasCustomConfig ? (
              <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
            ) : null}
          </div>
        ) : (
        <button
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3"
          onClick={() => setConfigExpanded((current) => !current)}
          type="button"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Configurações
            </p>
            {hasCustomConfig ? (
              <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
            ) : null}
          </div>
            <svg
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-[var(--text-dim)] transition ${
                expanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M6.75 9.75 12 15l5.25-5.25"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
        </button>
        )}

        {expanded ? (
          <div className={alwaysOpen ? "mt-2.5 space-y-1.5" : "mt-3 space-y-2"}>
            <label className={calculatorConfigFieldClass}>
              <span className="min-w-0 text-[var(--text-secondary)]">Aumento (%)</span>
              <input
                className={calculatorConfigInputClass}
                onChange={(event) =>
                  updateMember(path, { aumento_percentual: event.target.value })
                }
                step="0.01"
                type="number"
                value={member.aumento_percentual}
              />
            </label>

            <label className={calculatorConfigFieldClass}>
              <span className="min-w-0 text-[var(--text-secondary)]">Comissão (%)</span>
              <input
                className={calculatorConfigInputClass}
                onChange={(event) =>
                  updateMember(path, { comissao_percentual: event.target.value })
                }
                step="0.01"
                type="number"
                value={member.comissao_percentual}
              />
            </label>

            <label className={calculatorConfigFieldClass}>
              <span className="min-w-0 text-[var(--text-secondary)]">Cashback (%)</span>
              <input
                className={calculatorConfigInputClass}
                onChange={(event) =>
                  updateMember(path, { cashback_percentual: event.target.value })
                }
                step="0.01"
                type="number"
                value={member.cashback_percentual}
              />
            </label>

            <label className={`${calculatorConfigFieldClass} cursor-pointer`}>
              <span className="min-w-0 text-[var(--text-secondary)]">Freebet</span>
              <span className="flex justify-end pr-1">
                <input
                  checked={member.freebet}
                  className="lz-checkbox"
                  onChange={(event) =>
                    updateMember(path, { freebet: event.target.checked })
                  }
                  type="checkbox"
                />
              </span>
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="lz-panel flex flex-wrap items-center gap-3 rounded-[28px] p-4">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Casas</p>
        <LzSelect
          className="rounded-full px-4 py-2.5 text-sm font-medium"
          onValueChange={(value) => updateLineCount(Number(value))}
          options={[
            { value: "2", label: "2 casas" },
            { value: "3", label: "3 casas" },
            { value: "4", label: "4 casas" },
            { value: "5", label: "5 casas" },
            { value: "6", label: "6 casas" },
            { value: "7", label: "7 casas" },
            { value: "8", label: "8 casas" },
            { value: "9", label: "9 casas" },
            { value: "10", label: "10 casas" },
          ]}
          value={String(lineCount)}
        />
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid items-start gap-4"
          style={{
            gridTemplateColumns: `repeat(${columnsPerRow}, minmax(220px, 1fr))`,
            minWidth: `${columnsPerRow * 220 + (columnsPerRow - 1) * 16}px`,
          }}
        >
        {lines.flatMap((line, index) => {
          const lineResult = calculation?.linhas?.[index];
          const lineProfit = Number(lineResult?.lucro_liquido ?? 0);
          const lineInvestment =
            Number(lineResult?.custo ?? 0) - Number(lineResult?.cashback ?? 0);
          const roundedLineProfit = roundCurrencyValue(lineProfit);
          const roundedLineInvestment = roundCurrencyValue(lineInvestment);
          const lineRoi =
            lineResult && roundedLineInvestment > 0
              ? (roundedLineProfit / roundedLineInvestment) * 100
              : 0;
          const motherPath: MemberPath = { group: index, child: null };
          const childCount = line.children.length;
          const houseLabel = line.house.trim() || `Casa ${index + 1}`;

          const motherColumn = (
            <div
              className="lz-panel-subtle flex min-w-0 flex-col gap-4 overflow-hidden rounded-[28px] p-4"
              key={`calculator-line-${index}`}
            >
              {renderHouseField(line.house, `Casa ${index + 1}`, (house) =>
                updateLine(index, { house }),
              )}

              {renderMemberInputs(motherPath, line, lineResult)}

              {renderMemberConfig(motherPath, line)}

              <button
                className={`flex w-full items-center justify-between gap-3 rounded-[24px] border px-3 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  childCount > 0
                    ? "border-[rgba(255,119,163,0.24)] bg-[rgba(255,255,255,0.05)]"
                    : "border-white/10 bg-white/4 hover:border-white/20"
                }`}
                disabled={childCount >= MAX_CHILD_LINES}
                onClick={() => addChildLine(index)}
                type="button"
              >
                <span className="inline-flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                  <Scissors aria-hidden="true" className="h-3.5 w-3.5" />
                  Dividir
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                  {childCount === 0
                    ? "Adicionar linha"
                    : `${childCount} ${childCount === 1 ? "linha filha" : "linhas filhas"}`}
                  {childCount < MAX_CHILD_LINES ? (
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : null}
                </span>
              </button>

              <div className="rounded-[24px] border border-white/10 bg-white/4 p-3">
                <div className="mb-3">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Resultado
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Retorno</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(Number(lineResult?.retorno_bruto ?? 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Lucro</span>
                    <span className={`font-semibold ${getProfitClass(lineProfit)}`}>
                      {formatCurrency(lineProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">ROI</span>
                    <span className={`font-semibold ${getProfitClass(lineRoi)}`}>
                      {formatPercent(lineRoi)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={`w-full rounded-[24px] px-4 py-3 text-sm font-semibold transition ${
                  index === workspaceIndex
                    ? "lz-button-primary"
                    : "lz-button-secondary"
                }`}
                onClick={() => fixStake(index, getDisplayedStake(motherPath))}
                type="button"
              >
                {index === workspaceIndex ? "Stake Fixa" : "Fixar Stake"}
              </button>
            </div>
          );

          const childColumns = line.children.map((child, childIndex) => {
            const childPath: MemberPath = { group: index, child: childIndex };
            const childResult = lineResult?.filhas?.[childIndex];

            return (
              <div
                className="lz-panel-subtle relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[28px] px-4 py-3.5 ring-1 ring-inset ring-[rgba(255,119,163,0.22)]"
                key={`calculator-line-${index}-child-${childIndex}`}
              >
                <div className="-mb-2 flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
                    <CornerDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
                    <span className="shrink-0">Filha {childIndex + 1}</span>
                    <span className="truncate text-xs font-normal text-[var(--text-dim)]">
                      · {houseLabel}
                    </span>
                  </p>
                  <button
                    aria-label={`Remover linha filha ${childIndex + 1}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(255,107,133,0.26)] bg-[rgba(255,107,133,0.12)] text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.2)]"
                    onClick={() => removeChildLine(index, childIndex)}
                    type="button"
                  >
                    <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>

                {renderHouseField(
                  child.house,
                  "Casa filha",
                  (house) => updateMember(childPath, { house }),
                  true,
                )}

                {renderMemberInputs(childPath, child, childResult, true)}

                <div className="rounded-[24px] border border-white/10 bg-white/4 p-3">
                  <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
                    Resultado
                  </p>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/4 px-3 py-3 text-sm">
                    <span className="text-[var(--text-secondary)]">Retorno</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(Number(childResult?.retorno_bruto ?? 0))}
                    </span>
                  </div>
                </div>

                {renderMemberConfig(childPath, child, true)}
              </div>
            );
          });

          return [motherColumn, ...childColumns];
        })}
        </div>
      </div>

      {calculationError ? (
        <div className="rounded-[28px] border border-[rgba(255,107,133,0.24)] bg-[rgba(41,13,21,0.94)] px-5 py-4">
          <p className="text-sm font-medium text-[var(--negative)]">Cálculo indisponível</p>
          <p className="mt-2 text-sm leading-7 text-[#f7a1b5]">{calculationError}</p>
        </div>
      ) : calculation ? (
        <div className="lz-panel space-y-4 rounded-[30px] p-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="lz-button-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium"
              onClick={resetCalculator}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </button>

            <button
              aria-label="Copiar cálculo"
              className="lz-button-secondary inline-flex h-11 w-11 items-center justify-center rounded-full p-0 text-[var(--text-secondary)] transition"
              onClick={copyCalculationLink}
              title="Copiar cálculo"
              type="button"
            >
              <CopyIcon />
            </button>

            <button
              className="lz-button-primary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={handleNewProcedureClick}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Novo procedimento</span>
            </button>
          </div>

          <ProcedureModal
            bookmakers={bookmakers}
            defaultValues={activeProcedureDefaults ?? buildProcedureDefaultValues(false)}
            hideTrigger
            key={procedureModalKey}
            onOpenChange={setProcedureModalOpen}
            open={procedureModalOpen}
            returnTo="/calculadora"
            submitLabel="Criar procedimento"
            title="Novo procedimento"
          />

          <ConfirmationDialog
            description="Você marcou Freebet na calculadora. Quer abrir o procedimento como conversão de freebet?"
            onOpenChange={setProcedureChoiceOpen}
            open={procedureChoiceOpen}
            title="Criar como conversão?"
          >
            <div className="flex flex-wrap justify-end gap-3">
              <button
                className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
                onClick={() => {
                  setProcedureChoiceOpen(false);
                  openProcedureModal(false);
                }}
                type="button"
              >
                Abrir SureBet
              </button>
              <button
                className="lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
                onClick={() => {
                  setProcedureChoiceOpen(false);
                  openProcedureModal(true);
                }}
                type="button"
              >
                Abrir conversão
              </button>
            </div>
          </ConfirmationDialog>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">Stake total</p>
              <p className="mt-2 text-xl font-semibold text-white md:text-2xl">
                {formatCurrency(stakeTotal)}
              </p>
            </div>

            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">Lucro</p>
              <p className={`mt-2 text-xl font-semibold ${getProfitClass(calculation.lucro_liquido)} md:text-2xl`}>
                {formatCurrency(calculation.lucro_liquido)}
              </p>
            </div>

            <div className="lz-panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-[var(--text-dim)]">Lucro %</p>
              <p className="mt-2 text-xl font-semibold text-white md:text-2xl">
                {calculation.lucro_percentual.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
