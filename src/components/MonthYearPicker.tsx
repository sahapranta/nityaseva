import { useState, useRef, useEffect, useCallback, useId } from "react";

const currentYear = new Date().getFullYear();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;
const MIN_YEAR = 2008;
const MAX_YEAR = currentYear + 10;

interface MonthYearPickerProps {
  value?: string;           // controlled: "YYYY-MM"
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minDate?: string;         // "YYYY-MM"
  maxDate?: string;         // "YYYY-MM"
  className?: string;
}

function parseValue(val: string | null | undefined): { month: number; year: number } | null {
  if (!val) return null;
  const [y, m] = val.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, month: m - 1 };
}

function toValue(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function MonthYearPicker({
  value,
  defaultValue,
  onChange,
  disabled = false,
  placeholder = "Select month",
  minDate,
  maxDate,
  className = "",
}: MonthYearPickerProps) {
  const isControlled = value !== undefined;
  const id = useId();
  const listboxId = `${id}-listbox`;

  // Internal selection state (for uncontrolled) and the visible year in the panel
  const initialParsed = parseValue(isControlled ? value : defaultValue) ?? null;

  const [internalSelected, setInternalSelected] = useState<{ month: number; year: number } | null>(initialParsed);
  const [panelYear, setPanelYear] = useState(initialParsed?.year ?? currentYear);
  const [isOpen, setIsOpen] = useState(false);
  // Index of the month button currently focused via keyboard (0-11), -1 = year nav
  const [focusedMonth, setFocusedMonth] = useState<number>(-1);

  const selected = isControlled
    ? parseValue(value)
    : internalSelected;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const prevYearRef = useRef<HTMLButtonElement>(null);
  const nextYearRef = useRef<HTMLButtonElement>(null);
  const monthRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync panelYear when controlled value changes externally
  useEffect(() => {
    if (isControlled) {
      const p = parseValue(value);
      if (p) setPanelYear(p.year);
    }
  }, [value, isControlled]);

  // ── Click outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isOpen]);

  // ── Escape key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Focus first month when panel opens ────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setFocusedMonth(
        selected && selected.year === panelYear ? selected.month : 0
      );
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && focusedMonth >= 0) {
      monthRefs.current[focusedMonth]?.focus();
    }
  }, [focusedMonth, isOpen]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isDisabledMonth = useCallback((year: number, monthIndex: number): boolean => {
    const val = toValue(year, monthIndex);
    if (minDate && val < minDate) return true;
    if (maxDate && val > maxDate) return true;
    return false;
  }, [minDate, maxDate]);

  const open = () => { if (!disabled) setIsOpen(true); };

  const close = () => {
    setIsOpen(false);
    setFocusedMonth(-1);
  };

  const commit = (year: number, monthIndex: number) => {
    if (isDisabledMonth(year, monthIndex)) return;
    //const next = { year, month: monthIndex };
    if (!isControlled) setInternalSelected({ year, month: monthIndex });
    onChange?.(toValue(year, monthIndex));
    close();
    triggerRef.current?.focus();
  };

  // ── Keyboard navigation inside grid ───────────────────────────────────────
  const handleGridKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    switch (e.key) {
      case "ArrowRight": next = (idx + 1) % 12; break;
      case "ArrowLeft":  next = (idx + 11) % 12; break;
      case "ArrowDown":  next = Math.min(idx + 3, 11); break;
      case "ArrowUp":
        if (idx < 3) { prevYearRef.current?.focus(); setFocusedMonth(-1); return; }
        next = idx - 3;
        break;
      case "Home": next = 0; break;
      case "End":  next = 11; break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(panelYear, idx);
        return;
      case "Tab":
        // Allow natural tab out — close
        close();
        return;
      default: return;
    }
    e.preventDefault();
    setFocusedMonth(next);
  };

  const handleYearKeyDown = (e: React.KeyboardEvent, direction: "prev" | "next") => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedMonth(direction === "prev" ? 0 : 2);
    }
  };

  const canGoPrev = panelYear > MIN_YEAR;
  const canGoNext = panelYear < MAX_YEAR;

  const displayLabel = selected ? `${MONTHS[selected.month]} ${selected.year}` : null;
  const ariaLabel = selected ? `${MONTH_LABELS[selected.month]} ${selected.year}` : placeholder;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={isOpen
          ? `${ariaLabel}, press Escape to close`
          : selected
            ? `Selected: ${ariaLabel}. Press Enter to change`
            : `${placeholder}. Press Enter to open`}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={[
          "inline-flex items-center gap-2 min-w-[11rem] px-3.5 py-1.5",
          "rounded-lg border text-sm font-medium text-left",
          "transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          disabled
            ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
            : isOpen
              ? "bg-white border-indigo-500 shadow-md ring-2 ring-indigo-200 text-gray-900"
              : "bg-white border-gray-300 shadow-sm text-gray-700 hover:border-gray-400 hover:shadow focus-visible:ring-indigo-400",
        ].join(" ")}
      >
        <CalendarIcon className={`w-4 h-4 shrink-0 ${disabled ? "text-gray-300" : "text-indigo-500"}`} />
        <span className={`flex-1 truncate ${!selected ? "text-gray-400 font-normal italic" : ""}`}>
          {displayLabel ?? placeholder}
        </span>
        <ChevronIcon
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          id={listboxId}
          role="listbox"
          aria-label="Select month and year"
          aria-orientation="horizontal"
          className={[
            "absolute z-50 mt-1.5 w-64 left-0",
            "bg-white rounded-xl shadow-xl border border-gray-100",
            "ring-1 ring-black/5 overflow-hidden",
            "animate-in",
          ].join(" ")}
          style={{
            animation: "popover-in 0.15s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <button
              ref={prevYearRef}
              type="button"
              disabled={!canGoPrev}
              aria-label="Previous year"
              onClick={() => canGoPrev && setPanelYear((y) => y - 1)}
              onKeyDown={(e) => handleYearKeyDown(e, "prev")}
              className={[
                "w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                canGoPrev
                  ? "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  : "text-gray-300 cursor-not-allowed",
              ].join(" ")}
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>

            <span className="text-sm font-semibold text-gray-800 tabular-nums" aria-live="polite" aria-atomic>
              {panelYear}
            </span>

            <button
              ref={nextYearRef}
              type="button"
              disabled={!canGoNext}
              aria-label="Next year"
              onClick={() => canGoNext && setPanelYear((y) => y + 1)}
              onKeyDown={(e) => handleYearKeyDown(e, "next")}
              className={[
                "w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                canGoNext
                  ? "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  : "text-gray-300 cursor-not-allowed",
              ].join(" ")}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Month grid */}
          <div
            className="grid grid-cols-3 gap-1 p-2.5"
            role="presentation"
          >
            {MONTHS.map((month, idx) => {
              const isSelected = !!selected && selected.month === idx && selected.year === panelYear;
              const isToday = idx === new Date().getMonth() && panelYear === currentYear;
              const isDisabled = isDisabledMonth(panelYear, idx);

              return (
                <button
                  key={month}
                  ref={(el) => { monthRefs.current[idx] = el; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${MONTH_LABELS[idx]} ${panelYear}${isDisabled ? ", unavailable" : ""}`}
                  disabled={isDisabled}
                  tabIndex={focusedMonth === idx ? 0 : -1}
                  onClick={() => commit(panelYear, idx)}
                  onKeyDown={(e) => handleGridKeyDown(e, idx)}
                  className={[
                    "relative py-2 px-1 rounded-lg text-xs font-medium text-center",
                    "transition-all duration-100 select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1",
                    isDisabled
                      ? "text-gray-300 cursor-not-allowed"
                      : isSelected
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 font-semibold"
                        : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-700",
                  ].join(" ")}
                >
                  {month}
                  {/* Today indicator dot */}
                  {isToday && !isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="px-3 pb-2.5 text-[10px] text-gray-400 text-center" aria-hidden="true">
            ← → ↑ ↓ to navigate · Enter to select · Esc to close
          </p>
        </div>
      )}

      <style>{`
        @keyframes popover-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Inline icon components (no extra dependency) ───────────────────────────
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <path d="M1.5 6.5h13M5 1v3M11 1v3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}