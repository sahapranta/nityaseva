import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import LoginScreen from "../pages/Login";
import SetupWizard from "../components/StepWizard";

// Types
export interface AuthUser {
    id: number;
    name: string;
    mobile: string | null;
    role: "super_admin" | "admin" | "operator";
    status: string;
}

interface AuthCtx {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
    user: null,
    login: () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [ready, setReady] = useState<"checking" | "setup" | "login" | "done">("checking");

    useEffect(() => {
        invoke<boolean>("has_users")
            .then((has) => setReady(has ? "login" : "setup"))
            .catch(() => setReady("login"));
    }, []);

    if (ready === "checking") {
        return (
            <div className="h-screen flex items-center justify-center text-slate-400 font-medium animate-pulse">
                Initializing...
            </div>
        );
    }

    if (ready === "setup") {
        return <SetupWizard onDone={() => setReady("login")} />;
    }

    if (ready === "login" || !user) {
        return (
            <AuthContext.Provider value={{ user, login: setUser, logout: () => setUser(null) }}>
                <LoginScreen onLogin={(u) => { setUser(u); setReady("done"); }} />
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login: setUser, logout: () => { setUser(null); setReady("login"); } }}>
            {children}
        </AuthContext.Provider>
    );
}