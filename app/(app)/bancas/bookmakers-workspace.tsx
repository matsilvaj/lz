"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { EmptyState } from "../_components/ui";
import {
  deleteBookmakerAction,
  saveBookmakerAction,
  updateBookmakerBalanceAction,
  updateBookmakersNotesAction,
} from "./actions";

type BookmakerItem = {
  nome: string;
  saldo: number;
};

type BookmakersWorkspaceProps = {
  availableBookmakers: string[];
  bookmakers: BookmakerItem[];
  initialNotes: string;
};

function parseBalanceInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function BookmakersWorkspace({
  availableBookmakers,
  bookmakers,
  initialNotes,
}: BookmakersWorkspaceProps) {
  const router = useRouter();
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [setBalance, setSetBalance] = useState(true);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  const selectedBookmakers = useMemo(
    () => new Set(bookmakers.map((bookmaker) => bookmaker.nome.toLowerCase())),
    [bookmakers],
  );

  const suggestions = useMemo(() => {
    const normalizedSearch = name.trim().toLowerCase();
    const workspaceOptions = availableBookmakers.filter(
      (bookmaker) => !selectedBookmakers.has(bookmaker.toLowerCase()),
    );

    if (!normalizedSearch) {
      return workspaceOptions.slice(0, 8);
    }

    return workspaceOptions
      .filter((bookmaker) => bookmaker.toLowerCase().includes(normalizedSearch))
      .slice(0, 8);
  }, [availableBookmakers, name, selectedBookmakers]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!autocompleteRef.current?.contains(event.target as Node)) {
        setAutocompleteOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  async function submitBookmaker(bookmakerName: string) {
    await saveBookmakerAction({ name: bookmakerName });
    setName("");
    setAutocompleteOpen(false);
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName =
      availableBookmakers.find(
        (bookmaker) => bookmaker.toLowerCase() === name.trim().toLowerCase(),
      ) ?? "";

    if (!normalizedName || selectedBookmakers.has(normalizedName.toLowerCase())) {
      return;
    }

    startTransition(async () => {
      await submitBookmaker(normalizedName);
    });
  }

  function handleDelete(bookmakerName: string) {
    startTransition(async () => {
      await deleteBookmakerAction(bookmakerName);
      router.refresh();
    });
  }

  function commitBalance(bookmakerName: string, draftValue: string) {
    const nextBalance = parseBalanceInput(draftValue);
    const currentBookmaker = bookmakers.find(
      (bookmaker) => bookmaker.nome === bookmakerName,
    );
    const currentBalance = currentBookmaker?.saldo ?? 0;

    if (nextBalance === currentBalance) {
      return;
    }

    startTransition(async () => {
      await updateBookmakerBalanceAction({
        name: bookmakerName,
        balance: nextBalance,
      });
      router.refresh();
    });
  }

  function saveNotes() {
    startTransition(async () => {
      await updateBookmakersNotesAction(notes);
      setNotesSaved(notes);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1" ref={autocompleteRef}>
              <input
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                disabled={isPending}
                onChange={(event) => {
                  setName(event.target.value);
                  setAutocompleteOpen(true);
                }}
                onFocus={() => setAutocompleteOpen(true)}
                placeholder="Buscar casa predefinida"
                type="text"
                value={name}
              />

              {autocompleteOpen && suggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {suggestions.map((bookmaker) => (
                      <button
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                        disabled={isPending}
                        key={bookmaker}
                        onClick={() => {
                          startTransition(async () => {
                            await submitBookmaker(bookmaker);
                          });
                        }}
                        type="button"
                      >
                        {bookmaker}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950">
              <input
                checked={setBalance}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-0"
                onChange={(event) => setSetBalance(event.target.checked)}
                type="checkbox"
              />
              Informar saldo
            </label>
          </div>
        </form>

        {bookmakers.length === 0 ? (
          <EmptyState
            description="Selecione as casas da lista predefinida para montar sua area de bancas."
            title="Nenhuma casa selecionada"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookmakers.map((bookmaker) => {
              const balanceInputId = `balance-${bookmaker.nome
                .toLowerCase()
                .replace(/\s+/g, "-")}`;

              return (
                <div
                  className="relative rounded-2xl border border-neutral-200 bg-white p-4"
                  key={bookmaker.nome}
                >
                <button
                    aria-label={`Remover ${bookmaker.nome}`}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-sm text-neutral-400 transition hover:bg-neutral-100 hover:text-red-600"
                    disabled={isPending}
                    onClick={() => handleDelete(bookmaker.nome)}
                    type="button"
                  >
                    x
                  </button>

                  <div className="flex min-h-16 items-center justify-center px-3 text-center">
                    <p className="text-base font-semibold text-neutral-950">
                      {bookmaker.nome}
                    </p>
                  </div>

                  {setBalance ? (
                    <div className="mt-3 space-y-2 text-center">
                      <label
                        className="block text-sm font-medium text-neutral-700"
                        htmlFor={balanceInputId}
                      >
                        Saldo
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                          R$
                        </span>
                        <input
                          className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-11 pr-4 text-center text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                          defaultValue={
                            bookmaker.saldo === 0
                              ? ""
                              : String(bookmaker.saldo).replace(".", ",")
                          }
                          disabled={isPending}
                          id={balanceInputId}
                          inputMode="decimal"
                          key={`${bookmaker.nome}-${bookmaker.saldo}`}
                          onBlur={(event) =>
                            commitBalance(bookmaker.nome, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitBalance(
                                bookmaker.nome,
                                event.currentTarget.value,
                              );
                            }
                          }}
                          placeholder="0,00"
                          type="text"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">Observacoes</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Use este espaco para registrar controles rapidos das suas bancas.
            </p>
          </div>

          <button
            className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || notes === notesSaved}
            onClick={saveNotes}
            type="button"
          >
            Salvar
          </button>
        </div>

        <textarea
          className="mt-4 min-h-[360px] w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anote observacoes importantes sobre limites, saldos, saques ou casas prioritarias."
          value={notes}
        />
      </aside>
    </div>
  );
}
