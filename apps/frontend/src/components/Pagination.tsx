interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageAdjusted?: boolean;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  pageAdjusted = false,
  onPageChange,
  disabled = false
}: PaginationProps) {
  const hasResults = total > 0;
  const pageCount = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = hasResults ? (currentPage - 1) * pageSize + 1 : 0;
  const end = hasResults ? Math.min(currentPage * pageSize, total) : 0;
  const previousDisabled = disabled || currentPage <= 1;
  const nextDisabled = disabled || currentPage >= pageCount;

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 text-sm text-slate-600">
      {pageAdjusted ? (
        <p className="text-amber-700">Requested page adjusted to page {currentPage}.</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{hasResults ? `Showing ${start}-${end} of ${total}` : 'No results'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={previousDisabled}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={nextDisabled}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
