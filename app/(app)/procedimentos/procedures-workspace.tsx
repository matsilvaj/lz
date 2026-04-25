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

import { ProcedureModal } from "../_components/procedure-modal";
import { EmptyState, formatCurrency } from "../_components/ui";
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
  return [
    "Tentativa de Duplo",
    "Coletar Freebet",
    "Converter Freebet",
  ].includes(procedureType);
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
  const housesPanelRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(search);
  const deferredHouseSearch = useDeferredValue(houseSearch);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const normalizedHouseSearch = deferredHouseSearch.trim().toLowerCase();
  const visibleBookmakers = bookmakers.filter((bookmaker) =>
    bookmaker.toLowerCase().includes(normalizedHouseSearch),
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!housesPanelRef.current?.contains(event.target as Node)) {
        setHousesOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950 sm:max-w-xl"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogo, tipo ou casa..."
            type="search"
            value={search}
          />

          <button
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            {activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : "Filtros"}
          </button>
        </div>

        <ProcedureModal
          bookmakers={bookmakers}
          returnTo="/procedimentos"
          triggerLabel="Novo Procedimento"
        />
      </div>

      {filtersOpen ? (
        <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 lg:grid-cols-[1.3fr,1fr,1fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-900">Tipos</p>
              {selectedTypes.length > 0 ? (
                <button
                  className="text-sm text-neutral-500 transition hover:text-neutral-950"
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
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
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
              <p className="text-sm font-medium text-neutral-900">Casas</p>
              {selectedHouses.length > 0 ? (
                <button
                  className="text-sm text-neutral-500 transition hover:text-neutral-950"
                  onClick={() => setSelectedHouses([])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="relative" ref={housesPanelRef}>
              <button
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-left text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                onClick={() => setHousesOpen((current) => !current)}
                type="button"
              >
                {selectedHouses.length > 0
                  ? `${selectedHouses.length} casa(s) selecionada(s)`
                  : "Selecionar casas"}
              </button>

              {housesOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
                  <input
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
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
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                              active
                                ? "border-neutral-950 bg-neutral-950 text-white"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
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
                      <p className="px-1 py-2 text-sm text-neutral-500">
                        Nenhuma casa encontrada.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedHouses.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedHouses.map((house) => (
                    <button
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700 transition hover:border-neutral-400"
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
              <p className="text-sm font-medium text-neutral-900">Data</p>
              {dateFrom || dateTo ? (
                <button
                  className="text-sm text-neutral-500 transition hover:text-neutral-950"
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
                <span className="text-neutral-600">De</span>
                <input
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-neutral-600">Ate</span>
                <input
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        {filteredProcedures.length === 0 ? (
          <EmptyState
            description="Tente ajustar a busca ou limpar os filtros para voltar a ver os procedimentos."
            title="Nenhum procedimento encontrado"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-center text-sm">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[17%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="text-neutral-500">
                <tr className="border-b border-neutral-200">
                  <th className="px-2 py-3 font-medium">Data</th>
                  <th className="px-2 py-3 font-medium">Tipo</th>
                  <th className="px-2 py-3 font-medium">Jogo</th>
                  <th className="px-2 py-3 font-medium">Casas</th>
                  <th className="px-2 py-3 font-medium">Lucro da entrada</th>
                  <th className="px-2 py-3 font-medium">Duplo?</th>
                  <th className="px-2 py-3 font-medium">Lucro final</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => (
                  <tr className="border-b border-neutral-100 last:border-b-0" key={procedure.id}>
                    <td className="px-2 py-4 text-neutral-700">{procedure.data_operacao}</td>
                    <td className="px-2 py-4 font-medium text-neutral-900">
                      <span className="inline-flex items-center justify-center gap-2">
                        <span>{procedure.tipo_procedimento}</span>
                        {procedure.observacao?.trim() ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-neutral-700">{procedure.jogo_time_pa || "-"}</td>
                    <td className="px-2 py-4 text-neutral-700">
                      {procedure.casas_envolvidas || "-"}
                    </td>
                    <td
                      className={`px-2 py-4 ${
                        procedure.lucro_final >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {formatCurrency(procedure.lucro_final)}
                    </td>
                    <td className="px-2 py-4 text-neutral-700">
                      <div className="flex justify-center">
                        {supportsDouble(procedure.tipo_procedimento) ? (
                          <ProcedureDoubleToggle
                            checked={procedure.bateu_duplo}
                            procedureId={procedure.id}
                          />
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`font-medium ${
                            procedure.lucro_real >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {formatCurrency(procedure.lucro_real)}
                        </span>

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
        )}
      </div>
    </div>
  );
}
