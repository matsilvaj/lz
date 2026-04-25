"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { EmptyState } from "../_components/ui";
import {
  deleteBookmakerAction,
  saveBookmakerAction,
  updateBookmakerBalanceAction,
} from "./actions";

type BookmakerItem = {
  nome: string;
  saldo: number;
};

type BookmakersWorkspaceProps = {
  bookmakers: BookmakerItem[];
};

export function BookmakersWorkspace({
  bookmakers,
}: BookmakersWorkspaceProps) {
  const router = useRouter();
  const inputListId = useId();
  const [name, setName] = useState("");
  const [setBalance, setSetBalance] = useState(true);
  const [isPending, startTransition] = useTransition();

  function parseBalanceInput(value: string) {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    startTransition(async () => {
      await saveBookmakerAction({
        name: normalizedName,
      });
      setName("");
      router.refresh();
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

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
            disabled={isPending}
            list={inputListId}
            onChange={(event) => setName(event.target.value)}
            placeholder="Digite a casa e pressione Enter"
            type="text"
            value={name}
          />

          <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950">
            <input
              checked={setBalance}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-0"
              onChange={(event) => setSetBalance(event.target.checked)}
              type="checkbox"
            />
            Informar banca
          </label>
        </div>

        <datalist id={inputListId}>
          {bookmakers.map((bookmaker) => (
            <option key={bookmaker.nome} value={bookmaker.nome} />
          ))}
        </datalist>
      </form>

      {bookmakers.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <EmptyState
            description="Adicione as primeiras casas para montar sua lista de bancas."
            title="Nenhuma casa cadastrada"
          />
        </div>
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
                  className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-red-600"
                  disabled={isPending}
                  onClick={() => handleDelete(bookmaker.nome)}
                  type="button"
                >
                  Remover
                </button>

                <div className="flex min-h-16 items-center justify-center text-center">
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
                      Banca
                    </label>
                    <input
                      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-center text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
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
                      placeholder="Valor da banca"
                      type="text"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
