interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  loading?: boolean;
}

export default function Pagination({
  page, totalPages, total, pageSize, onChange, loading,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3
                    border-t border-[var(--color-border-soft)]">
      <span className="text-xs text-muted">
        {loading ? "Loading…" : `${from}–${to} of ${total}`}
      </span>
      <div className="flex gap-1.5">
        <button className="btn btn-secondary btn-sm"
          onClick={() => onChange(1)} disabled={page === 1 || loading}>
          «
        </button>
        <button className="btn btn-secondary btn-sm"
          onClick={() => onChange(page - 1)} disabled={page === 1 || loading}>
          ‹
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="text-muted px-1 text-sm self-center">…</span>
          ) : (
            <button
              key={p}
              className={`btn btn-sm min-w-8 ${page === p ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onChange(p as number)}
              disabled={loading}
            >
              {p}
            </button>
          )
        )}

        <button className="btn btn-secondary btn-sm"
          onClick={() => onChange(page + 1)} disabled={page === totalPages || loading}>
          ›
        </button>
        <button className="btn btn-secondary btn-sm"
          onClick={() => onChange(totalPages)} disabled={page === totalPages || loading}>
          »
        </button>
      </div>
    </div>
  );
}