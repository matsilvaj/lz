"use client";

import { PROCEDURE_TYPES, FREEBET_CONDITIONS } from "@/core";
import { useId, useState } from "react";

import { saveProcedureAction, updateProcedureAction } from "../procedure-actions";

type ProcedureType = (typeof PROCEDURE_TYPES)[number];

type ProcedureModalProps = {
  mode?: "create" | "edit";
  procedureId?: number;
  triggerLabel: string;
  triggerClassName?: string;
  title?: string;
  submitLabel?: string;
  returnTo: string;
  typeOptions?: ProcedureType[];
  bookmakers?: string[];
  onTrigger?: () => void;
  defaultValues?: {
    procedureType?: ProcedureType;
    operationDate?: string;
    referenceMonth?: string;
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

function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ProcedureModal({
  mode = "create",
  procedureId,
  triggerLabel,
  triggerClassName,
  title = "Novo Procedimento",
  submitLabel = "Criar procedimento",
  returnTo,
  typeOptions = PROCEDURE_TYPES,
  bookmakers = [],
  onTrigger,
  defaultValues,
}: ProcedureModalProps) {
  const [open, setOpen] = useState(false);
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
  const housesListId = useId();
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

  return (
    <>
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

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
              </div>

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
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-neutral-900">Casa da freebet</span>
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                      defaultValue={defaultValues?.freebetHouse ?? ""}
                      list={housesListId}
                      name="freebetHouse"
                      placeholder="Casa da freebet"
                      readOnly={isConversionOnly}
                      required
                      type="text"
                    />
                  </label>

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

              <label className="space-y-2 text-sm">
                <span className="font-medium text-neutral-900">Casas envolvidas</span>
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                  defaultValue={defaultValues?.houses ?? ""}
                  disabled={isConversionOnly}
                  list={housesListId}
                  name="houses"
                  placeholder="Separe por virgula"
                  type="text"
                />
                <datalist id={housesListId}>
                  {bookmakers.map((bookmaker) => (
                    <option key={bookmaker} value={bookmaker} />
                  ))}
                </datalist>
              </label>

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

              {!showFreebetBeforeHouses && isFreebetType ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-neutral-900">Casa da freebet</span>
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none transition focus:border-neutral-950"
                      defaultValue={defaultValues?.freebetHouse ?? ""}
                      list={housesListId}
                      name="freebetHouse"
                      placeholder="Casa da freebet"
                      readOnly={isConversionOnly}
                      required
                      type="text"
                    />
                  </label>

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
        </div>
      ) : null}
    </>
  );
}
