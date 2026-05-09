import { useState, useEffect } from "react";

const SAVED_MOBILE_KEY = "nityaseva_last_mobile";

export default function PinPad({ onComplete }: {
    onComplete: (mobile: string, pin: string) => void
}) {
    const [pin, setPin] = useState("");
    const [mobile, setMobile] = useState(() =>
        localStorage.getItem(SAVED_MOBILE_KEY) ?? ""
    );
    const [showMobileInput, setShowMobileInput] = useState(() =>
        !localStorage.getItem(SAVED_MOBILE_KEY)
    );

    const press = (digit: string) => {
        if (pin.length >= 6) return;
        const next = pin + digit;
        setPin(next);
        if (next.length === 6) {
            // Save mobile for next time
            if (mobile) localStorage.setItem(SAVED_MOBILE_KEY, mobile);
            setTimeout(() => { onComplete(mobile, next); setPin(""); }, 120);
        }
    };

    const del = () => setPin(p => p.slice(0, -1));

    const handleChangeMobile = () => {
        setShowMobileInput(true);
        setPin("");
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showMobileInput) return; // don't capture keys when typing mobile
            if (e.key >= "0" && e.key <= "9") press(e.key);
            else if (e.key === "Backspace") del();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pin, showMobileInput]);

    const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

    return (
        <div className="flex flex-col items-center gap-6">
            {showMobileInput ? (
                /* Mobile input step */
                <div className="flex flex-col items-center gap-4 w-full">
                    <p className="text-sm text-slate-500">Enter your mobile number</p>
                    <input
                        type="tel"
                        placeholder="01XXXXXXXXX"
                        value={mobile}
                        onChange={e => setMobile(e.target.value)}
                        autoFocus
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-orange-500/20
                                   focus:border-orange-500 text-center text-lg tracking-widest"
                        onKeyDown={e => {
                            if (e.key === "Enter" && mobile.trim()) {
                                setShowMobileInput(false);
                            }
                        }}
                    />
                    <button
                        onClick={() => { if (mobile.trim()) setShowMobileInput(false); }}
                        disabled={!mobile.trim()}
                        className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40
                                   text-white rounded-lg font-semibold transition-all"
                    >
                        Continue →
                    </button>
                </div>
            ) : (
                /* PIN input step */
                <>
                    {/* Saved mobile display */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{mobile}</span>
                        <button
                            onClick={handleChangeMobile}
                            className="text-xs text-orange-600 hover:underline"
                        >
                            Change
                        </button>
                    </div>

                    {/* Dots */}
                    <div className="flex gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all
                                ${i < pin.length
                                    ? "bg-saffron-600 border-saffron-600 scale-110"
                                    : "bg-slate-100 border-slate-200"
                                }`}
                            />
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {keys.map((k, i) => {
                            if (k === "") return <div key={i} />;
                            return (
                                <button
                                    key={i}
                                    onClick={() => k === "⌫" ? del() : press(k)}
                                    className={`w-12 h-10 flex items-center justify-center rounded-xl
                                        text-lg font-bold transition-all active:scale-95
                                        ${k === "⌫"
                                            ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                            : "bg-white border border-slate-200 text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50"
                                        }`}
                                >
                                    {k}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}