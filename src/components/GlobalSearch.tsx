import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, createSearchParams } from "react-router-dom";
import type { PagedResult } from "../hooks/usePagination";

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

export function GlobalSearch() {
  const onNavigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    else { setQuery(""); setResults([]); setCurrentPage(1); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setCurrentPage(1); return; }
    const t = setTimeout(() => {
      setCurrentPage(1);
      setResults([]);
      loadResults(1);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const loadResults = async (page: number) => {
    setLoading(true);
    try {
      const data = await invoke<PagedResult<Member>>("list_members", {
        search: query || null,
        status: null,
        page,
        pageSize: 20,
      });
      if (page === 1) {
        setResults(data.data);
      } else {
        setResults(prev => [...prev, ...data.data]);
      }
      setHasMore(page < data.total_pages);
      setCurrentPage(page);
      setHighlighted(0);
    } catch {
      console.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const div = e.currentTarget;
    if (div.scrollHeight - div.scrollTop - div.clientHeight < 50 && hasMore && !loading) {
      loadResults(currentPage + 1);
    }
  };

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
        className="w-[580px] bg-surface-2 rounded-lg border border-border shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-border-soft border-b gap-2.5 px-4 py-3">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-text-muted">
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
          <kbd className="px-1.5 py-0.5 rounded text-xs bg-surface-4 border border-border font-mono">Esc</kbd>
        </div>

        {currentPage === 1 && loading && <div className="p-5 text-center text-text-muted text-sm">Searching…</div>}
        {!loading && query && results.length === 0 && (
          <div className="p-6 text-center text-text-muted text-sm">No members found for "{query}"</div>
        )}

        {results.length > 0 && (
          <div ref={scrollRef} className="max-h-[380px] overflow-y-auto" onScroll={handleScroll}>
            {results.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-border-soft ${
                  i === highlighted ? "bg-saffron-50" : ""
                }`}
                onMouseEnter={() => setHighlighted(i)}
              >
                <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${
                  m.status === "active"
                    ? "bg-saffron-100 text-saffron-700"
                    : "bg-surface-4 text-text-muted"
                }`}>
                  {m.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => goToMember(m)}>
                  <div className="font-semibold text-sm">{m.name}</div>
                  <div className="text-xs text-text-muted">
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
            {loading && currentPage > 1 && (
              <div className="p-3 text-center text-text-muted text-xs">Loading more…</div>
            )}
          </div>
        )}

        <div className="flex gap-4 border-t border-border-soft px-4 py-2 text-xs text-text-muted">
          <span><kbd className="inline-block px-1.5 py-0.5 rounded text-xs bg-surface-4 border border-border font-mono mr-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="inline-block px-1.5 py-0.5 rounded text-xs bg-surface-4 border border-border font-mono mr-0.5">↵</kbd> view member</span>
          <span><kbd className="inline-block px-1.5 py-0.5 rounded text-xs bg-surface-4 border border-border font-mono mr-0.5">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export function SearchTrigger() {
  const trigger = () => window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true })
  );
  return (
    <div onClick={trigger}
      className="flex items-center gap-2 cursor-pointer text-sm rounded-md bg-surface-3 text-text-muted w-60 px-3 py-1.5 border border-border transition-[border-color] duration-150 hover:border-saffron-400"
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
      </svg>
      <span className="flex-1">Search members…</span>
      <kbd className="text-text-muted rounded-sm bg-surface-4 border border-border px-1.5 py-0.5 text-xs font-mono">⌘F</kbd>
    </div>
  );
}