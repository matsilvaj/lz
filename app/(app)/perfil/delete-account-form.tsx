"use client";

import { FormSubmitButton } from "@/app/_components/form-submit-button";

import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  return (
    <form
      action={deleteAccountAction}
      className="flex flex-col items-stretch gap-3 sm:min-w-64"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Tem certeza? Esta ação vai excluir sua conta e remover todos os dados vinculados.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input
        className="lz-input rounded-2xl px-3 py-2.5 text-sm"
        minLength={8}
        name="currentPassword"
        placeholder="Senha atual"
        required
        type="password"
      />
      <FormSubmitButton
        className="rounded-full border border-[rgba(255,107,133,0.24)] bg-[rgba(255,107,133,0.08)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.14)]"
        pendingLabel="Excluindo..."
      >
        Deletar conta
      </FormSubmitButton>
    </form>
  );
}
