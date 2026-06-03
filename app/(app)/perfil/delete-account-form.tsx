"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";

import { FormSubmitButton } from "@/app/_components/form-submit-button";
import { PasswordInput } from "@/app/_components/password-input";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,107,133,0.24)] bg-[rgba(255,107,133,0.08)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.14)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        <span>Deletar conta</span>
      </button>

      <ConfirmationDialog
        description="Esta ação remove sua conta e todos os dados vinculados a ela. Para continuar, confirme com sua senha atual."
        onOpenChange={setOpen}
        open={open}
        title="Deletar conta?"
      >
        <form action={deleteAccountAction} className="space-y-4">
          <PasswordInput
            className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
            minLength={8}
            name="currentPassword"
            placeholder="Senha atual"
            required
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="lz-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              <span>Cancelar</span>
            </button>
            <FormSubmitButton
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,107,133,0.26)] bg-[rgba(255,107,133,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.18)]"
              pendingLabel="Excluindo..."
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              <span>Confirmar exclusão</span>
            </FormSubmitButton>
          </div>
        </form>
      </ConfirmationDialog>
    </>
  );
}
