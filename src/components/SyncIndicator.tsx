import { useAuth } from "../contexts/AuthContext";

export default function SyncIndicator() {
    const { syncStatus, syncing, triggerSync } = useAuth();

    const isOnline = syncStatus?.connected ?? false;
    const lastSynced = syncStatus?.last_synced;

    return (
        <div className="flex items-center gap-2">
            {/* Status dot + label */}
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                    background: syncing
                        ? "var(--color-saffron-500)"
                        : isOnline
                            ? "var(--color-success)"
                            : "var(--color-text-muted)",
                    boxShadow: syncing ? "0 0 0 3px color-mix(in srgb, var(--color-saffron-400) 25%, transparent)" : "none",
                    transition: "all 300ms",
                    animation: syncing ? "pulse 1s infinite" : "none",
                }} />
                <span className="text-xs font-medium" style={{
                    color: syncing
                        ? "var(--color-saffron-600)"
                        : isOnline
                            ? "var(--color-success)"
                            : "var(--color-text-muted)",
                }}>
                    {syncing
                        ? "Syncing…"
                        : isOnline
                            ? lastSynced ? `Synced ${lastSynced}` : "Online"
                            : "Offline"}
                </span>
            </div>

            {/* Refresh button — only show when not syncing */}
            {!syncing && (
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={triggerSync}
                    title={isOnline ? "Sync now" : "No internet connection"}
                    style={{ opacity: isOnline ? 1 : 0.4, cursor: isOnline ? "pointer" : "not-allowed" }}
                >
                    {/* Refresh icon */}
                    <svg
                        width={16} height={16} viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={1.8}
                        strokeLinecap="round" strokeLinejoin="round"
                    >
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                </button>
            )}

            {/* Spinning icon when syncing */}
            {syncing && (
                <div className="w-4 h-4 rounded-full" style={{
                    border: "2px solid var(--color-surface-4)",
                    borderTop: "2px solid var(--color-saffron-500)",
                    animation: "spin 0.8s linear infinite",
                }} />
            )}
        </div>
    );
}