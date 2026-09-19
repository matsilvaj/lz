"use client";

import { UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 256;
const VIEWPORT_MARGIN = 12;

// Selo "👤 N" ao lado das casas: ao tocar ou clicar, mostra as casas agrupadas por parceiro.
// O cartão abre sobre a página (fora da tabela com rolagem) e se ajusta à borda da tela.
export function PartnerHousesChip({
  housesByPartner,
}: {
  housesByPartner: Array<{ partner: string; houses: string[] }>;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function close() {
      setPosition(null);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!housesByPartner.length) {
    return null;
  }

  const count = housesByPartner.length;

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );

    setPosition({ left, top: rect.bottom + 8 });
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={`${count} ${count === 1 ? "parceiro" : "parceiros"} neste procedimento`}
        className={`ml-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 align-middle text-[11px] font-semibold leading-none transition ${
          open
            ? "border-[rgba(167,139,250,0.55)] bg-[rgba(167,139,250,0.2)] text-violet-100"
            : "border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.1)] text-violet-200 hover:border-[rgba(167,139,250,0.5)]"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        ref={buttonRef}
        title="Ver de quem são as casas"
        type="button"
      >
        <UserRound aria-hidden="true" className="h-3 w-3" />
        {count}
      </button>

      {position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="lz-floating-panel fixed z-[90] rounded-2xl border border-white/10 bg-[rgba(17,8,14,0.98)] p-2 text-left shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              ref={panelRef}
              role="dialog"
              style={{
                left: position.left,
                top: position.top,
                width: Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
              }}
            >
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Casas de parceiros
              </p>
              {housesByPartner.map(({ partner, houses }) => (
                <div
                  className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] items-baseline gap-x-3 rounded-lg px-2 py-1.5 text-xs"
                  key={partner}
                >
                  <span className="flex min-w-0 items-center gap-1 font-semibold text-violet-200">
                    <UserRound aria-hidden="true" className="h-3 w-3 shrink-0" />
                    <span className="truncate">{partner}</span>
                  </span>
                  <span className="text-[var(--text-secondary)]">{houses.join(", ")}</span>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
