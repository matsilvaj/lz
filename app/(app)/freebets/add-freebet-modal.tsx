"use client";

import { FREEBET_CONDITIONS } from "@/core";
import { createPortal } from "react-dom";
import { useMemo, useState } from "react";

import { DatePickerField } from "../_components/date-picker-field";
import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { saveProcedureAction } from "../procedure-actions";

type AddFreebetModalProps = {
  bookmakers: string[];
};

type HousePickerDialogProps = {
  open: boolean;
  options: string[];
  selectedValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  onClear: () => void;
};

function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function HousePickerDialog({
  open,
  options,
  selectedValue,
  onClose,
  onSelect,
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

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleClose() {
    setSearch("");
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="lz-panel w-full max-w-xl rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold text-white">Escolher casa</h3>

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
                const active = selectedValue === option;

                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={option}
                    onClick={() => {
                      onSelect(option);
                      handleClose();
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
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AddFreebetModal({ bookmakers }: AddFreebetModalProps) {
  const [open, setOpen] = useState(false);
  const [operationDate, setOperationDate] = useState(getTodayInputValue());
  const [selectedHouse, setSelectedHouse] = useState("");
  const [housePickerOpen, setHousePickerOpen] = useState(false);

  function resetForm() {
    setOperationDate(getTodayInputValue());
    setSelectedHouse("");
    setHousePickerOpen(false);
  }

  return (
    <>
      <button
        className="lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        type="button"
      >
        Adicionar freebet
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
              <div className="flex min-h-full items-start justify-center py-2 md:py-4">
                <div className="lz-panel w-full max-w-2xl rounded-[34px] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">Adicionar freebet</h2>

                    <button
                      className="lz-button-secondary rounded-full p-2"
                      onClick={() => setOpen(false)}
                      type="button"
                    >
                      Fechar
                    </button>
                  </div>

                  <form action={saveProcedureAction} className="space-y-6 px-6 py-6">
                    <input name="procedureType" type="hidden" value="Coletar Freebet" />
                    <input name="returnTo" type="hidden" value="/freebets" />
                    <input name="houses" type="hidden" value={selectedHouse} />
                    <input name="freebetHouse" type="hidden" value={selectedHouse} />
                    <input
                      name="freebetCondition"
                      type="hidden"
                      value={FREEBET_CONDITIONS[0]}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Data</span>
                        <DatePickerField
                          name="operationDate"
                          onChange={setOperationDate}
                          value={operationDate}
                        />
                      </label>

                      <div className="space-y-2 text-sm">
                        <span className="font-medium text-white">Casa</span>
                        <button
                          className="lz-button-secondary w-full rounded-2xl px-3 py-3 text-left"
                          onClick={() => setHousePickerOpen(true)}
                          type="button"
                        >
                          {selectedHouse || "Escolher casa"}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Valor da freebet</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          name="freebetValue"
                          placeholder="0,00"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>

                      <label className="space-y-2 text-sm">
                        <span className="font-medium text-white">Lucro base</span>
                        <input
                          className="lz-input w-full rounded-2xl px-3 py-3"
                          name="entryValue"
                          placeholder="0,00"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                    </div>

                    {selectedHouse ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          Casa selecionada
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">{selectedHouse}</p>
                      </div>
                    ) : null}

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
                        disabled={!selectedHouse}
                        pendingLabel="Salvando..."
                      >
                        Salvar freebet
                      </FormSubmitButton>
                    </div>
                  </form>
                </div>

                <HousePickerDialog
                  onClear={() => setSelectedHouse("")}
                  onClose={() => setHousePickerOpen(false)}
                  onSelect={setSelectedHouse}
                  open={housePickerOpen}
                  options={bookmakers}
                  selectedValue={selectedHouse}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
