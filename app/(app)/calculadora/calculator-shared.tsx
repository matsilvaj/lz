"use client";

import {
  type ReactNode,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ProfitTargetMode = "normal" | "zerar" | "valor";

type ProfitTargetUnit = "R$" | "%";

export type CalculatorLine = CalculatorLineFields & {
  children: CalculatorLineFields[];
  targetMode: ProfitTargetMode;
  targetUnit: ProfitTargetUnit;
  targetValue: string;
};

export type CalculatorLineFields = {
  house: string;
  odd: string;
  stake: string;
  stakeEdited: boolean;
  tipo: "B" | "L";
  responsabilidade: string;
  responsabilidadeEdited: boolean;
  aumento_percentual: string;
  comissao_percentual: string;
  cashback_percentual: string;
  cashback_apenas_perda: boolean;
  freebet: boolean;
};

export function toNumber(value: string) {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OptionHint({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const width = 300;
    setPosition({
      left: Math.min(Math.max(rect.left - 12, 12), window.innerWidth - width - 12),
      top: rect.bottom + 10,
    });
  }

  return (
    <>
      <span
        aria-label={title}
        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:border-white/20 hover:text-white"
        onBlur={() => setPosition(null)}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        ref={anchorRef}
        role="img"
        tabIndex={0}
      >
        {icon}
      </span>

      {position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="lz-floating-panel pointer-events-none fixed z-[95] flex w-[300px] gap-3 rounded-[20px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              role="tooltip"
              style={{ left: position.left, top: position.top }}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,119,163,0.24)] bg-[rgba(216,31,89,0.14)] text-[#ff9bbd]">
                {icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                  {description}
                </span>
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
