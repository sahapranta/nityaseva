import { useLang } from "../contexts/LangContext";

function SparkLine({ values }: { values: number[] }) {
    const W = 90, H = 40, pad = 3;
    const min = Math.min(...values), max = Math.max(...values);
    const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const last = values.length - 1;
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <polyline points={pts} fill="none" stroke="#BA7517" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(last)} cy={y(values[last])} r="3" fill="#BA7517" />
        </svg>
    );
}

export interface CollectionData {
    label: string;
    total: number;
    count: number;
}

export interface DaySummary {
    day: string;   // "2025-05-24"
    count: number;
    total: number;
}

function formatDayLabel(dateStr: string): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (dateStr === fmt(today)) return "today";
    if (dateStr === fmt(yesterday)) return "yesterday";

    // "12 Oct" style
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function DailyCollection({ collection }: { collection: DaySummary[] }) {
    const data: CollectionData[] = collection.map(({ day, count, total }) => ({
        label: formatDayLabel(day),
        count,
        total,
    }));

    const sparkVals = data.slice(1).map(d => d.total).reverse().concat(data[0].total);
    const { tr } = useLang();
    return (
        <div className="bg-surface-2 rounded-2xl border border-border-soft overflow-hidden font-sans shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-center px-4.5 py-3 border-b border-border-soft">
                <span className="text-xs font-medium text-gray-500 tracking-wide">{tr("daily_collection")}</span>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 border border-border-soft px-2.5 py-1 rounded-lg">{data.length} days</span>
            </div>

            {data.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted">
                    {tr("noData")}
                </div>) :
                <>
                    {/* Hero */}
                    <div className="flex justify-between items-start px-4.5 pt-4.5 pb-4 border-b border-gray-100">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold tracking-widest text-amber-700 uppercase">{tr(data[0].label)}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">+xx.xx%</span>
                            </div>
                            <div className="text-3xl font-semibold text-saffron-800 leading-none tracking-tight mb-1">৳ {data[0]?.total.toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 pt-1">
                            <SparkLine values={sparkVals} />
                            <div className="text-xs text-gray-400"><span className="text-gray-800 font-medium">{data[0]?.count || 0}</span> donations</div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="text-xs font-medium uppercase tracking-widest text-gray-400 px-4.5 pt-2 pb-1.5">Previous {data.length - 1} days</div>
                    {data.slice(1).map((day, i) => (
                        <div key={i} className="flex justify-between items-center px-4.5 py-2.5 border-t border-border-soft hover:bg-surface-3 transition-colors">
                            <div>
                                <div className="text-xs font-medium text-gray-800">{day.label}</div>
                                <div className="text-xs text-gray-400">{day.count} donations</div>
                            </div>
                            <div className="text-sm font-medium text-gray-900">৳ {day.total.toLocaleString()}</div>
                        </div>
                    ))}
                </>}
        </div>
    );
}