"use client";

import { PROCEDURE_TYPES } from "@/core";
import {
  type Dispatch,
  type SetStateAction,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { DatePickerField } from "../_components/date-picker-field";
import { ProcedureModal } from "../_components/procedure-modal";
import { EmptyState, StatusTag, formatCurrency } from "../_components/ui";
import { ProcedureDoubleToggle } from "./procedure-double-toggle";
import { ProcedureRowActions } from "./procedure-row-actions";

type ProcedureRow = {
  id: number;
  data_operacao: string;
  tipo_procedimento: string;
  jogo_time_pa: string;
  casas_envolvidas: string;
  lucro_final: number;
  bateu_duplo: boolean;
  lucro_real: number;
  observacao: string;
  valor_freebet_coletada: number;
  casa_destino_freebet: string;
  valor_da_freebet: number;
  condicao_freebet: string;
};

type ProceduresWorkspaceProps = {
  bookmakers: string[];
  procedures: ProcedureRow[];
};

function supportsDouble(procedureType: string) {
  return ["Tentativa de Duplo", "Coletar Freebet", "Converter Freebet"].includes(
    procedureType,
  );
}

function matchesSelectedHouse(houses: string, selectedHouses: string[]) {
  if (selectedHouses.length === 0) {
    return true;
  }

  const normalizedHouses = String(houses ?? "").toLowerCase();
  return selectedHouses.some((house) => normalizedHouses.includes(house.toLowerCase()));
}

function parseOperationDate(value: string) {
  const [day, month, year] = String(value ?? "").split("/").map(Number);

  if (!day || !month || !year) {
    return 0;
  }

  return year * 10000 + month * 100 + day;
}

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProceduresWorkspace({
  bookmakers,
  procedures,
}: ProceduresWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedHouses, setSelectedHouses] = useState<string[]>([]);
  const [housesOpen, setHousesOpen] = useState(false);
  const [houseSearch, setHouseSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const housesTriggerRef = useRef<HTMLButtonElement>(null);
  const housesPopoverRef = useRef<HTMLDivElement>(null);
  const [housesPopoverPosition, setHousesPopoverPosition] = useState({
    left: 16,
    top: 16,
    width: 320,
  });
  const deferredSearch = useDeferredValue(search);
  const deferredHouseSearch = useDeferredValue(houseSearch);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const normalizedHouseSearch = deferredHouseSearch.trim().toLowerCase();
  const visibleBookmakers = bookmakers.filter((bookmaker) =>
    bookmaker.toLowerCase().includes(normalizedHouseSearch),
  );

  useEffect(() => {
    if (!housesOpen) {
      return;
    }

    function syncPosition() {
      const rect = housesTriggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const nextWidth = clamp(Math.max(rect.width, 320), 320, 420);
      setHousesPopoverPosition({
        left: clamp(rect.left, 16, window.innerWidth - nextWidth - 16),
        top: rect.bottom + 12,
        width: nextWidth,
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        housesTriggerRef.current?.contains(target) ||
        housesPopoverRef.current?.contains(target)
      ) {
        return;
      }

      setHousesOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHousesOpen(false);
      }
    }

    const animationFrame = window.requestAnimationFrame(syncPosition);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [housesOpen]);

  const filteredProcedures = procedures.filter((procedure) => {
    const matchesSearch =
      !normalizedSearch ||
      procedure.tipo_procedimento.toLowerCase().includes(normalizedSearch) ||
      procedure.jogo_time_pa.toLowerCase().includes(normalizedSearch) ||
      procedure.casas_envolvidas.toLowerCase().includes(normalizedSearch);

    const matchesType =
      selectedTypes.length === 0 || selectedTypes.includes(procedure.tipo_procedimento);

    const operationDate = parseOperationDate(procedure.data_operacao);
    const fromDate = dateFrom ? Number(dateFrom.replaceAll("-", "")) : 0;
    const toDate = dateTo ? Number(dateTo.replaceAll("-", "")) : 99999999;
    const matchesDate = operationDate >= fromDate && operationDate <= toDate;

    return (
      matchesSearch &&
      matchesType &&
      matchesSelectedHouse(procedure.casas_envolvidas, selectedHouses) &&
      matchesDate
    );
  });
  const activeFiltersCount =
    selectedTypes.length +
    selectedHouses.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  function toggleSelection(
    value: string,
    setValues: Dispatch<SetStateAction<string[]>>,
  ) {
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <div className="space-y-5">
      <div className="lz-panel flex flex-col gap-3 rounded-[28px] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm sm:max-w-xl"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogo, tipo ou casa..."
            type="search"
            value={search}
          />

          <button
            className={`rounded-full px-4 py-3 text-sm font-medium transition ${
              filtersOpen || activeFiltersCount > 0 ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            {activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : "Filtros"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <ProcedureModal
            bookmakers={bookmakers}
            returnTo="/procedimentos"
            triggerClassName="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
            triggerLabel="Novo procedimento"
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="lz-panel overflow-visible grid gap-4 rounded-[28px] p-4 lg:grid-cols-[1.3fr,1fr,1fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Tipos</p>
              {selectedTypes.length > 0 ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => setSelectedTypes([])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {PROCEDURE_TYPES.map((type) => {
                const active = selectedTypes.includes(type);

                return (
                  <button
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={type}
                    onClick={() => toggleSelection(type, setSelectedTypes)}
                    type="button"
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Casas</p>
              {selectedHouses.length > 0 ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => setSelectedHouses([])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className={housesOpen ? "z-30" : "z-10"}>
              <button
                className="lz-button-secondary w-full rounded-2xl px-4 py-3 text-left text-sm"
                onClick={() => setHousesOpen((current) => !current)}
                ref={housesTriggerRef}
                type="button"
              >
                {selectedHouses.length > 0
                  ? `${selectedHouses.length} casa(s) selecionada(s)`
                  : "Selecionar casas"}
              </button>

              {housesOpen && typeof document !== "undefined"
                ? createPortal(
                    <div
                      className="fixed z-[70] rounded-[26px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
                      ref={housesPopoverRef}
                      style={{
                        left: housesPopoverPosition.left,
                        top: housesPopoverPosition.top,
                        width: housesPopoverPosition.width,
                      }}
                    >
                  <input
                    className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                    onChange={(event) => setHouseSearch(event.target.value)}
                    placeholder="Buscar casa..."
                    type="search"
                    value={houseSearch}
                  />

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {visibleBookmakers.length > 0 ? (
                      visibleBookmakers.map((bookmaker) => {
                        const active = selectedHouses.includes(bookmaker);

                        return (
                          <button
                            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                              active ? "lz-button-primary" : "lz-button-secondary"
                            }`}
                            key={bookmaker}
                            onClick={() => toggleSelection(bookmaker, setSelectedHouses)}
                            type="button"
                          >
                            <span>{bookmaker}</span>
                            {active ? <span>Selecionada</span> : null}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-1 py-2 text-sm text-[var(--text-muted)]">
                        Nenhuma casa encontrada.
                      </p>
                    )}
                  </div>
                    </div>,
                    document.body,
                  )
                : null}

              {selectedHouses.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedHouses.map((house) => (
                    <button
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:border-white/20"
                      key={house}
                      onClick={() => toggleSelection(house, setSelectedHouses)}
                      type="button"
                    >
                      {house}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Período</p>
              {dateFrom || dateTo ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-muted)]">De</span>
                <DatePickerField
                  onChange={setDateFrom}
                  value={dateFrom}
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-muted)]">Até</span>
                <DatePickerField
                  onChange={setDateTo}
                  value={dateTo}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lz-panel rounded-[30px] p-4 md:p-6">
        {filteredProcedures.length === 0 ? (
          <EmptyState
            action={
              procedures.length === 0 ? (
                <ProcedureModal
                  bookmakers={bookmakers}
                  returnTo="/procedimentos"
                  triggerClassName="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                  triggerLabel="Registrar primeiro procedimento"
                />
              ) : null
            }
            description={
              procedures.length === 0
                ? "Assim que voce registrar a primeira operação, esta area passa a mostrar a linha do tempo completa."
                : "Ajuste a busca ou limpe os filtros para voltar a visualizar os procedimentos."
            }
            eyebrow={procedures.length === 0 ? "Primeiros passos" : "Sem resultados"}
            title={
              procedures.length === 0
                ? "Nenhum procedimento registrado"
                : "Nenhum procedimento encontrado"
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:hidden">
              {filteredProcedures.map((procedure) => (
                <article
                  className="rounded-[26px] border border-white/10 bg-white/5 p-4"
                  key={procedure.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        {procedure.data_operacao}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusTag>{procedure.tipo_procedimento}</StatusTag>
                        {procedure.observacao?.trim() ? (
                          <StatusTag tone="warning">Com observação</StatusTag>
                        ) : null}
                      </div>
                    </div>

                    <ProcedureRowActions bookmakers={bookmakers} procedure={procedure} />
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-[var(--text-dim)]">Jogo</p>
                      <p className="mt-1 text-white">{procedure.jogo_time_pa || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-dim)]">Casas</p>
                      <p className="mt-1 text-white">{procedure.casas_envolvidas || "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Lucro da entrada
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${getProfitClass(procedure.lucro_final)}`}>
                        {formatCurrency(procedure.lucro_final)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Lucro final
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${getProfitClass(procedure.lucro_real)}`}>
                        {formatCurrency(procedure.lucro_real)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm">
                      <p className="text-[var(--text-dim)]">Duplo</p>
                      <div className="mt-2">
                        {supportsDouble(procedure.tipo_procedimento) ? (
                          <ProcedureDoubleToggle
                            checked={procedure.bateu_duplo}
                            procedureId={procedure.id}
                          />
                        ) : (
                          <span className="text-[var(--text-secondary)]">Não se aplica</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="text-[var(--text-dim)]">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-center font-medium">Data</th>
                    <th className="px-3 py-3 text-center font-medium">Tipo</th>
                    <th className="px-3 py-3 text-center font-medium">Jogo</th>
                    <th className="px-3 py-3 text-center font-medium">Casas</th>
                    <th className="px-3 py-3 text-center font-medium">Lucro da entrada</th>
                    <th className="px-3 py-3 text-center font-medium">Duplo?</th>
                    <th className="px-3 py-3 text-center font-medium">Lucro final</th>
                    <th className="px-3 py-3 text-center font-medium">
                      <span className="sr-only">Acoes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcedures.map((procedure) => (
                    <tr
                      className="border-b border-white/8 align-middle transition hover:bg-white/4"
                      key={procedure.id}
                    >
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        {procedure.data_operacao}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <StatusTag>{procedure.tipo_procedimento}</StatusTag>
                          {procedure.observacao?.trim() ? (
                            <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center text-white">
                        {procedure.jogo_time_pa || "-"}
                      </td>
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        {procedure.casas_envolvidas || "-"}
                      </td>
                      <td
                        className={`px-3 py-4 text-center font-medium ${getProfitClass(procedure.lucro_final)}`}
                      >
                        {formatCurrency(procedure.lucro_final)}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          {supportsDouble(procedure.tipo_procedimento) ? (
                            <ProcedureDoubleToggle
                              checked={procedure.bateu_duplo}
                              procedureId={procedure.id}
                            />
                          ) : (
                            <span className="text-[var(--text-dim)]">-</span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-3 py-4 text-center font-semibold ${getProfitClass(procedure.lucro_real)}`}
                      >
                        {formatCurrency(procedure.lucro_real)}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          <ProcedureRowActions
                            bookmakers={bookmakers}
                            procedure={procedure}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
