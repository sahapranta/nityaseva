import { useState, useEffect } from "react";

export default function PinPad({ onComplete }:
    { onComplete: (pin: string) => void }) {
    const [pin, setPin] = useState("");

    const press = (digit: string) => {
        setPin((prev) => {
            if (prev.length >= 6) return prev;
            const next = prev + digit;
            if (next.length === 6) {
                // Short delay for visual feedback of the last dot filling
                setTimeout(() => {
                    onComplete(next);
                    setPin("");
                }, 150);
            }
            return next;
        });
    };

    const del = () => setPin((p) => p.slice(0, -1));

    // Keyboard Binding
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= "0" && e.key <= "9") {
                press(e.key);
            } else if (e.key === "Backspace") {
                del();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pin]); // Re-bind to ensure closure has current pin length check

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Dots */}
            <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${i < pin.length
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
                            onClick={() => (k === "⌫" ? del() : press(k))}
                            className={`w-12 h-10 flex items-center justify-center rounded-xl text-lg font-bold transition-all active:scale-95 ${k === "⌫"
                                ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                : "bg-white border border-slate-200 text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50"
                                }`}
                        >
                            {k}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}