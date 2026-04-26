"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/app/_components/toast-provider";

import { ProcedureModal } from "../_components/procedure-modal";
import { deleteProcedureAction } from "../procedure-actions";

type ProcedureRowActionsProps = {
  bookmakers: string[];
  procedure: {
    id: number;
    tipo_procedimento: string;
    data_operacao: string;
    jogo_time_pa: string;
    casas_envolvidas: string;
    lucro_final: number;
    observacao: string;
    valor_freebet_coletada: number;
    casa_destino_freebet: string;
    valor_da_freebet: number;
    condicao_freebet: string;
    bateu_duplo: boolean;
  };
};

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

export function ProcedureRowActions({
  bookmakers,
  procedure,
}: ProcedureRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isPending, startTransition] = useTransition();
  const hasObservation = procedure.observacao.trim().length > 0;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function updateMenuPosition() {
      if (!buttonRef.current || typeof window === "undefined") {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = hasObservation ? 132 : 88;
      const spacing = 8;
      const padding = 12;
      const openUp = rect.bottom + menuHeight > window.innerHeight - 16;
      const left = Math.min(
        Math.max(rect.right - menuWidth, padding),
        window.innerWidth - menuWidth - padding,
      );
      const top = openUp
        ? Math.max(rect.top - menuHeight - spacing, padding)
        : rect.bottom + spacing;

      setMenuPosition({ top, left });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [hasObservation, menuOpen]);

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
        setNoteOpen(false);
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
    const confirmed = window.confirm("Deseja excluir este procedimento?");
    if (!confirmed) {
      return;
    }

    setMenuOpen(false);
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
          title: "Nao foi possível excluir o procedimento.",
          tone: "error",
        });
      }
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

      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/8 hover:text-white"
        onClick={() => setMenuOpen((current) => !current)}
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
                onClick={handleDelete}
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
                className="lz-button-secondary rounded-full px-4 py-2 text-sm"
                onClick={() => setNoteOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
              {procedure.observacao}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
