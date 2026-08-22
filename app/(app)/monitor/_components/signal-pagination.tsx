"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const signalPageSize = 15;

export function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / signalPageSize));
}

// Mantem a pagina dentro do intervalo valido quando a lista encolhe sozinha,
// por exemplo quando as odds sao atualizadas e alguns sinais deixam de existir.
export function getSafePage(page: number, total: number) {
  return Math.min(Math.max(page, 1), getPageCount(total));
}

export function getPageSlice<T>(rows: T[], page: number) {
  const safePage = getSafePage(page, rows.length);
  const start = (safePage - 1) * signalPageSize;

  return rows.slice(start, start + signalPageSize);
}

function getPageNumbers(page: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);

  return Array.from(pages)
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
}

function PageButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.2)] text-white"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
      } ${disabled ? "cursor-not-allowed opacity-40 hover:border-white/10 hover:bg-white/[0.035]" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function SignalPagination({
  onPageChange,
  page,
  total,
}: {
  onPageChange: (page: number) => void;
  page: number;
  total: number;
}) {
  const pageCount = getPageCount(total);

  if (total === 0 || pageCount <= 1) {
    return null;
  }

  const safePage = getSafePage(page, total);
  const firstItem = (safePage - 1) * signalPageSize + 1;
  const lastItem = Math.min(safePage * signalPageSize, total);
  const pageNumbers = getPageNumbers(safePage, pageCount);

  return (
    <nav
      aria-label="Paginação dos sinais"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4"
    >
      <p className="text-xs font-medium text-[var(--text-dim)]">
        Mostrando {firstItem}–{lastItem} de {total}{" "}
        {total === 1 ? "sinal" : "sinais"}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <PageButton
          disabled={safePage <= 1}
          label="Página anterior"
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </PageButton>

        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const hasGap = previous !== undefined && pageNumber - previous > 1;

          return (
            <span className="flex items-center gap-1.5" key={pageNumber}>
              {hasGap ? (
                <span className="px-1 text-xs text-[var(--text-dim)]">…</span>
              ) : null}
              <PageButton
                active={pageNumber === safePage}
                label={`Página ${pageNumber}`}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </PageButton>
            </span>
          );
        })}

        <PageButton
          disabled={safePage >= pageCount}
          label="Próxima página"
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </PageButton>
      </div>
    </nav>
  );
}
