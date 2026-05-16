import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Donation, DonationType, Member } from "../types/donations";
import { useLang } from "../contexts/LangContext";
import { PagedResult } from "../hooks/usePagination";

interface Props {
    donation: Donation | null;
    donationTypes: DonationType[];
    onSave: (id: number) => void;
    onClose: () => void;
    currentUserId: number;
    prefillMember?: { id: number; name: string; mobile: string | null } | null;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isMonthlyType(donationType: DonationType | undefined): boolean {
    return donationType?.name.toLowerCase().includes("month") ?? false;
}

export default function DonationModal({
    donation, donationTypes, onSave, onClose, currentUserId, prefillMember
}: Props) {
    const [memberResults, setMemberResults] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(
        donation
            ? { id: donation.member_id, name: donation.member_name, mobile: donation.member_mobile }
            : prefillMember ?? null
    );

    const [memberSearch, setMemberSearch] = useState(
        donation?.member_name ?? prefillMember?.name ?? ""
    );

    const defaultDonationType = donationTypes.length > 0 ? donationTypes[0].id.toString() : "";
    const defaultYear = new Date().getFullYear();

    const [form, setForm] = useState({
        donation_type: donation?.donation_type?.toString() ?? defaultDonationType,
        amount: donation?.amount?.toString() ?? "",
        slip_no: donation?.slip_no ?? "",
        paid_for: donation?.paid_for ?? "",
        note: donation?.note ?? "",
        donated_at: donation?.donated_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    });

    const [monthlyForm, setMonthlyForm] = useState({
        selectedMonths: new Set<number>(),
        year: defaultYear.toString(),
        showAllMonths: false,
    });

    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const { tr } = useLang();

    useEffect(() => {
        if (memberSearch.length < 2 || selectedMember) return;
        const t = setTimeout(async () => {
            try {
                const res = await invoke<PagedResult<Member>>("list_members", {
                    search: memberSearch,
                    status: null,
                    page: 1,
                    page_size: 6
                });
                setMemberResults((res.data || res).slice(0, 6));
            } catch (e) {
                console.error("Member search error:", e);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [memberSearch, selectedMember]);

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const currentDonationType = donationTypes.find(t => t.id.toString() === form.donation_type);
    const isMonthly = isMonthlyType(currentDonationType);
    const isEditing = !!donation;

    const toggleMonth = (monthIndex: number) => {
        setMonthlyForm(prev => {
            const newMonths = new Set(prev.selectedMonths);
            if (newMonths.has(monthIndex)) {
                newMonths.delete(monthIndex);
            } else {
                newMonths.add(monthIndex);
            }
            return { ...prev, selectedMonths: newMonths };
        });
    };

    const generatePaidForList = (): string[] => {
        const year = monthlyForm.year;
        return Array.from(monthlyForm.selectedMonths)
            .sort()
            .map(monthIdx => `${SHORT_MONTHS[monthIdx]} ${year}`);
    };

    const handleSave = async () => {
        if (!selectedMember) { setError("Select a member"); return; }
        if (!form.amount || Number(form.amount) <= 0) { setError("Enter a valid amount"); return; }

        if (isMonthly) {
            if (monthlyForm.selectedMonths.size === 0) {
                setError("Select at least one month");
                return;
            }
        } else {
            if (!form.paid_for && !isEditing) {
                setError("Enter what this donation is for");
                return;
            }
        }

        setSaving(true);
        setError("");

        try {
            if (isEditing) {
                const input = {
                    member_id: selectedMember.id,
                    donation_type: form.donation_type ? Number(form.donation_type) : null,
                    amount: Number(form.amount),
                    paid_for: form.paid_for || null,
                    collected_by: currentUserId,
                    slip_no: form.slip_no || null,
                    note: form.note || null,
                    donated_at: form.donated_at || null,
                };
                await invoke("update_donation", { id: donation.id, input });
                onSave(donation.id);
            } else {
                if (isMonthly) {
                    const paidForList = generatePaidForList();
                    const input = {
                        member_id: selectedMember.id,
                        donation_type: form.donation_type ? Number(form.donation_type) : null,
                        amount: Number(form.amount),
                        paid_for_list: paidForList,
                        collected_by: currentUserId,
                        slip_no: form.slip_no || null,
                        note: form.note || null,
                        donated_at: form.donated_at || null,
                    };
                    const id = await invoke<number>("create_donations_batch", { input });
                    onSave(id);
                } else {
                    const input = {
                        member_id: selectedMember.id,
                        donation_type: form.donation_type ? Number(form.donation_type) : null,
                        amount: Number(form.amount),
                        paid_for: form.paid_for || null,
                        collected_by: currentUserId,
                        slip_no: form.slip_no || null,
                        note: form.note || null,
                        donated_at: form.donated_at || null,
                    };
                    const id = await invoke<number>("create_donation", { input });
                    onSave(id);
                }
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: isMonthly && !isEditing ? 600 : 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{donation ? tr("edit_donation") : tr("new_donation")}</div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M18.364 5.636a1 1 0 0 0-1.414-1.414L12 9.172 7.05 4.222A1 1 0 1 0 5.636 5.636L10.586 12l-4.95 4.95a1 1 0 1 0 1.414 1.414L12 14.828l4.95 4.95a1 1 0 0 0 1.414-1.414L13.414 12l4.95-4.95z" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body flex flex-col gap-3.5">
                    {/* Member picker */}
                    <div className="form-group relative">
                        <label className="label">{tr("member")} <span className="text-danger">*</span></label>
                        {selectedMember ? (
                            <div className="flex items-center justify-between bg-surface-3 rounded-md border-border px-2.5 py-1.5">
                                <div>
                                    <span className="font-medium">{selectedMember.name}</span>
                                    {selectedMember.mobile && <span className="text-muted text-xs ml-2">{selectedMember.mobile}</span>}
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedMember(null); setMemberSearch(""); }}>{tr("change")}</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    className="input" placeholder="Search member name or mobile…"
                                    value={memberSearch} onChange={e => setMemberSearch(e.target.value)} autoFocus
                                />
                                {memberResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-10 bg-surface-2 rounded-md border-border mt-0.5"
                                        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                        {memberResults.map(m => (
                                            <div key={m.id}
                                                onClick={() => { setSelectedMember(m); setMemberResults([]); setMemberSearch(m.name); }}
                                                className="py-2 px-3 cursor-pointer border-b-border-soft"
                                                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-3)")}
                                                onMouseLeave={e => (e.currentTarget.style.background = "")}
                                            >
                                                <div className="font-medium">{m.name}</div>
                                                {m.mobile && <div className="text-muted text-xs">{m.mobile}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="grid-cols-2">
                        <div className="form-group">
                            <label className="label">{tr("donation_type")}</label>
                            <select className="input" value={form.donation_type} onChange={e => set("donation_type", e.target.value)} disabled={isEditing}>
                                <option value="">— Select —</option>
                                {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">{tr("amount")} (BDT) <span className="text-danger">*</span></label>
                            <input className="input" type="number" min="1" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
                        </div>
                    </div>

                    {isMonthly && !isEditing ? (
                        <>
                            <div className="form-group">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label mb-0">Select Months <span className="text-danger">*</span></label>
                                    {monthlyForm.selectedMonths.size > 1 && !monthlyForm.showAllMonths && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm text-xs"
                                            onClick={() => setMonthlyForm(prev => ({ ...prev, showAllMonths: true }))}
                                        >
                                            Show all {monthlyForm.selectedMonths.size} selected
                                        </button>
                                    )}
                                </div>
                                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                                    {SHORT_MONTHS.map((month, idx) => {
                                        const isSelected = monthlyForm.selectedMonths.has(idx);
                                        const shouldShow = monthlyForm.showAllMonths || isSelected || monthlyForm.selectedMonths.size === 0;
                                        return shouldShow ? (
                                            <label key={idx} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleMonth(idx)}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm">{month}</span>
                                            </label>
                                        ) : null;
                                    })}
                                </div>
                                {!monthlyForm.showAllMonths && monthlyForm.selectedMonths.size > 1 && (
                                    <div className="text-xs text-muted mt-2">
                                        {monthlyForm.selectedMonths.size} months selected
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="label">Year <span className="text-danger">*</span></label>
                                <input
                                    className="input"
                                    type="number"
                                    min={defaultYear}
                                    value={monthlyForm.year}
                                    onChange={e => setMonthlyForm(prev => ({ ...prev, year: e.target.value }))}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label className="label">{tr("paid_for")}</label>
                            <input
                                className="input"
                                value={form.paid_for}
                                onChange={e => set("paid_for", e.target.value)}
                                placeholder={isMonthly ? "" : `e.g. ${new Date().toLocaleDateString('en-BD', { month: 'long', year: 'numeric' })}`}
                                disabled={isMonthly && !isEditing}
                            />
                        </div>
                    )}

                    <div className="grid-cols-2">
                        <div className="form-group">
                            <label className="label">{tr("slip_no")}</label>
                            <input className="input" value={form.slip_no} onChange={e => set("slip_no", e.target.value)} placeholder="e.g. SLIP-001" />
                        </div>
                        <div className="form-group">
                            <label className="label">{tr("date")}</label>
                            <input className="input" type="date" value={form.donated_at} onChange={e => set("donated_at", e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">{tr("note")}</label>
                        <input className="input" value={form.note} onChange={e => set("note", e.target.value)} placeholder="Optional note" />
                    </div>

                    {error && <p className="text-danger text-xs">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{tr("cancel")}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? tr("saving") : donation ? tr("save_changes") : tr("record_donation")}
                    </button>
                </div>
            </div>
        </div>
    );
}