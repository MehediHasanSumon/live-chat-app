"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { SelectInput } from "@/components/ui/select-input";
import { cn } from "@/lib/utils";

export type PaginationMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
};

type PaginationProps = {
  meta: PaginationMeta;
  disabled?: boolean;
  perPageOptions?: number[];
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

function getPageItems(currentPage: number, lastPage: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set([1, lastPage, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 4) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
    pages.add(5);
  }

  if (currentPage >= lastPage - 3) {
    pages.add(lastPage - 4);
    pages.add(lastPage - 3);
    pages.add(lastPage - 2);
    pages.add(lastPage - 1);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= lastPage)
    .sort((first, second) => first - second);

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push(previousPage === 1 ? "ellipsis-start" : "ellipsis-end");
    }

    items.push(page);
  });

  return items;
}

export function Pagination({
  meta,
  disabled = false,
  perPageOptions = [10, 20, 30, 50],
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  const currentPage = Math.max(1, meta.current_page);
  const lastPage = Math.max(1, meta.last_page);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < lastPage;
  const pageItems = getPageItems(currentPage, lastPage);

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--line)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p className="text-sm text-[var(--muted)]">
        {meta.total > 0 && meta.from && meta.to ? (
          <>
            Showing <span className="font-semibold text-[#2d3150]">{meta.from}</span> to{" "}
            <span className="font-semibold text-[#2d3150]">{meta.to}</span> of{" "}
            <span className="font-semibold text-[#2d3150]">{meta.total}</span>
          </>
        ) : (
          "No records"
        )}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          Rows
          <SelectInput
            value={String(meta.per_page)}
            disabled={disabled}
            dropdownLabel="Rows"
            dropdownPlacement="top"
            className="w-24"
            onChange={(nextValue) => onPerPageChange(Number(nextValue))}
            options={perPageOptions.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
          />
        </label>

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={disabled || !canGoPrevious}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#2d3150] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          {pageItems.map((item) =>
            typeof item === "number" ? (
              <button
                key={item}
                type="button"
                disabled={disabled || item === currentPage}
                aria-current={item === currentPage ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed",
                  item === currentPage
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white text-[#2d3150] hover:border-[var(--accent)]",
                  disabled && item !== currentPage && "opacity-45",
                )}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="inline-flex h-9 min-w-9 items-center justify-center text-sm text-[var(--muted)]">
                ...
              </span>
            ),
          )}

          <button
            type="button"
            disabled={disabled || !canGoNext}
            onClick={() => onPageChange(currentPage + 1)}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[#2d3150] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
