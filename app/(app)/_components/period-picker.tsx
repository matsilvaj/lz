"use client";

// Seletor de período (dias recentes, meses, anos, tudo e período específico),
// usado pelo Dashboard e pelo Histórico.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DatePickerField } from "./date-picker-field";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PeriodPickerMode = "month" | "year";

const MONTHS = [
  { number: "01", label: "Janeiro", shortLabel: "Jan" },
  { number: "02", label: "Fevereiro", shortLabel: "Fev" },
  { number: "03", label: "Março", shortLabel: "Mar" },
  { number: "04", label: "Abril", shortLabel: "Abr" },
  { number: "05", label: "Maio", shortLabel: "Mai" },
  { number: "06", label: "Junho", shortLabel: "Jun" },
  { number: "07", label: "Julho", shortLabel: "Jul" },
  { number: "08", label: "Agosto", shortLabel: "Ago" },
  { number: "09", label: "Setembro", shortLabel: "Set" },
  { number: "10", label: "Outubro", shortLabel: "Out" },
  { number: "11", label: "Novembro", shortLabel: "Nov" },
  { number: "12", label: "Dezembro", shortLabel: "Dez" },
];

function getPeriodMode(type: string | undefined): PeriodPickerMode {
  if (type === "year") {
    return "year";
  }

  return "month";
}

function parseReferenceMonth(value = "") {
  const [month, year] = value.split("/");

  if (!month || !year) {
    return null;
  }

  return { month, year };
}

function getYearForPeriodOption(
  option: PeriodOption | null,
  fallbackYears: string[],
) {
  if (option?.type === "month") {
    const parsed = parseReferenceMonth(option.value);

    if (parsed?.year) {
      return parsed.year;
    }
  }

  if (option?.type === "year" && option.value) {
    return option.value;
  }

  return fallbackYears[0] ?? String(new Date().getFullYear());
}

function sortYearsDesc(left: string, right: string) {
  return Number(right) - Number(left);
}

export function buildCurrentReferenceMonthId() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `month:${month}/${now.getFullYear()}`;
}

function getCustomPeriodDates(periodId = "") {
  const [type, start, end] = periodId.split(":");

  if (type === "day" && start) {
    return { end: start, start };
  }

  if (type === "range" && start) {
    return { end: end || start, start };
  }

  return { end: "", start: "" };
}

export type PeriodOption = {
  helper: string;
  id: string;
  label: string;
  type: string;
  value: string;
};

export function PeriodPicker({
  currentPeriod,
  id,
  onValueChange,
  options,
  value,
}: {
  currentPeriod: PeriodOption | null;
  id: string;
  onValueChange: (value: string) => void;
  options: PeriodOption[];
  value: string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({
    maxHeight: 480,
    top: 0,
    left: 0,
    width: 360,
  });
  const selectedOption = useMemo(
    () =>
      options.find((option) => option.id === value) ??
      (currentPeriod?.id === value ? currentPeriod : null) ??
      options[0] ??
      null,
    [currentPeriod, options, value],
  );
  const selectedCustomDates = useMemo(
    () => getCustomPeriodDates(selectedOption?.id),
    [selectedOption?.id],
  );
  const [customRangeEnd, setCustomRangeEnd] = useState(selectedCustomDates.end);
  const [customRangeStart, setCustomRangeStart] = useState(selectedCustomDates.start);
  const monthOptions = useMemo(
    () => options.filter((option) => option.type === "month"),
    [options],
  );
  const yearOptions = useMemo(
    () => options.filter((option) => option.type === "year"),
    [options],
  );
  const daysOption = useMemo(
    () => options.find((option) => option.type === "days") ?? null,
    [options],
  );
  const allOption = useMemo(
    () => options.find((option) => option.type === "all") ?? null,
    [options],
  );
  const availableYearValues = useMemo(() => {
    const values = new Set<string>();

    for (const option of yearOptions) {
      if (option.value) {
        values.add(option.value);
      }
    }

    for (const option of monthOptions) {
      const parsed = parseReferenceMonth(option.value);

      if (parsed?.year) {
        values.add(parsed.year);
      }
    }

    return [...values].sort(sortYearsDesc);
  }, [monthOptions, yearOptions]);
  const [activeMode, setActiveMode] = useState<PeriodPickerMode>(
    getPeriodMode(selectedOption?.type),
  );
  const [selectedYear, setSelectedYear] = useState(
    getYearForPeriodOption(selectedOption, availableYearValues),
  );
  const monthOptionByValue = useMemo(
    () => new Map(monthOptions.map((option) => [option.value, option])),
    [monthOptions],
  );
  const selectedPeriodYear = getYearForPeriodOption(selectedOption, availableYearValues);
  const visibleYear = availableYearValues.includes(selectedYear)
    ? selectedYear
    : selectedPeriodYear;

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const viewportPadding = 16;
      const width = Math.min(430, Math.max(rect.width, window.innerWidth - 32));
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(window.innerWidth - width - viewportPadding, viewportPadding),
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const preferredHeight = Math.min(560, window.innerHeight - viewportPadding * 2);
      const opensAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const availableHeight = opensAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(320, Math.min(preferredHeight, availableHeight - 10));

      setPanelStyle({
        maxHeight,
        top: opensAbove
          ? Math.max(viewportPadding, rect.top - maxHeight - 10)
          : rect.bottom + 10,
        left,
        width,
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest("[data-lz-date-picker-popover]")
      ) {
        return;
      }

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
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

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  function handleApplyCustomRange() {
    if (!customRangeStart) {
      return;
    }

    const rawEnd = customRangeEnd || customRangeStart;
    const [start, end] =
      customRangeStart <= rawEnd
        ? [customRangeStart, rawEnd]
        : [rawEnd, customRangeStart];

    onValueChange(`range:${start}:${end}`);
    setOpen(false);
  }

  function handleToggleOpen() {
    if (!open) {
      setActiveMode(getPeriodMode(selectedOption?.type));
      setSelectedYear(selectedPeriodYear);
      setCustomRangeStart(selectedCustomDates.start);
      setCustomRangeEnd(selectedCustomDates.end);
    }

    setOpen((current) => !current);
  }

  const modeTabs = [
    monthOptions.length > 0 ? { id: "month" as const, label: "Mês" } : null,
    yearOptions.length > 0 ? { id: "year" as const, label: "Ano" } : null,
  ].filter(Boolean) as Array<{ id: PeriodPickerMode; label: string }>;

  return (
    <>
      <button
        aria-expanded={open}
        className="lz-select inline-flex w-full min-w-0 items-center justify-between gap-3 rounded-full px-4 py-2 text-left text-sm sm:min-w-[220px]"
        id={id}
        onClick={handleToggleOpen}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 truncate text-[var(--text-primary)]">
          {selectedOption?.label ?? "Selecionar"}
        </span>

        <svg
          aria-hidden="true"
          className={joinClasses(
            "h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90]"
              style={{
                left: `${panelStyle.left}px`,
                top: `${panelStyle.top}px`,
                width: `${panelStyle.width}px`,
              }}
            >
              <div
                className="lz-floating-panel overflow-y-auto rounded-[28px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                ref={panelRef}
                style={{ maxHeight: `${panelStyle.maxHeight}px` }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {daysOption ? (
                    <button
                      className={joinClasses(
                        "rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                        selectedOption?.id === daysOption.id
                          ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.2)] text-white"
                          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => handleSelect(daysOption.id)}
                      type="button"
                    >
                      7 dias
                    </button>
                  ) : null}

                  {allOption ? (
                    <button
                      className={joinClasses(
                        "rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                        selectedOption?.id === allOption.id
                          ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.2)] text-white"
                          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => handleSelect(allOption.id)}
                      type="button"
                    >
                      Tudo
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-white/8 bg-white/[0.035] p-1">
                  {modeTabs.map((tab) => (
                    <button
                      className={joinClasses(
                        "rounded-full px-3 py-2 text-xs font-semibold transition",
                        activeMode === tab.id
                          ? "bg-[rgba(216,31,89,0.32)] text-white shadow-[inset_0_0_0_1px_rgba(255,119,163,0.18)]"
                          : "text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-white",
                      )}
                      key={tab.id}
                      onClick={() => setActiveMode(tab.id)}
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeMode === "month" ? (
                  <div className="mt-3 space-y-3">
                    <div className="lz-scrollbar-hidden flex gap-2 overflow-x-auto pb-1">
                      {availableYearValues.map((year) => (
                        <button
                          className={joinClasses(
                            "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                            visibleYear === year
                              ? "border-[rgba(255,119,163,0.24)] bg-[rgba(216,31,89,0.18)] text-white"
                              : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                          )}
                          key={year}
                          onClick={() => setSelectedYear(year)}
                          type="button"
                        >
                          {year}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {MONTHS.map((month) => {
                        const periodValue = `${month.number}/${visibleYear}`;
                        const option = monthOptionByValue.get(periodValue);
                        const selected = selectedOption?.id === option?.id;

                        return (
                          <button
                            className={joinClasses(
                              "rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition",
                              selected
                                ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.22)] text-white"
                                : option
                                  ? "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                                  : "cursor-not-allowed border-white/5 bg-white/[0.015] text-[var(--text-dim)] opacity-45",
                            )}
                            disabled={!option}
                            key={month.number}
                            onClick={() => option && handleSelect(option.id)}
                            title={month.label}
                            type="button"
                          >
                            {month.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {activeMode === "year" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {yearOptions.map((option) => (
                      <button
                        className={joinClasses(
                          "rounded-[20px] border px-4 py-3 text-left text-sm font-semibold transition",
                          selectedOption?.id === option.id
                            ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.18)] text-white"
                            : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                        )}
                        key={option.id}
                        onClick={() => handleSelect(option.id)}
                        type="button"
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    Período específico
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <DatePickerField
                      className="h-11 rounded-full py-0 text-sm"
                      onChange={setCustomRangeStart}
                      placeholder="Início"
                      value={customRangeStart}
                    />
                    <DatePickerField
                      className="h-11 rounded-full py-0 text-sm"
                      onChange={setCustomRangeEnd}
                      placeholder="Fim"
                      value={customRangeEnd}
                    />
                  </div>

                  <button
                    className="lz-button-secondary mt-3 h-11 w-full rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={!customRangeStart}
                    onClick={handleApplyCustomRange}
                    type="button"
                  >
                    Aplicar período
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
