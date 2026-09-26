"use client";

import { UserRound } from "lucide-react";

import { MultiSelectFilter } from "./multi-select-filter";
import type { PartnerOption } from "./partner-picker";

// Filtro "Parceiro" (dashboard, histórico, procedimentos, freebets e bancas):
// "me" e/ou ids de parceiros; vazio = todos.
export function buildPartnerFilterOptions(partners: PartnerOption[]) {
  return [
    { label: "Eu", value: "me" },
    ...partners.map((partner) => ({
      icon: <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-violet-300" />,
      label: partner.name,
      value: String(partner.id),
    })),
  ];
}

export function PartnerFilterSelect({
  disabled = false,
  id,
  inline = false,
  onChange,
  partners,
  value,
}: {
  disabled?: boolean;
  id?: string;
  inline?: boolean;
  onChange: (value: string[]) => void;
  partners: PartnerOption[];
  value: string[];
}) {
  return (
    <MultiSelectFilter
      disabled={disabled}
      icon={
        <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
      }
      id={id}
      inline={inline}
      onChange={onChange}
      options={buildPartnerFilterOptions(partners)}
      searchPlaceholder="Buscar parceiro..."
      value={value}
    />
  );
}
