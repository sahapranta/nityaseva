import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../Auth";

// ── Types 
interface Donation {
  id: number;
  member_id: number;
  member_name: string;
  member_mobile: string | null;
  member_address: string | null;
  donation_type: number | null;
  donation_type_name: string | null;
  amount: number;
  paid_for: string | null;
  collected_by: number | null;
  collected_by_name: string | null;
  slip_no: string | null;
  note: string | null;
  donated_at: string;
}

interface DonationType { id: number; name: string; }
interface Member { id: number; name: string; mobile: string | null; }
interface OrgSettings { [key: string]: string; }

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳ " + n.toLocaleString("en-BD", { minimumFractionDigits: 2 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// ── Receipt HTML ──────────────────────────────────────────────────────
function buildReceiptHTML(d: Donation, org: OrgSettings): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt ${d.slip_no}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 13px; color: #1c1a17; }
  .header { text-align: center; border-bottom: 2px solid #de5d04; padding-bottom: 16px; margin-bottom: 24px; }
  .org-name { font-size: 22px; font-weight: 700; color: #de5d04; }
  .org-sub { font-size: 12px; color: #5a564e; margin-top: 4px; }
  .receipt-title { font-size: 16px; font-weight: 600; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .slip-no { font-size: 12px; color: #9b9589; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9b9589; margin-bottom: 8px; border-bottom: 1px solid #e8e5df; padding-bottom: 4px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e8e5df; }
  .row:last-child { border-bottom: none; }
  .label { color: #5a564e; }
  .value { font-weight: 500; text-align: right; }
  .amount-box { background: #fff8ed; border: 2px solid #de5d04; border-radius: 8px; padding: 16px 20px; margin: 24px 0; display: flex; justify-content: space-between; align-items: center; }
  .amount-label { font-size: 13px; color: #5a564e; }
  .amount-value { font-size: 26px; font-weight: 700; color: #de5d04; }
  .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-line { border-top: 1px solid #1c1a17; width: 160px; text-align: center; padding-top: 6px; font-size: 11px; color: #9b9589; }
  .thank-you { text-align: center; margin-top: 32px; font-size: 12px; color: #9b9589; font-style: italic; }
  .watermark { text-align: center; margin-top: 8px; font-size: 10px; color: #d6d2c9; }
</style>
</head>
<body>
  <div class="header">
    <div class="org-name">${org.name ?? "Nityaseva"}</div>
    <div class="org-sub">${org.address ?? ""}</div>
    ${org.mobile ? `<div class="org-sub">Mobile: ${org.mobile}</div>` : ""}
    <div class="receipt-title">Donation Receipt</div>
    <div class="slip-no">Slip No: ${d.slip_no ?? "—"} &nbsp;|&nbsp; Date: ${fmtDate(d.donated_at)}</div>
  </div>

  <div class="section">
    <div class="section-title">Member Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${d.member_name}</span></div>
    ${d.member_mobile ? `<div class="row"><span class="label">Mobile</span><span class="value">${d.member_mobile}</span></div>` : ""}
    ${d.member_address ? `<div class="row"><span class="label">Address</span><span class="value">${d.member_address}</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Donation Details</div>
    <div class="row"><span class="label">Donation Type</span><span class="value">${d.donation_type_name ?? "General"}</span></div>
    ${d.paid_for ? `<div class="row"><span class="label">Paid For</span><span class="value">${d.paid_for}</span></div>` : ""}
    ${d.collected_by_name ? `<div class="row"><span class="label">Collected By</span><span class="value">${d.collected_by_name}</span></div>` : ""}
    ${d.note ? `<div class="row"><span class="label">Note</span><span class="value">${d.note}</span></div>` : ""}
  </div>

  <div class="amount-box">
    <span class="amount-label">Total Amount Received</span>
    <span class="amount-value">${fmt(d.amount)}</span>
  </div>

  <div class="footer">
    <div class="sig-line">Member Signature</div>
    <div class="sig-line">Authorised Signatory</div>
  </div>

  <div class="thank-you">Thank you for your generous donation. May you be blessed.</div>
  <div class="watermark">Powered by Nityaseva</div>
</body>
</html>`;
}

function printReceipt(d: Donation, org: OrgSettings) {
  const html = buildReceiptHTML(d, org);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── Donation Modal ────────────────────────────────────────────────────
function DonationModal({
  donation, donationTypes, onSave, onClose, currentUserId,
}: {
  donation: Donation | null;
  donationTypes: DonationType[];
  onSave: (id: number) => void;
  onClose: () => void;
  currentUserId: number;
}) {
  const [memberSearch, setMemberSearch] = useState(donation?.member_name ?? "");
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(
    donation ? { id: donation.member_id, name: donation.member_name, mobile: donation.member_mobile } : null
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

  useEffect(() => {
    if (memberSearch.length < 2 || selectedMember) return;
    const t = setTimeout(async () => {
      try {
        const res = await invoke<Member[]>("list_members", { search: memberSearch, status: null });
        setMemberResults(res.slice(0, 6));
      } catch {}
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

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Member picker */}
          <div className="form-group" style={{ position: "relative" }}>
            <label className="label">Member *</label>
            {selectedMember ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 10px", background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
              }}>
                <div>
                  <span className="font-medium">{selectedMember.name}</span>
                  {selectedMember.mobile && <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{selectedMember.mobile}</span>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedMember(null); setMemberSearch(""); }}>Change</button>
              </div>
            ) : (
              <>
                <input
                  className="input" placeholder="Search member name or mobile…"
                  value={memberSearch} onChange={e => setMemberSearch(e.target.value)} autoFocus
                />
                {memberResults.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    marginTop: 2,
                  }}>
                    {memberResults.map(m => (
                      <div key={m.id}
                        onClick={() => { setSelectedMember(m); setMemberResults([]); setMemberSearch(m.name); }}
                        style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--color-border-soft)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-3)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <div className="font-medium">{m.name}</div>
                        {m.mobile && <div className="text-muted" style={{ fontSize: 11 }}>{m.mobile}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">Donation Type</label>
              <select className="input" value={form.donation_type} onChange={e => set("donation_type", e.target.value)}>
                <option value="">— Select —</option>
                {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Amount (BDT) *</label>
              <input className="input" type="number" min="1" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="label">Paid For</label>
              <input className="input" value={form.paid_for} onChange={e => set("paid_for", e.target.value)} placeholder="e.g. May 2026" />
            </div>
            <div className="form-group">
              <label className="label">Date</label>
              <input className="input" type="date" value={form.donated_at} onChange={e => set("donated_at", e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Note</label>
            <input className="input" value={form.note} onChange={e => set("note", e.target.value)} placeholder="Optional note" />
          </div>

          {error && <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : donation ? "Save Changes" : "Record Donation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Donations Page ────────────────────────────────────────────────────
export default function DonationsPage() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationTypes, setDonationTypes] = useState<DonationType[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [deleting, setDeleting] = useState<Donation | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, org] = await Promise.all([
        invoke<Donation[]>("list_donations", {
          search: search || null,
          donationType: typeFilter ? Number(typeFilter) : null,
          fromDate: fromDate || null,
          toDate: toDate || null,
          memberId: null,
        }),
        invoke<DonationType[]>("list_donation_types"),
        invoke<OrgSettings>("get_org_settings"),
      ]);
      setDonations(d);
      setDonationTypes(t);
      setOrgSettings(org);
      setTotalAmount(d.reduce((sum, x) => sum + x.amount, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async () => {
    if (!deleting) return;
    await invoke("delete_donation", { id: deleting.id });
    setDeleting(null);
    load();
  };

  const handleSaved = async (id: number) => {
    setModalOpen(false);
    await load();
    // Auto print receipt for new donations
    if (!editing) {
      const d = await invoke<Donation>("get_donation", { id });
      printReceipt(d, orgSettings);
    }
    setEditing(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Donations</div>
          <div className="page-subtitle">
            {donations.length} record{donations.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            Total: <strong>৳ {totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          + New Donation
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input className="input search-input" placeholder="Search member…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 140 }} title="From date" />
        <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 140 }} title="To date" />
        <button className="btn btn-secondary btn-sm" onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setTypeFilter(""); }}>Clear</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Slip No</th>
              <th>Member</th>
              <th>Type</th>
              <th>Paid For</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Collected By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 24 }}>Loading…</td></tr>
            )}
            {!loading && donations.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 24 }}>No donations found</td></tr>
            )}
            {donations.map(d => (
              <tr key={d.id}>
                <td className="text-muted" style={{ fontSize: 11 }}>{d.slip_no}</td>
                <td>
                  <div className="font-medium">{d.member_name}</div>
                  {d.member_mobile && <div className="text-muted" style={{ fontSize: 11 }}>{d.member_mobile}</div>}
                </td>
                <td>
                  {d.donation_type_name
                    ? <span className="badge badge-info">{d.donation_type_name}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="text-muted">{d.paid_for ?? "—"}</td>
                <td className="font-semibold" style={{ color: "var(--color-saffron-700)" }}>
                  {fmt(d.amount)}
                </td>
                <td className="text-muted">{fmtDate(d.donated_at)}</td>
                <td className="text-muted">{d.collected_by_name ?? "—"}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Print Receipt"
                      onClick={() => printReceipt(d, orgSettings)}
                    >🖨</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(d); setModalOpen(true); }}>Edit</button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleting(d)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <DonationModal
          donation={editing}
          donationTypes={donationTypes}
          onSave={handleSaved}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          currentUserId={user?.id ?? 0}
        />
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="modal" style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: "24px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 14 }}>Delete donation of <strong>{fmt(deleting.amount)}</strong> from <strong>{deleting.member_name}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}