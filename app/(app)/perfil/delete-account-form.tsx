"use client";

import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  return (
    <form
      action={deleteAccountAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Tem certeza? Esta acao vai excluir sua conta e remover todos os dados vinculados.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        type="submit"
      >
        Deletar conta
      </button>
    </form>
  );
}
