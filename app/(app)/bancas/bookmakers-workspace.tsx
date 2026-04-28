"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ButtonSpinner } from "@/app/_components/form-submit-button";
import { useToast } from "@/app/_components/toast-provider";

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
  const { showToast } = useToast();
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
    showToast({
      title: "Casa adicionada com sucesso.",
      tone: "success",
    });
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName =
      availableBookmakers.find(
        (bookmaker) => bookmaker.toLowerCase() === name.trim().toLowerCase(),
      ) ?? "";

    if (!normalizedName || selectedBookmakers.has(normalizedName.toLowerCase())) {
      showToast({
        title: "Selecione uma casa valida da lista.",
        tone: "error",
      });
      return;
    }

    startTransition(async () => {
      try {
        await submitBookmaker(normalizedName);
      } catch {
        showToast({
          title: "Não foi possível adicionar a casa.",
          tone: "error",
        });
      }
    });
  }

  function handleDelete(bookmakerName: string) {
    startTransition(async () => {
      try {
        await deleteBookmakerAction(bookmakerName);
        showToast({
          title: "Casa removida.",
          tone: "success",
        });
        router.refresh();
      } catch {
        showToast({
          title: "Não foi possível remover a casa.",
          tone: "error",
        });
      }
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
      try {
        await updateBookmakerBalanceAction({
          name: bookmakerName,
          balance: nextBalance,
        });
        showToast({
          title: "Saldo atualizado.",
          tone: "success",
        });
        router.refresh();
      } catch {
        showToast({
          title: "Não foi possível atualizar o saldo.",
          tone: "error",
        });
      }
    });
  }

  function saveNotes() {
    startTransition(async () => {
      try {
        await updateBookmakersNotesAction(notes);
        setNotesSaved(notes);
        showToast({
          title: "Observações salvas.",
          tone: "success",
        });
        router.refresh();
      } catch {
        showToast({
          title: "Não foi possível salvar as observações.",
          tone: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="lz-panel space-y-4 rounded-[30px] p-4 md:p-6">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1" ref={autocompleteRef}>
                <input
                  className="lz-input w-full rounded-2xl px-4 py-3 text-sm"
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
                  <div className="absolute left-0 right-0 top-full z-20 mt-3 rounded-[24px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {suggestions.map((bookmaker) => (
                        <button
                          className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                          disabled={isPending}
                          key={bookmaker}
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await submitBookmaker(bookmaker);
                              } catch {
                                showToast({
                                  title: "Não foi possível adicionar a casa.",
                                  tone: "error",
                                });
                              }
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/4 px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <input
                    checked={setBalance}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                    onChange={(event) => setSetBalance(event.target.checked)}
                    type="checkbox"
                  />
                  Informar saldo
                </label>

                <button
                  className="lz-button-primary inline-flex rounded-full px-4 py-3 text-sm font-semibold"
                  disabled={isPending}
                  type="submit"
                >
                  <span className="inline-flex items-center gap-2">
                    {isPending ? <ButtonSpinner /> : null}
                    <span>Adicionar casa</span>
                  </span>
                </button>
              </div>
            </div>
          </form>

          {bookmakers.length === 0 ? (
            <EmptyState
              description="Escolha as casas da lista predefinida para começar a acompanhar saldo e prioridades."
              eyebrow="Setup inicial"
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
                    className="rounded-[28px] border border-white/10 bg-white/5 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    key={bookmaker.nome}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-white">{bookmaker.nome}</p>
                      </div>
                      <button
                        aria-label={`Remover ${bookmaker.nome}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-[rgba(255,107,133,0.3)] hover:bg-[rgba(255,107,133,0.12)] hover:text-[var(--negative)]"
                        disabled={isPending}
                        onClick={() => handleDelete(bookmaker.nome)}
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M6 6L18 18M18 6L6 18"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      </button>
                    </div>

                    {setBalance ? (
                      <div className="mt-3 space-y-2">
                        <label
                          className="block text-sm font-medium text-[var(--text-secondary)]"
                          htmlFor={balanceInputId}
                        >
                          Saldo
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">
                            R$
                          </span>
                          <input
                            className="lz-input w-full rounded-2xl py-3 pl-11 pr-4 text-center text-sm"
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

        <aside className="lz-panel rounded-[30px] p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Observações</h2>
            </div>

            <button
              className="lz-button-primary inline-flex rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              disabled={isPending || notes === notesSaved}
              onClick={saveNotes}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                {isPending && notes !== notesSaved ? <ButtonSpinner /> : null}
                <span>Salvar</span>
              </span>
            </button>
          </div>

          <textarea
            className="lz-textarea mt-4 min-h-[280px] w-full rounded-[26px] px-4 py-3 text-sm md:min-h-[360px]"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anote observações importantes."
            value={notes}
          />
        </aside>
      </div>
    </div>
  );
}
