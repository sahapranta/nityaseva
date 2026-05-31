import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import LoginScreen from "../pages/Login";
import SetupWizard from "../components/StepWizard";
import { TursoSetupScreen } from "../pages/TursoSetup";
import { useLang } from "./LangContext";

// Types
export interface AuthUser {
    id: number;
    name: string;
    mobile: string | null;
    role: "super_admin" | "admin" | "operator";
    status: string;
}

interface SyncStatus {
    connected: boolean;
    last_synced: string | null;
    message: string;
}

interface AuthCtx {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
    syncStatus: SyncStatus | null;
    syncing: boolean;
    triggerSync: () => void;
}

const AuthContext = createContext<AuthCtx>({
    user: null,
    login: () => { },
    logout: () => { },
    syncStatus: null,
    syncing: false,
    triggerSync: () => { },
});

type AppState = "checking" | "turso_setup" | "user_setup" | "login" | "syncing" | "ready";

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [appState, setAppState] = useState<AppState>("checking");
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [syncing, setSyncing] = useState(false);
    const { tr } = useLang();

    // Listen for sync events from Rust
    useEffect(() => {
        const unlisten = listen<SyncStatus>("sync-status", (event) => {
            setSyncStatus(event.payload);
            setSyncing(false);
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    // On mount: check DB status → decide what screen to show    
    useEffect(() => {
        (async () => {
            try {
                const status = await invoke<string>("get_db_init_status");
                if (status === "ok") {
                    const hasUser = await invoke<boolean>("has_users");
                    setAppState(hasUser ? "login" : "user_setup");
                } else {
                    // Check if turso was ever configured by checking
                    // if replica file exists via a separate command
                    const everConfigured = await invoke<boolean>("turso_ever_configured");
                    setAppState(everConfigured ? "login" : "turso_setup");
                }
            } catch {
                setAppState("turso_setup");
            }
        })();
    }, []);

    // Sync after login (background, non-blocking)
    const syncAfterLogin = async () => {
        setSyncing(true);
        try {
            const status = await invoke<SyncStatus>("turso_sync");
            setSyncStatus(status);
        } catch {
            setSyncing(false);
        } finally {
            setAppState("ready");
            setSyncing(false);
        }
    };

    const triggerSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const status = await invoke<SyncStatus>("turso_sync");
            setSyncStatus(status);
        } catch (e) {
            setSyncStatus({ connected: false, last_synced: null, message: String(e) });
            setSyncing(false);
        }
    };

    const handleLogin = (u: AuthUser) => {
        setUser(u);
        setAppState("syncing");
        syncAfterLogin();
    };

    const handleLogout = () => {
        setUser(null);
        setAppState("login");
        setSyncStatus(null);
    };

    if (appState === "checking") {
        return (
            <div className="flex h-screen items-center justify-center bg-surface-0 text-sm text-text-muted">
                <div className="text-center">
                    <img src="/logo.png" alt="Nityaseva Logo" className="w-32 shadow-2xl rounded-full" />
                    Starting…
                </div>
            </div>
        );
    }

    if (appState === "turso_setup") {
        return (
            <TursoSetupScreen onDone={async () => {
                const hasUser = await invoke<boolean>("has_users");
                setAppState(hasUser ? "login" : "user_setup");
            }} />
        );
    }

    if (appState === "user_setup") {
        return <SetupWizard onDone={() => setAppState("login")} />;
    }

    if (appState === "login" || !user) {
        return (
            <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout, syncStatus, syncing, triggerSync }}>
                <LoginScreen onLogin={(u) => { handleLogin(u); }} />
            </AuthContext.Provider>
        );
    }

    if (appState === "syncing") {
        return (
            <div className="flex h-screen items-center justify-center bg-surface-0 text-sm text-text-muted">
                <div className="text-center">
                    <img src="/logo.png" alt="Nityaseva Logo" className="w-32 shadow-2xl rounded-full" />
                    <p className="mt-6 text-sm">{tr('initializing')}…</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login: handleLogin, logout: handleLogout, syncStatus, syncing, triggerSync }}>
            {children}
        </AuthContext.Provider>
    );
}