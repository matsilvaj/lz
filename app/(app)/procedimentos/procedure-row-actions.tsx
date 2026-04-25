"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

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
      await deleteProcedureAction(procedure.id);
      router.refresh();
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
        submitLabel="Salvar alteracoes"
        title="Editar procedimento"
      />

      <button
        className="rounded-lg px-2 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
        onClick={() => setMenuOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        v
      </button>

      {menuOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-40 min-w-44 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg"
              ref={menuRef}
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
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
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                  onClick={() => {
                    setMenuOpen(false);
                    setNoteOpen(true);
                  }}
                  type="button"
                >
                  Ver observacao
                </button>
              ) : null}

              <button
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-neutral-950">Observacao</h3>
              <button
                className="rounded-xl px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
                onClick={() => setNoteOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {procedure.observacao}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
