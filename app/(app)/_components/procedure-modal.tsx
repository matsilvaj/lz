"use client";

import { PROCEDURE_TYPES, FREEBET_CONDITIONS } from "@/core";
import { useMemo, useState } from "react";

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

  function handleClose() {
    setSearch("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/60 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-neutral-950">{title}</h3>

          <button
            className="rounded-full px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            onClick={handleClose}
            type="button"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <input
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar casa..."
            type="search"
            value={search}
          />

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleOptions.length === 0 ? (
              <p className="px-1 py-3 text-sm text-neutral-500">
                Nenhuma casa encontrada.
              </p>
            ) : (
              visibleOptions.map((option) => {
                const active = selectedValues.includes(option);

                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                      active
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
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

          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
            <button
              className="text-sm text-neutral-500 transition hover:text-neutral-950"
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
                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                onClick={handleClose}
                type="button"
              >
                Concluir
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
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
    defaultValues?.procedureType ?? typeOptions[0] ?? "SureBet",
  );
  const [equalProfitEnabled, setEqualProfitEnabled] = useState(
    defaultValues?.equalProfit ?? true,
  );
  const [protectionKeys, setProtectionKeys] = useState<number[]>(
    defaultValues?.protections?.length
      ? defaultValues.protections.map((_, index) => index)
      : [],
  );
  const [noteExpanded, setNoteExpanded] = useState(Boolean(defaultValues?.note));
  const [noteValue, setNoteValue] = useState(defaultValues?.note ?? "");
  const [selectedHouses, setSelectedHouses] = useState<string[]>(
    parseHouseList(defaultValues?.houses),
  );
  const [selectedFreebetHouse, setSelectedFreebetHouse] = useState(
    defaultValues?.freebetHouse ?? "",
  );
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
    setSelectedHouses((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function clearSelectedHouses() {
    setSelectedHouses([]);
  }

  function toggleSelectedFreebetHouse(value: string) {
    setSelectedFreebetHouse((current) => (current === value ? "" : value));
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
            "rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          }
          onClick={() => {
            onTrigger?.();
            setOpen(true);
          }}
          type="button"
        >
          {triggerLabel}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>

              <button
                className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
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
                <p className="text-sm font-medium text-neutral-900">Tipo de procedimento</p>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map((type) => {
                    const active = selectedType === type;

                    return (
                      <button
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-neutral-950 text-white"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
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
                  <span className="font-medium text-neutral-900">Data</span>
                  <input
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                    defaultValue={defaultValues?.operationDate ?? getTodayInputValue()}
                    name="operationDate"
                    type="date"
                  />
                </label>

                {supportsGame ? (
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-neutral-900">Jogo</span>
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
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
                    <span className="font-medium text-neutral-900">Casa da freebet</span>
                    <button
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        isConversionOnly
                          ? "cursor-default border-neutral-200 bg-neutral-50 text-neutral-500"
                          : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-950"
                      }`}
                      disabled={isConversionOnly}
                      onClick={() => setFreebetHousePickerOpen(true)}
                      type="button"
                    >
                      {selectedFreebetHouse || "Escolher casa"}
                    </button>
                  </div>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-neutral-900">Valor da freebet</span>
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
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
                      <span className="font-medium text-neutral-900">Condicao da freebet</span>
                      <select
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                        defaultValue={
                          defaultValues?.freebetCondition ?? FREEBET_CONDITIONS[0]
                        }
                        name="freebetCondition"
                      >
                        {FREEBET_CONDITIONS.map((condition) => (
                          <option key={condition} value={condition}>
                            {condition}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-neutral-900">Casas envolvidas</span>
                  <button
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
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
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700 transition hover:border-neutral-400"
                        key={house}
                        onClick={() => toggleSelectedHouse(house)}
                        type="button"
                      >
                        {house}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Nenhuma casa selecionada.</p>
                )}
              </div>

              <div className={`grid gap-4 ${supportsProfitDistribution ? "md:grid-cols-[1.1fr,0.9fr]" : "md:grid-cols-1"}`}>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-900">Lucro da entrada</span>
                  <input
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                    defaultValue={defaultValues?.entryValue ?? ""}
                    name="entryValue"
                    placeholder="0,00"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>

                {supportsProfitDistribution ? (
                  <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
                    <input
                      checked={equalProfitEnabled}
                      name="equalProfit"
                      onChange={(event) => setEqualProfitEnabled(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="font-medium text-neutral-900">
                      Lucro Igual nas Protecoes
                    </span>
                  </label>
                ) : null}
              </div>

              {supportsProfitDistribution && !equalProfitEnabled ? (
                <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-900">Lucro nas Protecoes</p>
                    <button
                      className="text-sm text-neutral-600 transition hover:text-neutral-950"
                      onClick={() =>
                        setProtectionKeys((current) => [...current, Date.now() + current.length])
                      }
                      type="button"
                    >
                      Adicionar protecao
                    </button>
                  </div>

                  {protectionKeys.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      Use apenas se precisar distribuir o lucro entre protecoes.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {protectionKeys.map((key, index) => (
                        <div className="flex items-center gap-3" key={key}>
                          <input
                            className="flex-1 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                            defaultValue={defaultValues?.protections?.[index] ?? ""}
                            name="protections"
                            placeholder={`Lucro na protecao ${index + 1}`}
                            step="0.01"
                            type="number"
                          />
                          <button
                            className="text-sm text-neutral-500 transition hover:text-red-600"
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
                  <span className="font-medium text-neutral-900">Valor do duplo</span>
                  <input
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
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
                <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-neutral-900">Observacoes</p>
                    <button
                      className="text-sm text-neutral-600 transition hover:text-neutral-950"
                      onClick={() => setNoteExpanded(false)}
                      type="button"
                    >
                      Recolher observacoes
                    </button>
                  </div>

                  <textarea
                    className="min-h-28 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-950"
                    onChange={(event) => setNoteValue(event.target.value)}
                    placeholder="Adicione qualquer contexto importante"
                    value={noteValue}
                  />
                </div>
              ) : (
                <button
                  className="text-left text-sm font-medium text-neutral-600 transition hover:text-neutral-950"
                  onClick={() => setNoteExpanded(true)}
                  type="button"
                >
                  Adicionar observacoes
                </button>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
                  type="submit"
                >
                  {submitLabel}
                </button>
              </div>
            </form>
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
            onClear={() => setSelectedFreebetHouse("")}
            onClose={() => setFreebetHousePickerOpen(false)}
            onToggle={toggleSelectedFreebetHouse}
            open={freebetHousePickerOpen}
            options={bookmakers}
            selectedValues={selectedFreebetHouse ? [selectedFreebetHouse] : []}
            title="Escolher casa da freebet"
          />
        </div>
      ) : null}
    </>
  );
}
