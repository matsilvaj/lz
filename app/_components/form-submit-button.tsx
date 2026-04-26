"use client";

import { useFormStatus } from "react-dom";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ButtonSpinnerProps = {
  className?: string;
};

type FormSubmitButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function ButtonSpinner({ className = "" }: ButtonSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-[lz-spin_900ms_linear_infinite] rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function FormSubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel,
  type = "submit",
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={disabled || pending}
      type={type}
      {...props}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? <ButtonSpinner /> : null}
        <span>{pending ? pendingLabel ?? "Salvando..." : children}</span>
      </span>
    </button>
  );
}
