"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(checked);

  function handleChange(nextValue: boolean) {
    setValue(nextValue);

    startTransition(async () => {
      try {
        await updateProcedureDoubleStatusAction(procedureId, nextValue);
        router.refresh();
      } catch {
        setValue(!nextValue);
      }
    });
  }

  return (
    <label className="inline-flex items-center">
      <input
        checked={value}
        className="h-4 w-4 rounded border-neutral-300"
        disabled={isPending}
        onChange={(event) => handleChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
