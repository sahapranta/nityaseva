import { useState } from 'react';

export const Copyable = ({ mobile }: { mobile: string | null }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        if (!mobile) return;

        try {
            await navigator.clipboard.writeText(mobile);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    return (
        <div className="relative cursor-pointer" onClick={handleCopy}>
            {mobile ?? "—"}
            {mobile && isCopied && (
                <span
                    className="badge bg-indigo-400 text-white absolute start-6 translate-middle-x"
                    style={{
                        top: '-25px',
                        zIndex: 10,
                        fontSize: '0.75rem',
                        animation: 'fadeIn 0.2s ease'
                    }}
                >
                    Copied!
                </span>
            )}
        </div>
    );
};