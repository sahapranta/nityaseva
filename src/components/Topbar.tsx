import { SearchTrigger } from "./GlobalSearch";
import { useLang, Lang } from "../contexts/LangContext";
import SyncIndicator from "./SyncIndicator";

export function Topbar() {
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
                <SyncIndicator />
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
