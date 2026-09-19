"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type BookmakerAutocompleteInputProps = {
  placeholder: string;
  bookmakers: string[];
  onValueChange: (value: string) => void;
  value: string;
};

export function BookmakerAutocompleteInput({
  placeholder,
  bookmakers,
  onValueChange,
  value,
}: BookmakerAutocompleteInputProps) {
  const generatedId = useId();
  const menuId = `${generatedId}-bookmaker-menu`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });
  const normalizedValue = value.trim().toLowerCase();
  const visibleBookmakers = useMemo(() => {
    const availableBookmakers = bookmakers.filter(Boolean);

    if (!normalizedValue) {
      return availableBookmakers.slice(0, 10);
    }

    return availableBookmakers
      .filter((bookmaker) =>
        bookmaker.toLowerCase().includes(normalizedValue),
      )
      .slice(0, 10);
  }, [bookmakers, normalizedValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = inputRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (inputRef.current?.contains(target) || menuRef.current?.contains(target)) {
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

  function handleSelect(bookmaker: string) {
    onValueChange(bookmaker);
    setOpen(false);
  }

  return (
    <>
      <input
        aria-autocomplete="list"
        aria-controls={menuId}
        aria-expanded={open}
        className="calculator-house-input min-w-0 flex-1 rounded-lg bg-transparent px-0 text-base font-semibold text-white outline-none"
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        type="text"
        value={value}
      />

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
                className="lz-floating-panel rounded-[22px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                id={menuId}
                ref={menuRef}
                role="listbox"
              >
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {visibleBookmakers.length > 0 ? (
                    visibleBookmakers.map((bookmaker) => {
                      const active = bookmaker === value;

                      return (
                        <button
                          aria-selected={active}
                          className={`flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-left text-sm transition ${
                            active
                              ? "border border-[rgba(255,119,163,0.18)] bg-[rgba(216,31,89,0.18)] text-white"
                              : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                          }`}
                          key={bookmaker}
                          onClick={() => handleSelect(bookmaker)}
                          role="option"
                          type="button"
                        >
                          <span className="min-w-0 truncate">{bookmaker}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2.5 text-sm text-[var(--text-muted)]">
                      Nenhuma casa encontrada.
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
