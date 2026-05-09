import { useState } from "react";
import AuthShell from "./AuthShell";
import PinPad from "./Pinpad";
import { invoke } from "@tauri-apps/api/core";

export default function SetupWizard({ onDone }: { onDone: () => void }) {
    const [step, setStep] = useState<"info" | "pin" | "confirm">("info");
    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    const handleInfo = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!name.trim()) { setError("Name is required"); return; }
        setError("");
        setStep("pin");
    };

    const handlePin = (p: string) => {
        setPin(p);
        setStep("confirm");
    };

    const handleConfirm = async (p: string) => {
        if (p !== pin) {
            setError("PINs do not match. Try again.");
            setStep("pin");
            setPin("");
            return;
        }
        setError("");
        try {
            await invoke("create_super_admin", {
                name: name.trim(),
                mobile: mobile.trim() || null,
                passcode: p,
            });
            onDone();
        } catch (e) {
            setError(String(e));
            setStep("pin");
        }
    };

    return (
        <AuthShell title="Setup Nityaseva" subtitle="Create the super-admin account">
            {step === "info" && (
                <form onSubmit={handleInfo} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name *</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your name"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile (optional)</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            value={mobile}
                            onChange={e => setMobile(e.target.value)}
                            placeholder="01XXXXXXXXX"
                        />
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button type="submit" className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-md shadow-orange-200 transition-all active:scale-[0.98]">
                        Continue →
                    </button>
                </form>
            )}

            {(step === "pin" || step === "confirm") && (
                <div className="flex flex-col gap-4 items-center">
                    <p className="text-sm text-slate-600 text-center">
                        {step === "pin" ? <>Set PIN for <span className="font-bold text-slate-800">{name}</span></> : "Confirm your PIN"}
                    </p>
                    <PinPad onComplete={step === "pin" ? handlePin : handleConfirm} />
                    {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
            )}
            {step === "confirm" && (
                <div className="flex items-center gap-4 flex-col">
                    <p className="text-xs text-text-secondary text-center">Confirm your PIN</p>
                    <PinPad onComplete={handleConfirm} />
                    {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
            )}
        </AuthShell>
    );
}