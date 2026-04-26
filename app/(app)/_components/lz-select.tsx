"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type LzSelectOption = {
  value: string;
  label: string;
};

type LzSelectProps = {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  options: LzSelectOption[];
  placeholder?: string;
  value?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LzSelect({
  className,
  defaultValue,
  disabled = false,
  id,
  name,
  onValueChange,
  options,
  placeholder = "Selecionar",
  value,
}: LzSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const menuId = `${triggerId}-menu`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const isControlled = value !== undefined;
  const selectedValue = isControlled ? value : internalValue;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(nextValue: string) {
    if (disabled) {
      return;
    }

    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
    setOpen(false);
  }

  return (
    <>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}

      <button
        aria-controls={menuId}
        aria-expanded={open}
        className={joinClasses(
          "lz-select inline-flex items-center justify-between gap-3 text-left",
          disabled && "opacity-60",
          className,
        )}
        disabled={disabled}
        id={triggerId}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span
          className={joinClasses(
            "min-w-0 truncate",
            selectedOption ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]",
          )}
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <svg
          aria-hidden="true"
          className={joinClasses(
            "h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90]"
              style={{
                left: `${menuStyle.left}px`,
                top: `${menuStyle.top}px`,
                width: `${menuStyle.width}px`,
              }}
            >
              <div
                className="rounded-[24px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-2 shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                id={menuId}
                ref={menuRef}
                role="listbox"
              >
                <div className="max-h-72 space-y-1 overflow-x-hidden overflow-y-auto pr-1">
                  {options.map((option) => {
                    const active = option.value === selectedValue;

                    return (
                      <button
                        aria-selected={active}
                        className={joinClasses(
                          "flex w-full items-center justify-between gap-3 rounded-[18px] px-3 py-2.5 text-sm whitespace-nowrap transition",
                          active
                            ? "border border-[rgba(255,119,163,0.18)] bg-[rgba(216,31,89,0.18)] text-white"
                            : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white",
                        )}
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                        role="option"
                        type="button"
                      >
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
