import { SearchTrigger } from "./GlobalSearch";
import { useLang, Lang } from "../contexts/LangContext";
import { useState } from "react";
import Icon from "./Icon";

export function Topbar({ setActive }: { setActive: (page: string) => void }) {
    const [dbTooltip, setDbTooltip] = useState(false);
    const { lang, setLang } = useLang();

    const langs: { id: Lang; label: string }[] = [
        { id: "en", label: "ENG" },
        { id: "bn", label: "বাংলা" },
    ];

    return (
        <header className="topbar">
            {/* Global search trigger */}
            <SearchTrigger />

            <div className="flex items-center gap-1.5 ml-auto">
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
                        <div className="absolute right-0 p-[6px_10px] text-xs text-text-secondary bg-surface-2 rounded-md z-50" style={{
                            top: "calc(100% + 6px)",
                            border: "1px solid var(--color-border)",
                            whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                        }}>
                            📂 Database connected
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="bg-border w-[1px] h-5 m-[0_4px]" />

                <div className="flex items-center p-1 bg-gray-50 border border-border-soft rounded-full w-fit">
                    {langs.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => setLang(l.id)}
                            className={`
                            px-2 py-1 text-xs font-medium transition-all duration-200 rounded-full cursor-pointer
                            ${lang === l.id
                                    ? "bg-saffron-100 text-saffron-700 shadow-sm"
                                    : "text-text-muted hover:text-saffron-600"}
                            `}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
            </div>
        </header>
    );
}
