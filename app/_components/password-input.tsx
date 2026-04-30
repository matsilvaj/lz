"use client";

import { useState, type ComponentPropsWithoutRef } from "react";

type PasswordInputProps = ComponentPropsWithoutRef<"input">;

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {hidden ? (
        <>
          <path d="m3 3 18 18" />
          <path d="M10.7 5.1A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.7 9.5 7a13.2 13.2 0 0 1-2.1 3.1" />
          <path d="M6.6 6.6A13.1 13.1 0 0 0 2.5 12c1 2.3 4.3 7 9.5 7 1.4 0 2.7-.3 3.8-.9" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2.5 12c1-2.3 4.3-7 9.5-7s8.5 4.7 9.5 7c-1 2.3-4.3 7-9.5 7s-8.5-4.7-9.5-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar senha" : "Mostrar senha";

  return (
    <div className="relative">
      <input
        {...props}
        className={`${className} pr-12`}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={label}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-white/8 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        onClick={() => setVisible((current) => !current)}
        title={label}
        type="button"
      >
        <EyeIcon hidden={visible} />
      </button>
    </div>
  );
}
