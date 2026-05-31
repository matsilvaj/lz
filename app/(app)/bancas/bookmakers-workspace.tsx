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
  const parsed = Number(sanitizeBalanceInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeBalanceInput(value: string) {
  return value.replace(/\D/gu, "").slice(0, 7);
}

function formatBalanceInput(value: number) {
  const normalized = Math.min(Math.max(Math.trunc(value), 0), 9_999_999);
  return normalized === 0 ? "" : String(normalized);
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
  const [initialBalance, setInitialBalance] = useState("");
  const [setBalance, setSetBalance] = useState(true);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  const selectedBookmakers = useMemo(
    () =>
      new Set(bookmakers.map((bookmaker) => bookmaker.nome.toLowerCase())),
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

  async function submitBookmaker(bookmakerName: string, balance: number) {
    await saveBookmakerAction({ name: bookmakerName, balance });
    setName("");
    setInitialBalance("");
    setAutocompleteOpen(false);
    showToast({
      title: "Casa adicionada com sucesso.",
      tone: "success",
    });
    router.refresh();
  }

  async function addBookmakerWithBalance(bookmakerName: string) {
    const nextInitialBalance = parseBalanceInput(initialBalance);

    if (nextInitialBalance <= 0) {
      showToast({
        title: "Informe um saldo maior que zero.",
        tone: "error",
      });
      return;
    }

    await submitBookmaker(bookmakerName, nextInitialBalance);
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
        await addBookmakerWithBalance(normalizedName);
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
        const result = await deleteBookmakerAction(bookmakerName);

        if (result?.blockedByPending) {
          showToast({
            title: "Tem procedimentos pendentes nesta casa.",
            description: "Conclua e tente novamente.",
            tone: "error",
          });
          return;
        }

        if (!result?.deleted) {
          showToast({
            title: "Nao foi possivel remover a casa.",
            tone: "error",
          });
          router.refresh();
          return;
        }

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
                                await addBookmakerWithBalance(bookmaker);
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
                <label className="flex min-w-[10rem] items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="shrink-0 font-semibold">R$</span>
                  <input
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[var(--text-dim)]"
                    disabled={isPending}
                    inputMode="numeric"
                    maxLength={7}
                    onChange={(event) =>
                      setInitialBalance(sanitizeBalanceInput(event.target.value))
                    }
                    pattern="[0-9]*"
                    placeholder="Saldo"
                    type="text"
                    value={initialBalance}
                  />
                </label>

                <label className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/4 px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <input
                    checked={setBalance}
                    className="lz-checkbox"
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
                    className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_36px_rgba(0,0,0,0.16)]"
                    key={bookmaker.nome}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{bookmaker.nome}</p>
                      </div>
                      <button
                        aria-label={`Remover ${bookmaker.nome}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-dim)] transition hover:border-[rgba(255,107,133,0.3)] hover:bg-[rgba(255,107,133,0.12)] hover:text-[var(--negative)]"
                        disabled={isPending}
                        onClick={() => handleDelete(bookmaker.nome)}
                        title="Remover casa"
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
                      <div className="mt-3 flex items-center gap-2">
                        <label
                          className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]"
                          htmlFor={balanceInputId}
                        >
                          Saldo
                        </label>
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 rounded-[16px] border border-white/10 bg-[rgba(255,255,255,0.055)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[rgba(216,31,89,0.55)] focus-within:bg-[rgba(216,31,89,0.08)]">
                          <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
                            R$
                          </span>
                          <input
                            className="w-auto min-w-0 max-w-[7rem] flex-1 border-0 bg-transparent py-1 text-right text-base font-semibold text-white outline-none placeholder:text-[var(--text-dim)] disabled:cursor-not-allowed"
                            defaultValue={
                              formatBalanceInput(bookmaker.saldo)
                            }
                            disabled={isPending}
                            id={balanceInputId}
                            inputMode="numeric"
                            key={`${bookmaker.nome}-${bookmaker.saldo}`}
                            maxLength={7}
                            onBlur={(event) =>
                              commitBalance(bookmaker.nome, event.target.value)
                            }
                            onChange={(event) => {
                              event.currentTarget.value = sanitizeBalanceInput(
                                event.currentTarget.value,
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitBalance(
                                  bookmaker.nome,
                                  event.currentTarget.value,
                                );
                              }
                            }}
                            pattern="[0-9]*"
                            placeholder="0"
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
