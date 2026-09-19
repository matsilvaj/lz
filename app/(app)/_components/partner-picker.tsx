"use client";

import { Check, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type PartnerOption = {
  id: number;
  name: string;
};

// Botão pequeno ao lado do seletor de casa: sem parceiro, a casa é do usuário.
export function PartnerPicker({
  disabled = false,
  onChange,
  partners,
  value,
}: {
  disabled?: boolean;
  onChange: (partnerId: number | null) => void;
  partners: PartnerOption[];
  value: number | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = partners.find((partner) => partner.id === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(partnerId: number | null) {
    onChange(partnerId);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selected ? `Parceiro: ${selected.name}` : "Escolher parceiro"}
        className={`inline-flex h-full min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          selected
            ? "border-[rgba(167,139,250,0.45)] bg-[rgba(167,139,250,0.14)] text-violet-200"
            : "border-white/10 bg-white/[0.04] text-[var(--text-dim)] hover:border-white/20 hover:text-white"
        }`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={selected ? `Casa do parceiro ${selected.name}` : "Casa sua (sem parceiro)"}
        type="button"
      >
        <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
        {selected ? <span className="max-w-[14rem] truncate">{selected.name}</span> : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-[20px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
          role="listbox"
        >
          <PartnerPickerOption active={value === null} label="Sem parceiro (minha)" onClick={() => choose(null)} />
          {partners.map((partner) => (
            <PartnerPickerOption
              active={partner.id === value}
              key={partner.id}
              label={partner.name}
              onClick={() => choose(partner.id)}
            />
          ))}
          <Link
            className="mt-1 block rounded-xl border-t border-white/8 px-3 py-2 text-xs font-semibold text-[var(--text-dim)] transition hover:text-white"
            href="/parceiros"
          >
            {partners.length ? "Gerenciar parceiros" : "Cadastrar parceiros"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function PartnerPickerOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
        active ? "bg-white/[0.07] text-white" : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
      }`}
      onClick={onClick}
      role="option"
      type="button"
    >
      <span className="truncate">{label}</span>
      {active ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}

// Etiqueta do parceiro nos cards e listas.
export function PartnerBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(167,139,250,0.35)] bg-[rgba(167,139,250,0.12)] px-2 py-0.5 text-[11px] font-semibold text-violet-200">
      <UserRound aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
