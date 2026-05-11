import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LangContext";
import { fmt, fmtDate } from "../utils/helper";
import type { Donation, DonationType, OrgSettings } from "../types/donations";
import DonationModal from "../components/DonationModal";
import BuildReceipt from "../components/BuildReceipt";
import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';

async function printReceipt(d: Donation, org: OrgSettings) {
  try {
    const html = BuildReceipt(d, org);
    const finalHtml = `
            ${html}
            <script>window.onload = () => { window.print(); }</script>
        `;
    const tempFileName = 'receipt.html';
    await writeTextFile(tempFileName, finalHtml, {
      baseDir: BaseDirectory.AppData
    });
    const appDataPath = await appDataDir();
    const fullPath = await join(appDataPath, tempFileName);
    await openPath(fullPath);
  } catch (e) {
    // console.error("Print failed:", e);
    alert(`Print failed: ${e}`);
  }
}

// ── Donations Page
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
  const [prefillMember, setPrefillMember] = useState<{ id: number; name: string; mobile: string | null } | null>(null);
  const { tr } = useLang();

  useEffect(() => {
    const handler = (e: Event) => {
      const member = (e as CustomEvent).detail;
      setPrefillMember(member);
      setEditing(null);
      setModalOpen(true);
    };
    window.addEventListener("open-donation-modal", handler);
    return () => window.removeEventListener("open-donation-modal", handler);
  }, []);

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
          <div className="page-title">{tr("donations")}</div>
          <div className="page-subtitle">
            {donations.length} record{donations.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
            {tr("total")}: <strong>৳ {totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          + {tr("new_donation")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input className="input search-input" placeholder={tr("search_member")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{tr("all_types")}</option>
          {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 140 }} title="From date" />
        <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 140 }} title="To date" />
        <button className="btn btn-secondary btn-sm" onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setTypeFilter(""); }}>{tr("clear")}</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("slip_no")}</th>
              <th>{tr("member")}</th>
              <th>{tr("type")}</th>
              <th>{tr("paid_for")}</th>
              <th>{tr("amount")}</th>
              <th>{tr("date")}</th>
              <th>{tr("collected_by")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center text-text-muted p-6">{tr("loading")}</td></tr>
            )}
            {!loading && donations.length === 0 && (
              <tr><td colSpan={8} className="text-center text-text-muted p-6">{tr("no_donations_found")}</td></tr>
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
                      title={tr("print_receipt")}
                      onClick={() => printReceipt(d, orgSettings)}
                    >🖨</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(d); setModalOpen(true); }}>{tr("edit")}</button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleting(d)}>{tr("delete")}</button>
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
          prefillMember={prefillMember}
        />
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="modal" style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body text-center px-5 py-6">
              <p className="text-sm">Delete donation of <strong>{fmt(deleting.amount)}</strong> from <strong>{deleting.member_name}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>{tr("cancel")}</button>
              <button className="btn btn-danger" onClick={handleDelete}>{tr("delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}