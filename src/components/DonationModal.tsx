import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Donation, DonationType, Member } from "../types/donations";
import { useLang } from "../contexts/LangContext";

export default function DonationModal({
    donation, donationTypes, onSave, onClose, currentUserId, prefillMember
}: {
    donation: Donation | null;
    donationTypes: DonationType[];
    onSave: (id: number) => void;
    onClose: () => void;
    currentUserId: number;
    prefillMember?: { id: number; name: string; mobile: string | null } | null;
}) {
    const [memberResults, setMemberResults] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(
        donation
            ? { id: donation.member_id, name: donation.member_name, mobile: donation.member_mobile }
            : prefillMember ?? null
    );

    const [memberSearch, setMemberSearch] = useState(
        donation?.member_name ?? prefillMember?.name ?? ""
    );
    const [form, setForm] = useState({
        donation_type: donation?.donation_type?.toString() ?? "",
        amount: donation?.amount?.toString() ?? "",
        paid_for: donation?.paid_for ?? "",
        note: donation?.note ?? "",
        donated_at: donation?.donated_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const { tr } = useLang();

    useEffect(() => {
        if (memberSearch.length < 2 || selectedMember) return;
        const t = setTimeout(async () => {
            try {
                const res = await invoke<Member[]>("list_members", { search: memberSearch, status: null });
                setMemberResults(res.slice(0, 6));
            } catch { }
        }, 250);
        return () => clearTimeout(t);
    }, [memberSearch, selectedMember]);

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!selectedMember) { setError("Select a member"); return; }
        if (!form.amount || Number(form.amount) <= 0) { setError("Enter a valid amount"); return; }
        setSaving(true); setError("");
        try {
            const input = {
                member_id: selectedMember.id,
                donation_type: form.donation_type ? Number(form.donation_type) : null,
                amount: Number(form.amount),
                paid_for: form.paid_for || null,
                collected_by: currentUserId,
                slip_no: null,
                note: form.note || null,
                donated_at: form.donated_at || null,
            };
            let id: number;
            if (donation) {
                await invoke("update_donation", { id: donation.id, input });
                id = donation.id;
            } else {
                id = await invoke<number>("create_donation", { input });
            }
            onSave(id);
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">{donation ? "Edit Donation" : "New Donation"}</div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body flex flex-col gap-3">
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
                                                {m.mobile && <div className="text-muted text-[11px]">{m.mobile}</div>}
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
                            <select className="input" value={form.donation_type} onChange={e => set("donation_type", e.target.value)}>
                                <option value="">— Select —</option>
                                {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">{tr("amount")} (BDT) *</label>
                            <input className="input" type="number" min="1" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="grid-cols-2">
                        <div className="form-group">
                            <label className="label">{tr("paid_for")}</label>
                            <input className="input" value={form.paid_for} onChange={e => set("paid_for", e.target.value)} placeholder="e.g. May 2026" />
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