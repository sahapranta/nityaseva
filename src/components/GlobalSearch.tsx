import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, createSearchParams } from "react-router-dom";

interface Member {
  id: number;
  name: string;
  mobile: string | null;
  district: string | null;
  status: string;
  membership_type_name: string | null;
}

export interface SearchAction {
  page: string;
  member?: Member;
  openDonation?: boolean;
}

// interface Props {
//   onNavigate: (action: SearchAction) => void;
// }

export function GlobalSearch() {
  const onNavigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
    else { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await invoke<Member[]>("list_members", { search: query, status: null });
        setResults(data.slice(0, 8));
        setHighlighted(0);
      } catch { }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const goToMember = (m: Member) => {
    onNavigate({ pathname: "members", search: createSearchParams({ member: m.id.toString() }).toString() });
    setOpen(false);
  };

  const goToDonation = (m: Member) => {
    onNavigate("/donations", { state: { member: m, openDonation: true } });
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && results[highlighted]) goToMember(results[highlighted]);
    if (e.key === "Escape") setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex justify-center items-start bg-black/40 backdrop-blur-[2px] pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 580, background: "var(--color-surface-2)",
          borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-border-soft gap-2.5 px-4 py-3">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search members by name or mobile…"
            className="border-none outline-none bg-transparent text-text-primary font-sans text-[16px] flex-1"
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        {loading && <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>Searching…</div>}
        {!loading && query && results.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>No members found for "{query}"</div>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {results.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border-soft"
                style={{
                  background: i === highlighted ? "var(--color-saffron-50)" : "transparent",
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: m.status === "active" ? "var(--color-saffron-100)" : "var(--color-surface-4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700,
                  color: m.status === "active" ? "var(--color-saffron-700)" : "var(--color-text-muted)",
                }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => goToMember(m)}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {m.mobile ?? "No mobile"}
                    {m.district ? ` · ${m.district}` : ""}
                    {m.membership_type_name ? ` · ${m.membership_type_name}` : ""}
                  </div>
                </div>

                <span className={`badge shrink-0 ${m.status === "active" ? "badge-success" : "badge-neutral"}`}>
                  {m.status}
                </span>

                <div className="flex gap-1.5 shrink-0">
                  <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); goToMember(m); }}>
                    View
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); goToDonation(m); }}>
                    + Donate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 border-t border-border-soft px-4 py-2 text-xs text-text-muted">
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> view member</span>
          <span><kbd style={kbdStyle}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "1px 6px", borderRadius: 3,
  background: "var(--color-surface-4)", border: "1px solid var(--color-border)",
  fontFamily: "var(--font-mono)", fontSize: 11, marginRight: 2,
};

export function SearchTrigger() {
  const trigger = () => window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true })
  );
  return (
    <div onClick={trigger}
      className="flex items-center gap-2 cursor-pointer text-sm rounded-md bg-surface-3 text-text-muted w-60 px-3 py-1.5 border-border transition-[border-color] duration-150"
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-saffron-400)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
      </svg>
      <span style={{ flex: 1 }}>Search members…</span>
      <kbd className="text-text-muted rounded-sm bg-surface-4 border border-border px-1.5 py-0.5 text-xs font-mono">⌘F</kbd>
    </div>
  );
}