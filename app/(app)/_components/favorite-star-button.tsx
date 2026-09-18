"use client";

import { Star } from "lucide-react";

export function FavoriteStarButton({
  active,
  label,
  onToggle,
  size = "md",
}: {
  active: boolean;
  label: string;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <button
      aria-label={active ? `Remover ${label} dos favoritos` : `Favoritar ${label}`}
      aria-pressed={active}
      className={`pointer-events-auto relative z-20 inline-flex ${dimension} shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? "border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.14)] text-amber-300"
          : "border-white/10 bg-white/[0.035] text-[var(--text-dim)] hover:border-white/20 hover:text-white"
      }`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      title={active ? "Remover dos favoritos" : "Favoritar"}
      type="button"
    >
      <Star
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}
