"use client";

import { PROCEDURE_TYPES, FREEBET_CONDITIONS } from "@/core";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { FormSubmitButton } from "@/app/_components/form-submit-button";

import { DatePickerField } from "./date-picker-field";
import { LzSelect } from "./lz-select";
import { saveProcedureAction, updateProcedureAction } from "../procedure-actions";

type ProcedureType = (typeof PROCEDURE_TYPES)[number];

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
  defaultValues?: {
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
  return defaultValues?.procedureType ?? typeOptions[0] ?? "SureBet";
}

function getInitialProtectionKeys(
  defaultValues: ProcedureModalProps["defaultValues"],
) {
  return defaultValues?.protections?.length
    ? defaultValues.protections.map((_, index) => index)
    : [];
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
            className="lz-button-secondary rounded-full px-3 py-1.5 text-sm"
            onClick={handleClose}
            type="button"
          >
            Fechar
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
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProcedureType>(
    getInitialProcedureType(defaultValues, typeOptions),
  );
  const [operationDate, setOperationDate] = useState(
    defaultValues?.operationDate ?? getTodayInputValue(),
  );
  const [equalProfitEnabled, setEqualProfitEnabled] = useState(
    defaultValues?.equalProfit ?? true,
  );
  const [protectionKeys, setProtectionKeys] = useState<number[]>(
    getInitialProtectionKeys(defaultValues),
  );
  const [noteExpanded, setNoteExpanded] = useState(Boolean(defaultValues?.note));
  const [noteValue, setNoteValue] = useState(defaultValues?.note ?? "");
  const [selectedHouses, setSelectedHouses] = useState<string[]>(
    parseHouseList(defaultValues?.houses),
  );
  const [selectedFreebetHouse, setSelectedFreebetHouse] = useState(
    defaultValues?.freebetHouse ?? "",
  );
  const [autoIncludedFreebetHouse, setAutoIncludedFreebetHouse] = useState("");
  const [housesPickerOpen, setHousesPickerOpen] = useState(false);
  const [freebetHousePickerOpen, setFreebetHousePickerOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const isFreebetType =
    selectedType === "Coletar Freebet" || selectedType === "Converter Freebet";
  const isConversionOnly =
    typeOptions.length === 1 && typeOptions[0] === "Converter Freebet";
  const supportsGame = selectedType !== "Cassino";
  const supportsDouble =
    selectedType === "Tentativa de Duplo" || isFreebetType;
  const supportsProfitDistribution = selectedType !== "Cassino";
  const supportsFreebetCondition = selectedType === "Coletar Freebet";
  const showFreebetBeforeHouses = isFreebetType;

  function toggleSelectedHouse(value: string) {
    setSelectedHouses((current) => {
      const isRemoving = current.includes(value);

      if (isRemoving && value === autoIncludedFreebetHouse) {
        setAutoIncludedFreebetHouse("");
      }

      return isRemoving
        ? current.filter((item) => item !== value)
        : [...current, value];
    });
  }

  function clearSelectedHouses() {
    setSelectedHouses([]);
    setAutoIncludedFreebetHouse("");
  }

  function toggleSelectedFreebetHouse(value: string) {
    setSelectedFreebetHouse((current) => {
      const nextValue = current === value ? "" : value;

      if (selectedType === "Coletar Freebet") {
        setSelectedHouses((currentHouses) => {
          let nextHouses = currentHouses;

          if (autoIncludedFreebetHouse) {
            nextHouses = nextHouses.filter((item) => item !== autoIncludedFreebetHouse);
          }

          if (nextValue && !nextHouses.includes(nextValue)) {
            nextHouses = [...nextHouses, nextValue];
          }

          return nextHouses;
        });
        setAutoIncludedFreebetHouse(nextValue);
      }

      return nextValue;
    });
  }

  function clearSelectedFreebetHouse() {
    if (selectedType === "Coletar Freebet" && autoIncludedFreebetHouse) {
      setSelectedHouses((current) =>
        current.filter((item) => item !== autoIncludedFreebetHouse),
      );
      setAutoIncludedFreebetHouse("");
    }

    setSelectedFreebetHouse("");
  }

  function resetFormState() {
    setSelectedType(getInitialProcedureType(defaultValues, typeOptions));
    setOperationDate(defaultValues?.operationDate ?? getTodayInputValue());
    setEqualProfitEnabled(defaultValues?.equalProfit ?? true);
    setProtectionKeys(getInitialProtectionKeys(defaultValues));
    setNoteExpanded(Boolean(defaultValues?.note));
    setNoteValue(defaultValues?.note ?? "");
    setSelectedHouses(parseHouseList(defaultValues?.houses));
    setSelectedFreebetHouse(defaultValues?.freebetHouse ?? "");
    setAutoIncludedFreebetHouse("");
    setHousesPickerOpen(false);
    setFreebetHousePickerOpen(false);
  }

  function setOpen(nextValue: boolean) {
    onOpenChange?.(nextValue);

    if (controlledOpen === undefined) {
      setInternalOpen(nextValue);
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
          <div className="lz-panel w-full max-w-3xl rounded-[34px] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">{title}</h2>

              <button
                className="lz-button-secondary rounded-full p-2"
                onClick={() => setOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            <form
              action={mode === "edit" ? updateProcedureAction : saveProcedureAction}
              className="space-y-6 px-6 py-6"
            >
              <input name="returnTo" type="hidden" value={returnTo} />
              <input name="houses" type="hidden" value={selectedHouses.join(", ")} />
              <input
                name="freebetHouse"
                type="hidden"
                value={selectedFreebetHouse}
              />

              {mode === "edit" && procedureId ? (
                <input name="procedureId" type="hidden" value={procedureId} />
              ) : null}
              {defaultValues?.originIds?.map((originId) => (
                <input key={originId} name="originIds" type="hidden" value={originId} />
              ))}

              <div className="space-y-3">
                <p className="text-sm font-medium text-white">Tipo de procedimento</p>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map((type) => {
                    const active = selectedType === type;

                    return (
                      <button
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          active ? "lz-button-primary" : "lz-button-secondary"
                        }`}
                        key={type}
                        onClick={() => {
                          setSelectedType(type);
                          if (type === "Cassino") {
                            setEqualProfitEnabled(true);
                          }
                        }}
                        type="button"
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
                <input name="procedureType" type="hidden" value={selectedType} />
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
                      defaultValue={defaultValues?.game ?? ""}
                      name="game"
                      placeholder="Ex.: Seattle Sounders"
                      type="text"
                    />
                  </label>
                ) : null}
              </div>

              {showFreebetBeforeHouses ? (
                <div className="grid gap-4 md:grid-cols-2">
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
                      defaultValue={defaultValues?.freebetValue ?? ""}
                      name="freebetValue"
                      placeholder="0,00"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>

                  {supportsFreebetCondition ? (
                    <label className="space-y-2 text-sm md:col-span-2">
                      <span className="font-medium text-white">Condição da freebet</span>
                      <LzSelect
                        className="w-full rounded-2xl px-3 py-3"
                        defaultValue={
                          defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0]
                        }
                        name="freebetCondition"
                        options={FREEBET_CONDITIONS.map((condition) => ({
                          value: condition,
                          label: condition,
                        }))}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/4 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">Casas envolvidas</span>
                  <button
                    className="lz-button-secondary rounded-full px-3 py-2 text-sm font-medium"
                    onClick={() => setHousesPickerOpen(true)}
                    type="button"
                  >
                    Escolher casa
                  </button>
                </div>

                {selectedHouses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedHouses.map((house) => (
                      <button
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:border-white/20"
                        key={house}
                        onClick={() => toggleSelectedHouse(house)}
                        type="button"
                      >
                        {house}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">Nenhuma casa selecionada.</p>
                )}
              </div>

              <div className={`grid gap-4 ${supportsProfitDistribution ? "md:grid-cols-[1.1fr,0.9fr]" : "md:grid-cols-1"}`}>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Lucro da entrada</span>
                  <input
                    className="lz-input w-full rounded-2xl px-3 py-3"
                    defaultValue={defaultValues?.entryValue ?? ""}
                    name="entryValue"
                    placeholder="0,00"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>

                {supportsProfitDistribution ? (
                  <label className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/4 px-4 py-3 text-sm">
                    <input
                      checked={equalProfitEnabled}
                      name="equalProfit"
                      onChange={(event) => setEqualProfitEnabled(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="font-medium text-white">
                      Lucro Igual nas Proteções
                    </span>
                  </label>
                ) : null}
              </div>

              {supportsProfitDistribution && !equalProfitEnabled ? (
                <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">Lucro nas Proteções</p>
                    <button
                      className="text-sm text-[var(--text-dim)] transition hover:text-white"
                      onClick={() =>
                        setProtectionKeys((current) => [...current, Date.now() + current.length])
                      }
                      type="button"
                    >
                      Adicionar proteção
                    </button>
                  </div>

                  {protectionKeys.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      Use apenas se precisar distribuir o lucro entre proteções.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {protectionKeys.map((key, index) => (
                        <div className="flex items-center gap-3" key={key}>
                          <input
                            className="lz-input flex-1 rounded-2xl px-3 py-3 text-sm"
                            defaultValue={defaultValues?.protections?.[index] ?? ""}
                            name="protections"
                            placeholder={`Lucro na proteção ${index + 1}`}
                            step="0.01"
                            type="number"
                          />
                          <button
                            className="text-sm text-[var(--text-dim)] transition hover:text-[var(--negative)]"
                            onClick={() =>
                              setProtectionKeys((current) => current.filter((item) => item !== key))
                            }
                            type="button"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {supportsDouble ? (
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-white">Valor do duplo</span>
                  <input
                    className="lz-input w-full rounded-2xl px-3 py-3"
                    defaultValue={defaultValues?.doubleValue ?? ""}
                    name="doubleValue"
                    placeholder="0,00"
                    step="0.01"
                    type="number"
                  />
                </label>
              ) : null}

              <input name="note" type="hidden" value={noteValue} />

              {noteExpanded ? (
                <div className="mt-2 space-y-3 rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">Observações</p>
                    <button
                      className="text-sm text-[var(--text-dim)] transition hover:text-white"
                      onClick={() => setNoteExpanded(false)}
                      type="button"
                    >
                      Recolher observações
                    </button>
                  </div>

                  <textarea
                    className="lz-textarea min-h-28 w-full rounded-2xl px-3 py-3 text-sm"
                    onChange={(event) => setNoteValue(event.target.value)}
                    placeholder="Adicione qualquer contexto importante"
                    value={noteValue}
                  />
                </div>
              ) : (
                <button
                  className="mt-1 text-left text-sm font-medium text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => setNoteExpanded(true)}
                  type="button"
                >
                  Adicionar observações
                </button>
              )}

              <div className="flex items-center justify-end gap-3">
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
            multiple
            onClear={clearSelectedHouses}
            onClose={() => setHousesPickerOpen(false)}
            onToggle={toggleSelectedHouse}
            open={housesPickerOpen}
            options={bookmakers}
            selectedValues={selectedHouses}
            title="Escolher casas"
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
