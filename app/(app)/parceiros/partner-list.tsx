"use client";

import { MoreHorizontal, Pencil, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PARTNER_NAME_MAX_LENGTH } from "@/core/domain/shared/partner-name.js";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
import { removePartnerAction, renamePartnerAction } from "./actions";

export type PartnerItem = {
  bookmakersCount: number;
  id: number;
  name: string;
};

function formatUsage(partner: PartnerItem) {
  return `${partner.bookmakersCount} ${partner.bookmakersCount === 1 ? "casa" : "casas"}`;
}

export function PartnerList({ partners }: { partners: PartnerItem[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-partner-menu-root]")) {
        setOpenMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setEditingId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!partners.length) {
    return (
      <section className="lz-panel rounded-[28px] p-6 text-sm text-[var(--text-muted)]">
        Nenhum parceiro cadastrado. Adicione o primeiro acima para vincular casas a ele.
      </section>
    );
  }

  const removing = partners.find((partner) => partner.id === removeId) ?? null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {partners.map((partner) => {
          const isEditing = partner.id === editingId;

          return (
            <div
              className="relative rounded-[28px] border border-white/10 bg-white/5 p-4 text-white"
              key={partner.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--text-secondary)]">
                    <UserRound aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{partner.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-dim)]">{formatUsage(partner)}</p>
                  </div>
                </div>

                <div className="relative shrink-0" data-partner-menu-root>
                  <button
                    aria-expanded={openMenuId === partner.id}
                    aria-label={`Abrir ações de ${partner.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[var(--text-dim)] transition hover:bg-white/8 hover:text-white"
                    onClick={() =>
                      setOpenMenuId((current) => (current === partner.id ? null : partner.id))
                    }
                    type="button"
                  >
                    <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                  </button>

                  {openMenuId === partner.id ? (
                    <div className="lz-floating-panel absolute right-0 top-10 z-20 min-w-44 rounded-[24px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
                      <button
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/8 hover:text-white"
                        onClick={() => {
                          setEditingId(partner.id);
                          setDraftName(partner.name);
                          setOpenMenuId(null);
                        }}
                        type="button"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>Editar nome</span>
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.12)] hover:text-[#ffb6c4]"
                        onClick={() => {
                          setOpenMenuId(null);
                          setRemoveId(partner.id);
                        }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>Remover</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <form action={renamePartnerAction} className="mt-4 space-y-3">
                  <input name="partnerId" type="hidden" value={partner.id} />
                  <input
                    aria-label="Nome do parceiro"
                    autoFocus
                    className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                    maxLength={PARTNER_NAME_MAX_LENGTH}
                    name="name"
                    onChange={(event) => setDraftName(event.target.value)}
                    required
                    type="text"
                    value={draftName}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className="lz-button-secondary rounded-full px-3 py-2 text-sm font-medium"
                      onClick={() => setEditingId(null)}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button className="lz-button-primary rounded-full px-3 py-2 text-sm font-medium" type="submit">
                      Salvar
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmationDialog
        description={
          removing && removing.bookmakersCount > 0
            ? `${removing.name} sai da lista de parceiros. As casas e os procedimentos dele continuam guardados e aparecem no histórico com o nome dele.`
            : "O parceiro sai da lista de parceiros. Os procedimentos com ele continuam no histórico."
        }
        onOpenChange={(open) => setRemoveId(open ? removeId : null)}
        open={removing !== null}
        title={removing ? `Remover ${removing.name}?` : "Remover parceiro?"}
      >
        {removing ? (
          <form
            action={removePartnerAction.bind(null, removing.id)}
            className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <button
              className="lz-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={() => setRemoveId(null)}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              <span>Cancelar</span>
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(255,107,133,0.26)] bg-[rgba(255,107,133,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.18)]"
              type="submit"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              <span>Confirmar remoção</span>
            </button>
          </form>
        ) : null}
      </ConfirmationDialog>
    </>
  );
}
