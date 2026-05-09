import { useState } from "react";
import AuthShell from "../components/AuthShell";
import PinPad from "../components/Pinpad";
import { invoke } from "@tauri-apps/api/core";
import { AuthUser } from "../contexts/AuthContext";

export default function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePin = async (mobile: string, pin: string) => {
        setLoading(true);
        setError("");
        try {
            const user = await invoke<AuthUser>("verify_pin", {
                mobile,
                passcode: pin,
            });
            onLogin(user);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title="" subtitle="Enter your 6-digit PIN to continue">
            <PinPad onComplete={handlePin} />
            <div className="h-6 mt-4 text-center">
                {loading && <p className="text-xs text-slate-400 animate-pulse">Verifying...</p>}
                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            </div>
        </AuthShell>
    );
}