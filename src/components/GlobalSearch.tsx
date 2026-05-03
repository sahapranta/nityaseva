import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Member {
  id: number;
  name: string;
  mobile: string | null;
  district: string | null;
  status: string;
  membership_type_name: string | null;
}

interface Props {
  onNavigate: (page: string, memberId?: number) => void;
}

export function GlobalSearch({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await invoke<Member[]>("list_members", {
          search: query, status: null,
        });
        setResults(data.slice(0, 8));
        setHighlighted(0);
      } catch {}
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const select = (_m: Member) => {
    onNavigate("members");
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && results[highlighted]) select(results[highlighted]);
    if (e.key === "Escape") setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 540, background: "var(--color-surface-2)",
          borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--color-border-soft)" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search members by name or mobile…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 16, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)",
            }}
          />
          <kbd style={{
            padding: "2px 7px", borderRadius: 4, fontSize: 11,
            background: "var(--color-surface-4)", border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)", fontFamily: "var(--font-mono)",
          }}>Esc</kbd>
        </div>

        {/* Results */}
        {loading && (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            Searching…
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            No members found for "{query}"
          </div>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {results.map((m, i) => (
              <div
                key={m.id}
                onClick={() => select(m)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 16px", cursor: "pointer",
                  background: i === highlighted ? "var(--color-saffron-50)" : "transparent",
                  borderBottom: "1px solid var(--color-border-soft)",
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: m.status === "active" ? "var(--color-saffron-100)" : "var(--color-surface-4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700,
                  color: m.status === "active" ? "var(--color-saffron-700)" : "var(--color-text-muted)",
                }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {m.mobile ?? "No mobile"}{m.district ? ` · ${m.district}` : ""}
                    {m.membership_type_name ? ` · ${m.membership_type_name}` : ""}
                  </div>
                </div>

                <span className={`badge ${m.status === "active" ? "badge-success" : "badge-neutral"}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div style={{
          padding: "8px 16px", borderTop: "1px solid var(--color-border-soft)",
          display: "flex", gap: 16, fontSize: 12, color: "var(--color-text-muted)",
        }}>
          <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> go to members</span>
          <span><kbd style={kbdStyle}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "1px 5px", borderRadius: 3,
  background: "var(--color-surface-4)", border: "1px solid var(--color-border)",
  fontFamily: "var(--font-mono)", fontSize: 11, marginRight: 3,
};

// ── Trigger button for topbar ─────────────────────────────────────────
export function SearchTrigger() {
  const trigger = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

  return (
    <div
      onClick={trigger}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)", background: "var(--color-surface-3)",
        cursor: "pointer", width: 240, color: "var(--color-text-muted)", fontSize: 14,
        transition: "border-color 150ms",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-saffron-400)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
      </svg>
      <span style={{ flex: 1 }}>Search members…</span>
      <kbd style={{
        padding: "1px 6px", borderRadius: 4, fontSize: 11,
        background: "var(--color-surface-4)", border: "1px solid var(--color-border)",
        fontFamily: "var(--font-mono)", color: "var(--color-text-muted)",
      }}>⌘K</kbd>
    </div>
  );
}
