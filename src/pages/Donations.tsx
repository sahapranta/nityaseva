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
import { useLocation, useNavigate } from 'react-router-dom';
import { PagedResult, usePagination } from "../hooks/usePagination";
import Pagination from "../components/Pagination";

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
    console.error("Print failed:", e);
  }
}

const PAGE_SIZE = 25;

// ── Donations Page
export default function DonationsPage() {
  const { user } = useAuth();
  const { tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const [donationTypes, setDonationTypes] = useState<DonationType[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [deleting, setDeleting] = useState<Donation | null>(null);
  const [prefillMember, setPrefillMember] = useState<{ id: number; name: string; mobile: string | null } | null>(null);

  // Load static data once
  useEffect(() => {
    Promise.all([
      invoke<DonationType[]>("list_donation_types"),
      invoke<OrgSettings>("get_org_settings"),
    ]).then(([t, org]) => {
      setDonationTypes(t);
      setOrgSettings(org);
    });
  }, []);

  // Handle navigate-with-state for donate button
  useEffect(() => {
    if (location.state?.openDonation) {
      setPrefillMember(location.state.member);
      setEditing(null);
      setModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Pagination
  const fetcher = useCallback(
    (pg: number, size: number) =>
      invoke<PagedResult<Donation>>("list_donations", {
        search: search || null,
        donationType: typeFilter ? Number(typeFilter) : null,
        fromDate: appliedFrom || null,
        toDate: appliedTo || null,
        memberId: null,
        page: pg,
        pageSize: size,
      }),
    [search, typeFilter, appliedFrom, appliedTo]
  );

  const { data: donations, total, total_pages, page, loading, goTo, refresh } =
    usePagination(fetcher, { pageSize: PAGE_SIZE });

  // Reset to page 1 when search changes
  useEffect(() => { goTo(1); }, [search, typeFilter]);

  const applyDateFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    goTo(1);
  };

  const clearFilters = () => {
    setSearch(""); setTypeFilter("");
    setFromDate(""); setToDate("");
    setAppliedFrom(""); setAppliedTo("");
    goTo(1);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await invoke("delete_donation", { id: deleting.id });
    setDeleting(null);
    refresh();
  };

  const handleSaved = async (id: number) => {
    setModalOpen(false);
    refresh();
    if (!editing) {
      const d = await invoke<Donation>("get_donation", { id });
      printReceipt(d, orgSettings);
    }
    setEditing(null);
    setPrefillMember(null);
  };

  // Page-level total (current page only)
  const pageTotal = donations.reduce((s, d) => s + d.amount, 0);

  const openNewModal = () => {
    setEditing(null);
    setPrefillMember(null);
    setModalOpen(true);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{tr("donations")}</div>
          <div className="page-subtitle">
            {total} record{total !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          + {tr("new_donation")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input className="input search-input" placeholder={tr("search_member")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 140 }} value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{tr("all_types")}</option>
          {donationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="input" type="date" value={fromDate}
          onChange={e => setFromDate(e.target.value)} style={{ width: 140 }} />
        <input className="input" type="date" value={toDate}
          onChange={e => setToDate(e.target.value)} style={{ width: 140 }} />
        <button className="btn btn-secondary btn-sm" onClick={applyDateFilter}>
          {(appliedFrom || appliedTo) ? tr("update") : tr("apply")}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
          {tr("clear")}
        </button>
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
                <td className="font-semibold">
                  {fmt(d.amount)}
                </td>
                <td className="text-muted">{fmtDate(d.donated_at)}</td>
                <td className="text-muted">{d.collected_by_name ?? "—"}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-secondary btn-sm"
                      title={tr("print_receipt")}
                      onClick={() => printReceipt(d, orgSettings)}
                    >{tr('print')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(d); setModalOpen(true); }}>{tr("edit")}</button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleting(d)}>{tr("delete")}</button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && donations.length > 0 && (
              <tr className="bg-saffron-50 font-bold">
                <td colSpan={4} className="px-3.5 py-2.5 text-sm">
                  Page total ({donations.length})
                </td>
                <td className="px-3.5 py-2.5 font-bold whitespace-nowrap text-saffron-700">
                  {fmt(pageTotal)}
                </td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={total_pages}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={goTo}
        loading={loading}
      />

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
          <div className="modal min-w-80 max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-body text-center px-5 py-6">
              <p className="text-base">Delete donation of <strong>{fmt(deleting.amount)}</strong> from <strong>{deleting.member_name}</strong>?</p>
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