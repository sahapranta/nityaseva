import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Donation, Member } from "../types/donations";
import { useLang } from "../contexts/LangContext";
import { PagedResult } from "../hooks/usePagination";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
    donation: Donation | null;
    onSave: (id: number) => void;
    onClose: () => void;
    currentUserId: number;
    prefillMember?: { id: number; name: string; mobile: string | null } | null;
}

interface MonthlyEntry {
    id: string;
    type: "monthly";
    monthIndex: number;
    year: number;
    amount: number;
}

interface OtherEntry {
    id: string;
    type: "other";
    paid_for: string;
    amount: number;
}

type Entry = MonthlyEntry | OtherEntry;

// ─── Constants ────────────────────────────────────────────────────────────────

const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FULL_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextMonth(monthIndex: number, year: number): [number, number] {
    return monthIndex === 11 ? [0, year + 1] : [monthIndex + 1, year];
}

let _idCounter = 0;
const nextId = () => String(++_idCounter);

const makeMonthlyEntry = (monthIndex: number, year: number): MonthlyEntry => ({
    id: nextId(), type: "monthly", monthIndex, year, amount: 0,
});

const makeOtherEntry = (): OtherEntry => ({
    id: nextId(), type: "other", paid_for: "", amount: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function DonationModal({
    donation, onSave, onClose, currentUserId, prefillMember,
}: Props) {
    const { tr } = useLang();
    const isEditing = !!donation;

    // ── Member search ──────────────────────────────────────────────────────────
    const [memberSearch, setMemberSearch] = useState(
        donation?.member_name ?? prefillMember?.name ?? ""
    );
    const [memberResults, setMemberResults] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(
        donation
            ? { id: donation.member_id, name: donation.member_name, mobile: donation.member_mobile }
            : prefillMember ?? null
    );
    const memberDropdownRef = useRef<HTMLDivElement>(null);

    // ── Entries (new donation only) ────────────────────────────────────────────
    const now = new Date();
    const [initMonth, initYear] = getNextMonth(now.getMonth(), now.getFullYear());
    const [entries, setEntries] = useState<Entry[]>(() => [
        makeMonthlyEntry(initMonth, initYear),
    ]);

    // ── Edit-mode fields ──────────────────────────────────────────────────────
    // Detect whether this record is a monthly donation by its type name
    const isEditMonthly = isEditing &&
        (donation!.donation_type_name?.toLowerCase() === "monthly" ||
            // fallback: paid_for matches "MMM YYYY" pattern
            /^[A-Za-z]{3}\s+\d{4}$/.test(donation?.paid_for ?? ""));

    // Parse paid_for "Jan 2026" → { monthIndex, year } for the picker
    const parsedEditMonth = (() => {
        if (!isEditing || !donation?.paid_for) return { monthIndex: initMonth, year: initYear };
        const parts = donation.paid_for.split(" ");
        const mIdx = SHORT_MONTHS.indexOf(parts[0]);
        const yr = parseInt(parts[1] ?? "", 10);
        if (mIdx !== -1 && !isNaN(yr)) return { monthIndex: mIdx, year: yr };
        return { monthIndex: initMonth, year: initYear };
    })();

    const [editAmount, setEditAmount] = useState<number>(donation?.amount ?? 0);
    const [editMonthIndex, setEditMonthIndex] = useState<number>(parsedEditMonth.monthIndex);
    const [editYear, setEditYear] = useState<number>(parsedEditMonth.year);
    const [editPaidFor, setEditPaidFor] = useState<string>(
        isEditMonthly ? "" : (donation?.paid_for ?? "")
    );

    // ── Shared fields ──────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        slip_no: donation?.slip_no ?? "",
        note: donation?.note ?? "",
        donated_at: donation?.donated_at?.slice(0, 10) ?? now.toISOString().slice(0, 10),
    });

    const [saveError, setSaveError] = useState("");
    const [saving, setSaving] = useState(false);

    // ── Member search debounce ─────────────────────────────────────────────────

    useEffect(() => {
        if (memberSearch.length < 2 || selectedMember) return;
        const t = setTimeout(async () => {
            try {
                const res = await invoke<PagedResult<Member>>("list_members", {
                    search: memberSearch,
                    status: null,
                    page: 1,
                    pageSize: 6,
                });
                setMemberResults((res.data ?? []).slice(0, 6));
            } catch (e) {
                console.error("Member search error:", e);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [memberSearch, selectedMember]);

    // Close member dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                memberDropdownRef.current &&
                !memberDropdownRef.current.contains(e.target as Node)
            ) {
                setMemberResults([]);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Derived
    const totalAmount = isEditing
        ? (Number(editAmount) || 0)
        : entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const setField = (k: keyof typeof form, v: string) =>
        setForm(f => ({ ...f, [k]: v }));

    // Entry mutations
    const addMonthlyEntry = () => {
        const lastMonthly = [...entries]
            .reverse()
            .find((e): e is MonthlyEntry => e.type === "monthly");
        const [m, y] = lastMonthly
            ? getNextMonth(lastMonthly.monthIndex, lastMonthly.year)
            : [initMonth, initYear];
        setEntries(prev => [...prev, makeMonthlyEntry(m, y)]);
    };

    const addOtherEntry = () =>
        setEntries(prev => [...prev, makeOtherEntry()]);

    const removeEntry = (id: string) => {
        if (entries.length === 1) {
            setSaveError("At least one entry is required.");
            return;
        }
        setEntries(prev => prev.filter(e => e.id !== id));
        setSaveError("");
    };

    const updateEntry = (id: string, patch: Partial<Entry>) =>
        setEntries(prev =>
            prev.map(e => (e.id === id ? ({ ...e, ...patch } as Entry) : e))
        );

    const handleSave = async () => {
        setSaveError("");

        if (!selectedMember) {
            setSaveError("Please select a member.");
            return;
        }
        if (totalAmount <= 0) {
            setSaveError("Total amount must be greater than zero.");
            return;
        }
        if (!isEditing) {
            for (const e of entries) {
                if ((Number(e.amount) || 0) <= 0) {
                    setSaveError("All entries must have a valid amount.");
                    return;
                }
                if (e.type === "other" && !e.paid_for.trim()) {
                    setSaveError("All other entries must have a description.");
                    return;
                }
            }
        }

        setSaving(true);
        try {
            if (isEditing) {
                await invoke("update_donation", {
                    id: donation!.id,
                    input: {
                        member_id: selectedMember.id,
                        donation_type: null,
                        amount: totalAmount,
                        paid_for: isEditMonthly ? `${SHORT_MONTHS[editMonthIndex]} ${editYear}` : (editPaidFor.trim() || null),
                        collected_by: currentUserId,
                        slip_no: form.slip_no || null,
                        note: form.note || null,
                        donated_at: form.donated_at || null,
                    },
                });
                onSave(donation!.id);
            } else {
                const batchEntries = entries.map(e =>
                    e.type === "monthly"
                        ? {
                            donation_type: "1",
                            paid_for: `${SHORT_MONTHS[e.monthIndex]} ${e.year}`,
                            amount: e.amount,
                        }
                        : {
                            donation_type: "5",
                            paid_for: e.paid_for,
                            amount: e.amount,
                        }
                );
                const id = await invoke<number>("create_donations_batch", {
                    input: {
                        member_id: selectedMember.id,
                        entries: batchEntries,
                        collected_by: currentUserId,
                        slip_no: form.slip_no || null,
                        note: form.note || null,
                        donated_at: form.donated_at || null,
                    },
                });
                onSave(id);
            }
        } catch (e) {
            setSaveError(String(e));
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div className="modal-overlay">
            <div
                className="modal"
                style={{ maxWidth: 520, display: "flex", flexDirection: "column", maxHeight: "90vh" }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-title">
                        {isEditing ? tr("edit_donation") : tr("new_donation")}
                    </div>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M18.364 5.636a1 1 0 0 0-1.414-1.414L12 9.172 7.05 4.222a1 1 0 1 0-1.414 1.414L10.586 12l-4.95 4.95a1 1 0 1 0 1.414 1.414L12 14.828l4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95z" />
                        </svg>
                    </button>
                </div>
             
                <div className="modal-body flex flex-col gap-4 flex-1 overflow-auto">
                    <div className="form-group relative" ref={memberDropdownRef}>
                        <label className="label">
                            {tr("member")} <span className="text-danger">*</span>
                        </label>

                        {selectedMember ? (
                            <div className="flex items-center justify-between bg-surface-2 border border-border rounded-md px-3 py-2">
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-sm truncate">
                                        {selectedMember.name}
                                    </span>
                                    {selectedMember.mobile && (
                                        <span className="text-muted text-xs mt-0.5">
                                            {selectedMember.mobile}
                                        </span>
                                    )}
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm shrink-0 ml-3"
                                    onClick={() => {
                                        setSelectedMember(null);
                                        setMemberSearch("");
                                        setSaveError("");
                                    }}
                                >
                                    {tr("change")}
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    className="input"
                                    placeholder="Search by name or mobile…"
                                    value={memberSearch}
                                    onChange={e => {
                                        setMemberSearch(e.target.value);
                                        setSaveError("");
                                    }}
                                    autoFocus
                                />
                                {memberResults.length > 0 && (
                                    <div
                                        className="absolute left-0 right-0 z-20 bg-surface-2 border border-border rounded-md mt-1 overflow-hidden"
                                        style={{
                                            top: "100%",
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                        }}
                                    >
                                        {memberResults.map((m, i) => (
                                            <div
                                                key={m.id}
                                                className="px-3 py-2 cursor-pointer flex flex-col transition-colors"
                                                style={{
                                                    borderTop: i > 0
                                                        ? "1px solid var(--color-border-soft)"
                                                        : undefined,
                                                }}
                                                onMouseEnter={e =>
                                                (e.currentTarget.style.background =
                                                    "var(--color-surface-3)")
                                                }
                                                onMouseLeave={e =>
                                                    (e.currentTarget.style.background = "")
                                                }
                                                onClick={() => {
                                                    setSelectedMember(m);
                                                    setMemberResults([]);
                                                    setMemberSearch(m.name);
                                                    setSaveError("");
                                                }}
                                            >
                                                <span className="font-medium text-sm">{m.name}</span>
                                                {m.mobile && (
                                                    <span className="text-muted text-xs">{m.mobile}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Entries (new donation only) --------------------------- */}
                    {!isEditing && (
                        <div className="form-group">
                            <div className="flex items-center justify-between mb-2">
                                <label className="label mb-0">
                                    Donations <span className="text-danger">*</span>
                                </label>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addMonthlyEntry}
                                    >
                                        + Add Month
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addOtherEntry}
                                    >
                                        + Add Other
                                    </button>
                                </div>
                            </div>

                            <div
                                className="flex flex-col gap-1.5"
                                style={{ maxHeight: 252, overflowY: "auto", paddingRight: 2 }}
                            >
                                {entries.map(entry => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border border-border rounded-md hover:bg-surface-3 transition-colors"
                                    >
                                        {/* Type badge */}
                                        <span
                                            className="text-xs font-medium rounded px-1.5 py-0.5 shrink-0 select-none"
                                            style={{
                                                minWidth: "3.25rem",
                                                textAlign: "center",
                                                background: entry.type === "monthly"
                                                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                                                    : "var(--color-surface-3)",
                                                color: entry.type === "monthly"
                                                    ? "var(--color-primary)"
                                                    : "var(--color-text-muted)",
                                            }}
                                        >
                                            {entry.type === "monthly" ? "Month" : "Other"}
                                        </span>

                                        {/* Month select + year / description */}
                                        {entry.type === "monthly" ? (
                                            <>
                                                <select
                                                    className="input text-sm"
                                                    style={{ flex: "1 1 0", minWidth: 0 }}
                                                    value={entry.monthIndex}
                                                    onChange={e =>
                                                        updateEntry(entry.id, {
                                                            monthIndex: Number(e.target.value),
                                                        })
                                                    }
                                                >
                                                    {FULL_MONTHS.map((m, i) => (
                                                        <option key={i} value={i}>{m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    className="input text-sm"
                                                    type="number"
                                                    style={{ width: "5.5rem", flexShrink: 0 }}
                                                    value={entry.year}
                                                    min={2000}
                                                    max={2100}
                                                    onChange={e =>
                                                        updateEntry(entry.id, {
                                                            year: Number(e.target.value),
                                                        })
                                                    }
                                                />
                                            </>
                                        ) : (
                                            <input
                                                className="input text-sm"
                                                type="text"
                                                style={{ flex: "1 1 0", minWidth: 0 }}
                                                value={entry.paid_for}
                                                placeholder="e.g. Festival donation"
                                                onChange={e =>
                                                    updateEntry(entry.id, {
                                                        paid_for: e.target.value,
                                                    })
                                                }
                                            />
                                        )}

                                        {/* Amount */}
                                        <input
                                            className="input text-sm text-right"
                                            type="number"
                                            style={{ width: "6.5rem", flexShrink: 0 }}
                                            value={entry.amount || ""}
                                            min={0}
                                            placeholder="0.00"
                                            onChange={e =>
                                                updateEntry(entry.id, {
                                                    amount: Number(e.target.value),
                                                })
                                            }
                                        />

                                        {/* Remove / spacer */}
                                        {entries.length > 1 ? (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm shrink-0"
                                                style={{
                                                    color: "var(--color-danger)",
                                                    padding: "0 0.375rem",
                                                }}
                                                onClick={() => removeEntry(entry.id)}
                                                aria-label="Remove entry"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                                    <path d="M18.364 5.636a1 1 0 0 0-1.414-1.414L12 9.172 7.05 4.222a1 1 0 1 0-1.414 1.414L10.586 12l-4.95 4.95a1 1 0 1 0 1.414 1.414L12 14.828l4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95z" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <span style={{ width: "1.625rem", flexShrink: 0 }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Edit-mode entry row ---------------------------------------- */}
                    {isEditing && (
                        isEditMonthly ? (
                            /* Monthly: month picker + year + amount */
                            <div className="form-group">
                                <label className="label mb-2">
                                    Donation <span className="text-danger">*</span>
                                </label>
                                <div className="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border border-border rounded-md">
                                    <span
                                        className="text-xs font-medium rounded px-1.5 py-0.5 shrink-0 select-none"
                                        style={{
                                            minWidth: "3.25rem",
                                            textAlign: "center",
                                            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                                            color: "var(--color-primary)",
                                        }}
                                    >
                                        Month
                                    </span>
                                    <select
                                        className="input text-sm"
                                        style={{ flex: "1 1 0", minWidth: 0 }}
                                        value={editMonthIndex}
                                        onChange={e => setEditMonthIndex(Number(e.target.value))}
                                    >
                                        {FULL_MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <input
                                        className="input text-sm"
                                        type="number"
                                        style={{ width: "5.5rem", flexShrink: 0 }}
                                        value={editYear}
                                        min={2000}
                                        max={2100}
                                        onChange={e => setEditYear(Number(e.target.value))}
                                    />
                                    <input
                                        className="input text-sm text-right"
                                        type="number"
                                        style={{ width: "6.5rem", flexShrink: 0 }}
                                        value={editAmount || ""}
                                        min={0}
                                        placeholder="0.00"
                                        onChange={e => setEditAmount(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Other: description + amount */
                            <div className="form-group">
                                <label className="label mb-2">
                                    Donation <span className="text-danger">*</span>
                                </label>
                                <div className="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border border-border rounded-md">
                                    <span
                                        className="text-xs font-medium rounded px-1.5 py-0.5 shrink-0 select-none text-text-muted bg-surface-3 text-center"
                                        style={{
                                            minWidth: "3.25rem",
                                            textAlign: "center",
                                        }}
                                    >
                                        Other
                                    </span>
                                    <input
                                        className="input text-sm"
                                        type="text"
                                        style={{ flex: "1 1 0", minWidth: 0 }}
                                        value={editPaidFor}
                                        placeholder="e.g. Festival donation"
                                        onChange={e => setEditPaidFor(e.target.value)}
                                    />
                                    <input
                                        className="input text-sm text-right"
                                        type="number"
                                        style={{ width: "6.5rem", flexShrink: 0 }}
                                        value={editAmount || ""}
                                        min={0}
                                        placeholder="0.00"
                                        onChange={e => setEditAmount(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        )
                    )}

                    {!isEditing && (
                        <div
                            className="flex items-center justify-between rounded-md px-3 py-2.5 border border-border bg-surface-2"
                        >
                            <span className="text-sm text-muted">
                                {entries.length} {entries.length === 1 ? "entry" : "entries"}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xs text-muted uppercase tracking-wide">Total</span>
                                <span className="text-sm font-semibold text-primary">
                                    {totalAmount.toLocaleString("en-BD", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}{" "}
                                    BDT
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="form-group">
                            <label className="label">{tr("slip_no")}</label>
                            <input
                                className="input"
                                value={form.slip_no}
                                onChange={e => setField("slip_no", e.target.value)}
                                placeholder="e.g. SLIP-001"
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">{tr("date")}</label>
                            <input
                                className="input"
                                type="date"
                                value={form.donated_at}
                                onChange={e => setField("donated_at", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">{tr("note")}</label>
                        <input
                            className="input"
                            value={form.note}
                            onChange={e => setField("note", e.target.value)}
                            placeholder="Optional note"
                        />
                    </div>

                    {saveError && (
                        <div
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-danger"
                            style={{
                                background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)",
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
                                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 5a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1zm0 8a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                            </svg>
                            {saveError}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {tr("cancel")}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? tr("saving")
                            : isEditing
                                ? tr("save_changes")
                                : tr("record_donation")}
                    </button>
                </div>

            </div>
        </div>
    );
}