"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/app/_components/toast-provider";

import { updateProcedureDoubleStatusAction } from "../procedure-actions";

type ProcedureDoubleToggleProps = {
  checked: boolean;
  procedureId: number;
};

export function ProcedureDoubleToggle({
  checked,
  procedureId,
}: ProcedureDoubleToggleProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(checked);

  function handleChange(nextValue: boolean) {
    setValue(nextValue);

    startTransition(async () => {
      try {
        await updateProcedureDoubleStatusAction(procedureId, nextValue);
        showToast({
          title: nextValue ? "Duplo marcado como concluído." : "Duplo desmarcado.",
          tone: "success",
        });
        router.refresh();
      } catch {
        setValue(!nextValue);
        showToast({
          title: "Não foi possível atualizar o duplo.",
          tone: "error",
        });
      }
    });
  }

  return (
    <button
      aria-checked={value}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        value
          ? "border-[rgba(255,119,163,0.4)] bg-[linear-gradient(135deg,var(--accent),var(--accent-soft))]"
          : "border-white/12 bg-white/8"
      } ${isPending ? "opacity-70" : ""}`}
      disabled={isPending}
      onClick={() => handleChange(!value)}
      role="switch"
      type="button"
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.25)] transition ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
