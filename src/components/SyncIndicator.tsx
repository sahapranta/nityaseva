import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

export default function SyncIndicator() {
    const { syncStatus, syncing, triggerSync } = useAuth();
    const [showConfirm, setShowConfirm] = useState(false);

    const isOnline = syncStatus?.connected ?? false;
    const lastSynced = syncStatus?.last_synced;

    // Check if last sync was within 5 minutes
    const isLastSyncRecent = (): boolean => {
        if (!lastSynced) return false;
        const lastSyncTime = new Date(lastSynced).getTime();
        const now = new Date().getTime();
        const fiveMinutesMs = 5 * 60 * 1000;
        return (now - lastSyncTime) < fiveMinutesMs;
    };

    const handleRefreshClick = () => {
        if (!isOnline) return;
        if (isLastSyncRecent()) {
            setShowConfirm(true);
        } else {
            triggerSync();
        }
    };

    const handleConfirm = () => {
        setShowConfirm(false);
        triggerSync();
    };

    const statusColor = syncing
        ? "text-yellow-600"
        : isOnline
            ? "text-green-600"
            : "text-gray-500";

    const dotColor = syncing
        ? "bg-yellow-500"
        : isOnline
            ? "bg-green-500"
            : "bg-gray-400";

    const dotGlow = syncing
        ? "shadow-[0_0_0_3px_rgba(250,_204,_21,_0.25)]"
        : "";

    const dotAnimation = syncing ? "animate-pulse" : "";

    return (
        <>
            <div className="flex items-center gap-2">
                {/* Status dot + label */}
                <div className="flex items-center gap-1.5">
                    <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300 ${dotColor} ${dotGlow} ${dotAnimation}`}
                    />
                    <span className={`text-xs font-medium transition-colors ${statusColor}`}>
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
                        className={`btn btn-ghost btn-icon transition-opacity ${!isOnline ? "opacity-40 cursor-not-allowed" : "opacity-100"}`}
                        onClick={handleRefreshClick}
                        disabled={!isOnline}
                        title={isOnline ? "Sync now" : "No internet connection"}
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
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
                )}
            </div>

            {/* Confirmation dialog for recent sync */}
            {showConfirm && (
                <ConfirmDialog
                    message="Synced recently. Sync again?"
                    onConfirm={handleConfirm}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
        </>
    );
}