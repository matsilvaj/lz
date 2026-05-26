"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/app/_components/toast-provider";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
import { copyTextToClipboard } from "../_components/clipboard";
import { ProcedureModal } from "../_components/procedure-modal";
import { buildProcedureShareUrl } from "../_components/procedure-share";
import { type ProcedureShareValues } from "../_components/procedure-share-types";
import { CloseIcon } from "../_components/ui";
import { deleteProcedureAction } from "../procedure-actions";

const PROCEDURE_EDIT_EVENT = "lz:procedure-edit";
const PROCEDURE_MENU_EVENT = "lz:procedure-menu";

type ProcedureRowActionsProps = {
  bookmakers: string[];
  procedure: {
    id: number;
    tipo_procedimento: string;
    data_operacao: string;
    jogo_time_pa: string;
    casas_envolvidas: string;
    lucro_final: number;
    lucro_real: number;
    observacao: string;
    valor_freebet_coletada: number;
    casa_destino_freebet: string;
    valor_da_freebet: number;
    condicao_freebet: string;
    bateu_duplo: boolean;
    status_procedimento: string;
  };
};

type ProcedureMenuEventDetail = {
  left: number;
  procedureId: number;
  top: number;
};

export function requestProcedureEdit(procedureId: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(PROCEDURE_EDIT_EVENT, { detail: { procedureId } }),
  );
}

export function requestProcedureMenu(
  procedureId: number,
  left: number,
  top: number,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(PROCEDURE_MENU_EVENT, {
      detail: { procedureId, left, top },
    }),
  );
}

function toDateInputValue(value: string) {
  const [day, month, year] = String(value).split("/");
  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toHousesInputValue(value: string) {
  return String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function getMenuHeight(hasObservation: boolean) {
  return hasObservation ? 236 : 192;
}

function getMenuPosition(left: number, top: number, hasObservation: boolean) {
  if (typeof window === "undefined") {
    return { left, top };
  }

  const menuWidth = 176;
  const menuHeight = getMenuHeight(hasObservation);
  const padding = 12;

  return {
    left: Math.min(
      Math.max(left, padding),
      window.innerWidth - menuWidth - padding,
    ),
    top: Math.min(
      Math.max(top, padding),
      window.innerHeight - menuHeight - padding,
    ),
  };
}

export function ProcedureRowActions({
  bookmakers,
  procedure,
}: ProcedureRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<"button" | "pointer">("button");
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isPending, startTransition] = useTransition();
  const hasObservation = procedure.observacao.trim().length > 0;
  const procedureDefaultStatus: "Pendente" | "Concluído" =
    procedure.status_procedimento === "Concluído" ? "Concluído" : "Pendente";
  const procedureDefaultValues: ProcedureShareValues = {
    version: 1,
    procedureType: procedure.tipo_procedimento as
      | "SureBet"
      | "Tentativa de Duplo"
      | "Coletar Freebet"
      | "Converter Freebet"
      | "Cassino",
    operationDate: toDateInputValue(procedure.data_operacao),
    game: procedure.jogo_time_pa === "-" ? "" : procedure.jogo_time_pa,
    houses: toHousesInputValue(procedure.casas_envolvidas),
    entryValue: Number(procedure.lucro_real ?? procedure.lucro_final ?? 0),
    note: procedure.observacao,
    doubleValue: procedure.valor_freebet_coletada,
    hitDouble: procedure.bateu_duplo,
    freebetHouse: procedure.casa_destino_freebet,
    freebetValue: procedure.valor_da_freebet,
    freebetCondition: procedure.condicao_freebet,
    procedureStatus: procedureDefaultStatus,
  };

  const getButtonMenuPosition = useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") {
      return { top: 0, left: 0 };
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = getMenuHeight(hasObservation);
    const spacing = 8;
    const openUp = rect.bottom + menuHeight > window.innerHeight - 16;

    return getMenuPosition(
      rect.right - menuWidth,
      openUp ? rect.top - menuHeight - spacing : rect.bottom + spacing,
      hasObservation,
    );
  }, [hasObservation]);

  function openMenuFromButton() {
    if (menuOpen && menuAnchor === "button") {
      setMenuOpen(false);
      return;
    }

    setMenuAnchor("button");
    setMenuPosition(getButtonMenuPosition());
    setMenuOpen(true);
  }

  const openMenuAt = useCallback((left: number, top: number) => {
    setMenuAnchor("pointer");
    setMenuPosition(getMenuPosition(left, top, hasObservation));
    setMenuOpen(true);
  }, [hasObservation]);

  useEffect(() => {
    if (!menuOpen || menuAnchor !== "button") {
      return;
    }

    function updateMenuPosition() {
      setMenuPosition(getButtonMenuPosition());
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [getButtonMenuPosition, menuAnchor, menuOpen]);

  useEffect(() => {
    function handleEditRequest(event: Event) {
      const detail = (event as CustomEvent<{ procedureId: number }>).detail;

      if (detail?.procedureId !== procedure.id) {
        return;
      }

      setMenuOpen(false);
      setEditOpen(true);
    }

    function handleMenuRequest(event: Event) {
      const detail = (event as CustomEvent<ProcedureMenuEventDetail>).detail;

      if (detail?.procedureId !== procedure.id) {
        return;
      }

      openMenuAt(detail.left, detail.top);
    }

    window.addEventListener(PROCEDURE_EDIT_EVENT, handleEditRequest);
    window.addEventListener(PROCEDURE_MENU_EVENT, handleMenuRequest);

    return () => {
      window.removeEventListener(PROCEDURE_EDIT_EVENT, handleEditRequest);
      window.removeEventListener(PROCEDURE_MENU_EVENT, handleMenuRequest);
    };
  }, [openMenuAt, procedure.id]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedMenu = menuRef.current?.contains(target);
      const clickedButton = buttonRef.current?.contains(target);

      if (!clickedMenu && !clickedButton) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setEditOpen(false);
        setDuplicateOpen(false);
        setNoteOpen(false);
        setDeleteOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleDelete() {
    setMenuOpen(false);
    setDeleteOpen(false);
    startTransition(async () => {
      try {
        await deleteProcedureAction(procedure.id);
        showToast({
          title: "Procedimento excluído.",
          tone: "success",
        });
        router.refresh();
      } catch {
        showToast({
          title: "Não foi possível excluir o procedimento.",
          tone: "error",
        });
      }
    });
  }

  async function handleCopyProcedure() {
    setMenuOpen(false);
    const copied = await copyTextToClipboard(
      buildProcedureShareUrl(procedureDefaultValues),
    );

    showToast({
      title: copied
        ? "Link do procedimento copiado."
        : "Não foi possível copiar o link.",
      tone: copied ? "success" : "error",
    });
  }

  return (
    <>
      <ProcedureModal
        bookmakers={bookmakers}
        defaultValues={{
          procedureType: procedure.tipo_procedimento as
            | "SureBet"
            | "Tentativa de Duplo"
            | "Coletar Freebet"
            | "Converter Freebet"
            | "Cassino",
          operationDate: toDateInputValue(procedure.data_operacao),
          game: procedure.jogo_time_pa === "-" ? "" : procedure.jogo_time_pa,
          houses: toHousesInputValue(procedure.casas_envolvidas),
          entryValue: procedure.lucro_final,
          equalProfit: true,
          note: procedure.observacao,
          doubleValue: procedure.valor_freebet_coletada,
          hitDouble: procedure.bateu_duplo,
          freebetHouse: procedure.casa_destino_freebet,
          freebetValue: procedure.valor_da_freebet,
          freebetCondition: procedure.condicao_freebet,
          procedureStatus:
            procedure.status_procedimento === "Concluído" ? "Concluído" : "Pendente",
        }}
        hideTrigger
        mode="edit"
        onOpenChange={setEditOpen}
        open={editOpen}
        procedureId={procedure.id}
        returnTo="/procedimentos"
        submitLabel="Salvar alterações"
        title="Editar procedimento"
      />

      <ProcedureModal
        bookmakers={bookmakers}
        defaultValues={procedureDefaultValues}
        hideTrigger
        mode="create"
        onOpenChange={setDuplicateOpen}
        open={duplicateOpen}
        returnTo="/procedimentos"
        submitLabel="Criar cópia"
        title="Duplicar procedimento"
      />

      <button
        data-procedure-row-action
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/8 hover:text-white"
        onClick={openMenuFromButton}
        ref={buttonRef}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {menuOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              data-procedure-row-action
              className="fixed z-40 min-w-48 rounded-[24px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
              ref={menuRef}
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button
                className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                onClick={() => {
                  setMenuOpen(false);
                  setEditOpen(true);
                }}
                type="button"
              >
                Editar
              </button>

              <button
                className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                onClick={() => {
                  setMenuOpen(false);
                  setDuplicateOpen(true);
                }}
                type="button"
              >
                Duplicar
              </button>

              <button
                className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                onClick={handleCopyProcedure}
                type="button"
              >
                Copiar
              </button>

              {hasObservation ? (
                <button
                  className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                  onClick={() => {
                    setMenuOpen(false);
                    setNoteOpen(true);
                  }}
                  type="button"
                >
                  Ver observação
                </button>
              ) : null}

              <button
                className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.12)] hover:text-[#ff9bb0] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
                type="button"
              >
                Excluir
              </button>
            </div>,
            document.body,
          )
        : null}

      {noteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="lz-panel w-full max-w-lg rounded-[30px] p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">Observação</h3>
              <button
                aria-label="Fechar"
                className="lz-button-secondary inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
                onClick={() => setNoteOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
              {procedure.observacao}
            </p>
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        description="O procedimento será removido do histórico e dos indicadores vinculados a ele."
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Excluir procedimento?"
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
            disabled={isPending}
            onClick={() => setDeleteOpen(false)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-full border border-[rgba(255,107,133,0.26)] bg-[rgba(255,107,133,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={handleDelete}
            type="button"
          >
            {isPending ? "Excluindo..." : "Confirmar exclusão"}
          </button>
        </div>
      </ConfirmationDialog>
    </>
  );
}
