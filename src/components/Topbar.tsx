import { SearchTrigger } from "./GlobalSearch";
import { useLang } from "../contexts/LangContext";
import { useState } from "react";
import Icon from "./Icon";

export function Topbar({ setActive }: { setActive: (page: string) => void }) {
    const [dbTooltip, setDbTooltip] = useState(false);
    const { lang, setLang } = useLang();

    return (
        <header className="topbar">
            {/* Global search trigger */}
            <SearchTrigger />

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>

                {/* DB path indicator */}
                <div className="relative">
                    <button
                        className="btn btn-ghost btn-icon"
                        title="Database"
                        onMouseEnter={() => setDbTooltip(true)}
                        onMouseLeave={() => setDbTooltip(false)}
                        onClick={() => setActive("settings")}
                    >
                        <Icon d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zM12 13.5c-4.42 0-8-1.57-8-3.5s3.58-3.5 8-3.5 8 1.57 8 3.5-3.58 3.5-8 3.5z" size={17} />
                    </button>
                    {dbTooltip && (
                        <div className="absolute right-0 p-[6px_10px] " style={{
                            top: "calc(100% + 6px)",
                            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            fontSize: 12, color: "var(--color-text-secondary)",
                            whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            zIndex: 50,
                        }}>
                            📂 Database connected
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />

                {/* Language toggle */}
                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={() => setLang("en")}
                        style={{
                            padding: "3px 8px", borderRadius: "var(--radius-sm)", border: "none",
                            background: lang === "en" ? "var(--color-saffron-100)" : "transparent",
                            color: lang === "en" ? "var(--color-saffron-700)" : "var(--color-text-muted)",
                            fontWeight: lang === "en" ? 700 : 400,
                            cursor: "pointer", fontSize: 13, fontFamily: "var(--font-sans)",
                        }}
                    >ENG</button>
                    <span style={{ color: "var(--color-border)", fontSize: 12 }}>|</span>
                    <button
                        onClick={() => setLang("bn")}
                        style={{
                            padding: "3px 8px", borderRadius: "var(--radius-sm)", border: "none",
                            background: lang === "bn" ? "var(--color-saffron-100)" : "transparent",
                            color: lang === "bn" ? "var(--color-saffron-700)" : "var(--color-text-muted)",
                            fontWeight: lang === "bn" ? 700 : 400,
                            cursor: "pointer", fontSize: 13, fontFamily: "var(--font-sans)",
                        }}
                    >বাংলা</button>
                </div>
            </div>
        </header>
    );
}
