import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";
import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import { fmt, MONTHS } from '../utils/helper';

// ── Types ─────────────────────────────────────────────────────────────
interface CollectionRow {
  id: number; slip_no: string | null; member_name: string; mobile: string | null;
  address: string | null; donation_type: string | null; amount: number;
  paid_for: string | null; donated_at: string; collected_by: string | null;
}

interface DonorRow {
  member_id: number; name: string; mobile: string | null;
  donation_count: number; total_amount: number; last_donation: string;
}

interface MonthlySummary { month: string; count: number; total: number; }

// ── Helpers ───────────────────────────────────────────────────────────
const fmtDate = (s: string) => s ? s.slice(0, 10) : "—";

function monthName(mm: string) { return MONTHS[parseInt(mm, 10) - 1] ?? mm; }

// ── CSV export ────────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Print HTML report ─────────────────────────────────────────────────
async function printReport(title: string, subtitle: string, tableHTML: string, orgName: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 12px; color: #1c1a17; }
  .header { border-bottom: 2px solid #de5d04; padding-bottom: 10px; margin-bottom: 16px; }
  .org { font-size: 18px; font-weight: 700; color: #de5d04; }
  .title { font-size: 14px; font-weight: 600; margin-top: 4px; }
  .subtitle { font-size: 11px; color: #9b9589; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f0ede8; padding: 6px 8px; text-align: left; font-size: 10px;
       font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #d6d2c9; }
  td { padding: 6px 8px; border-bottom: 1px solid #e8e5df; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; background: #fff8ed; border-top: 2px solid #de5d04; }
  .footer { margin-top: 24px; font-size: 10px; color: #9b9589; text-align: right; }
</style>
</head>
<body>
<div class="header">
  <div class="org">${orgName}</div>
  <div class="title">${title}</div>
  <div class="subtitle">${subtitle}</div>
</div>
${tableHTML}
<div class="footer">Printed on ${new Date().toLocaleString("en-GB")} · Nityaseva</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;

  try {
    const tempFileName = 'report.html';
    await writeTextFile(tempFileName, html, {
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

// ── Tab bar ───────────────────────────────────────────────────────────
const TABS = ["Collection", "Monthly Summary", "Top Donors", "Frequent Donors"] as const;
type Tab = typeof TABS[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)", marginBottom: 20 }}>
      {TABS.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
          fontSize: 13, fontWeight: active === t ? 600 : 400,
          color: active === t ? "var(--color-saffron-700)" : "var(--color-text-secondary)",
          borderBottom: active === t ? "2px solid var(--color-saffron-600)" : "2px solid transparent",
          marginBottom: -1,
        }}>{t}</button>
      ))}
    </div>
  );
}

// ── Collection Report ─────────────────────────────────────────────────
function CollectionReport({ orgName }: { orgName: string }) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await invoke<CollectionRow[]>("report_donation_collection", { fromDate: from, toDate: to });
      setRows(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const handlePrint = () => {
    const tableHTML = `
      <table>
        <thead><tr><th>#</th><th>Slip</th><th>Member</th><th>Type</th><th>Paid For</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td>${r.slip_no ?? "—"}</td>
            <td>${r.member_name}${r.mobile ? `<br/><small>${r.mobile}</small>` : ""}</td>
            <td>${r.donation_type ?? "—"}</td>
            <td>${r.paid_for ?? "—"}</td>
            <td style="text-align:right;font-weight:600">${fmt(r.amount)}</td>
            <td>${fmtDate(r.donated_at)}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="5">Total (${rows.length} donations)</td>
            <td style="text-align:right">${fmt(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`;
    printReport("Donation Collection Report", `${from} to ${to}`, tableHTML, orgName);
  };

  const handleCSV = () => {
    downloadCSV(
      `collection-${from}-${to}.csv`,
      rows.map(r => [r.slip_no ?? "", r.member_name, r.mobile ?? "", r.donation_type ?? "", r.paid_for ?? "", r.amount.toString(), fmtDate(r.donated_at), r.collected_by ?? ""]),
      ["Slip No", "Member", "Mobile", "Type", "Paid For", "Amount", "Date", "Collected By"]
    );
  };

  const { tr } = useLang();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="form-group items-center gap-2" style={{
          flexDirection: 'row'
        }}>
          <label className="label whitespace-nowrap">{tr("from")}</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 148 }} />
        </div>
        <div className="form-group items-center gap-2" style={{
          flexDirection: 'row'
        }}>
          <label className="label whitespace-nowrap">{tr("to")}</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 148 }} />
        </div>
        {/* Quick filters */}
        {[
          { label: tr("this_month"), fn: () => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(d.toISOString().slice(0, 10)); } },
          { label: tr("last_month"), fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth() - 1, 1); const t2 = new Date(d.getFullYear(), d.getMonth(), 0); setFrom(f.toISOString().slice(0, 10)); setTo(t2.toISOString().slice(0, 10)); } },
          { label: tr("this_year"), fn: () => { const y = new Date().getFullYear(); setFrom(`${y}-01-01`); setTo(`${y}-12-31`); } },
        ].map(q => (
          <button key={q.label} className="btn btn-secondary btn-sm" onClick={q.fn}>{q.label}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="btn btn-secondary" onClick={handleCSV} disabled={rows.length === 0}>⬇ CSV</button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={rows.length === 0}>🖨 Print PDF</button>
        </div>
      </div>

      {/* Summary stat */}
      <div className="grid-cols-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Collected</div>
          <div className="stat-value">{fmt(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Donations</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg per Donation</div>
          <div className="stat-value">{rows.length ? fmt(total / rows.length) : "৳ 0"}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Slip</th><th>Member</th><th>Type</th><th>Paid For</th><th>Amount</th><th>Date</th><th>Collected By</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>No donations in this range</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="text-muted" style={{ fontSize: 11 }}>{i + 1}</td>
                <td className="text-muted" style={{ fontSize: 11 }}>{r.slip_no ?? "—"}</td>
                <td>
                  <div className="font-medium">{r.member_name}</div>
                  {r.mobile && <div className="text-muted" style={{ fontSize: 11 }}>{r.mobile}</div>}
                </td>
                <td>{r.donation_type ? <span className="badge badge-info">{r.donation_type}</span> : "—"}</td>
                <td className="text-muted">{r.paid_for ?? "—"}</td>
                <td className="font-semibold" style={{ color: "var(--color-saffron-700)", textAlign: "right" }}>{fmt(r.amount)}</td>
                <td className="text-muted">{fmtDate(r.donated_at)}</td>
                <td className="text-muted">{r.collected_by ?? "—"}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: "var(--color-saffron-50)", fontWeight: 700 }}>
                <td colSpan={5} style={{ padding: "10px 12px" }}>Total — {rows.length} donation{rows.length !== 1 ? "s" : ""}</td>
                <td style={{ textAlign: "right", color: "var(--color-saffron-700)", padding: "10px 12px" }}>{fmt(total)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Monthly Summary ───────────────────────────────────────────────────
function MonthlySummaryReport({ orgName }: { orgName: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await invoke<MonthlySummary[]>("report_monthly_summary", { year })); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandCount = rows.reduce((s, r) => s + r.count, 0);

  // Fill missing months
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const found = rows.find(r => r.month === mm);
    return found ?? { month: mm, count: 0, total: 0 };
  });

  const handlePrint = () => {
    const tableHTML = `
      <table>
        <thead><tr><th>Month</th><th>Donations</th><th style="text-align:right">Total Amount</th></tr></thead>
        <tbody>
          ${allMonths.map(r => `<tr>
            <td>${monthName(r.month)} ${year}</td>
            <td>${r.count}</td>
            <td style="text-align:right">${fmt(r.total)}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td>Total</td><td>${grandCount}</td><td style="text-align:right">${fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>`;
    printReport("Monthly Donation Summary", `Year ${year}`, tableHTML, orgName);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <label className="label">Year</label>
          <select className="input" style={{ width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <button className="btn btn-primary" onClick={handlePrint} disabled={grandTotal === 0}>🖨 Print PDF</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Month</th><th>Donations</th><th style={{ textAlign: "right" }}>Total Amount</th><th>Bar</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>Loading…</td></tr>}
            {!loading && allMonths.map(r => {
              const pct = grandTotal ? (r.total / grandTotal) * 100 : 0;
              return (
                <tr key={r.month}>
                  <td className="font-medium">{monthName(r.month)} {year}</td>
                  <td className="text-muted">{r.count}</td>
                  <td style={{ textAlign: "right", fontWeight: r.total ? 600 : 400, color: r.total ? "var(--color-saffron-700)" : "var(--color-text-muted)" }}>
                    {r.total ? fmt(r.total) : "—"}
                  </td>
                  <td style={{ width: 160 }}>
                    <div style={{ height: 8, background: "var(--color-surface-4)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-saffron-500)", borderRadius: 99, transition: "width 400ms" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && (
              <tr style={{ background: "var(--color-saffron-50)", fontWeight: 700 }}>
                <td style={{ padding: "10px 12px" }}>Total {year}</td>
                <td style={{ padding: "10px 12px" }}>{grandCount}</td>
                <td style={{ textAlign: "right", color: "var(--color-saffron-700)", padding: "10px 12px" }}>{fmt(grandTotal)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Donor Report (reused for top + frequent) ──────────────────────────
function DonorReport({ mode, orgName }: { mode: "top" | "frequent"; orgName: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<DonorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const cmd = mode === "top" ? "report_top_donors" : "report_frequent_donors";
  const title = mode === "top" ? "Top Donors" : "Frequent Donors";
  const sortLabel = mode === "top" ? "Total Amount" : "Donations";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await invoke<DonorRow[]>(cmd, {
        fromDate: from || null,
        toDate: to || null,
        limit,
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [from, to, limit, cmd]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    const tableHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Member</th><th>Mobile</th><th>Donations</th><th style="text-align:right">Total Amount</th><th>Last Donation</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td>${r.name}</td>
            <td>${r.mobile ?? "—"}</td>
            <td>${r.donation_count}</td>
            <td style="text-align:right">${fmt(r.total_amount)}</td>
            <td>${fmtDate(r.last_donation)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    const sub = from ? `${from} to ${to}` : `All time · Top ${limit}`;
    printReport(title, sub, tableHTML, orgName);
  };

  const handleCSV = () => {
    downloadCSV(
      `${mode}-donors.csv`,
      rows.map((r, i) => [String(i + 1), r.name, r.mobile ?? "", String(r.donation_count), String(r.total_amount), fmtDate(r.last_donation)]),
      ["Rank", "Name", "Mobile", "Donations", "Total Amount", "Last Donation"]
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <label className="label">From</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 148 }} />
        </div>
        <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <label className="label">To</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 148 }} />
        </div>
        <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <label className="label">Show top</label>
          <select className="input" style={{ width: 80 }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-secondary" onClick={handleCSV} disabled={rows.length === 0}>⬇ CSV</button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={rows.length === 0}>🖨 Print PDF</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Member</th><th>Mobile</th><th>Donations</th><th style={{ textAlign: "right" }}>{sortLabel}</th><th>Last Donation</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--color-text-muted)" }}>No data</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.member_id}>
                <td>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                    background: i < 3 ? "var(--color-saffron-100)" : "var(--color-surface-4)",
                    color: i < 3 ? "var(--color-saffron-700)" : "var(--color-text-muted)",
                  }}>{i + 1}</span>
                </td>
                <td className="font-medium">{r.name}</td>
                <td className="text-muted">{r.mobile ?? "—"}</td>
                <td>{r.donation_count}</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--color-saffron-700)" }}>{fmt(r.total_amount)}</td>
                <td className="text-muted">{fmtDate(r.last_donation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reports Page ──────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("Collection");
  const [orgName, setOrgName] = useState("Nityaseva");
  const { tr } = useLang();

  useEffect(() => {
    invoke<{ [k: string]: string }>("get_org_settings")
      .then(s => { if (s.name) setOrgName(s.name); })
      .catch(() => { });
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">{tr("reports")}</div>
      </div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "Collection" && <CollectionReport orgName={orgName} />}
      {tab === "Monthly Summary" && <MonthlySummaryReport orgName={orgName} />}
      {tab === "Top Donors" && <DonorReport mode="top" orgName={orgName} />}
      {tab === "Frequent Donors" && <DonorReport mode="frequent" orgName={orgName} />}
    </div>
  );
}