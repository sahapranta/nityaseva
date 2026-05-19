import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../../contexts/LangContext";
import { CollectionRow, fmtDate, downloadCSV, printReport, fmt } from "./utils";

export default function CollectionByDateReport({ orgName }: { orgName: string }) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { tr } = useLang();

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await invoke<CollectionRow[]>("report_collection_by_donated_at", { fromDate: from, toDate: to });
      setRows(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  // Group by paid_for to show breakdown
  const breakdown = rows.reduce((acc, row) => {
    const key = row.paid_for ?? "Other";
    if (!acc[key]) acc[key] = 0;
    acc[key] += row.amount;
    return acc;
  }, {} as Record<string, number>);

  const handlePrint = () => {
    const tableHTML = `
      <table>
        <thead><tr><th>#</th><th>Collection Date</th><th>Slip</th><th>Member</th><th>Type</th><th>Paid For</th><th>Amount</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `<tr>
            <td>${i + 1}</td>
            <td>${fmtDate(r.donated_at)}</td>
            <td>${r.slip_no ?? "—"}</td>
            <td>${r.member_name}${r.mobile ? `<br/><small>${r.mobile}</small>` : ""}</td>
            <td>${r.donation_type ?? "—"}</td>
            <td>${r.paid_for ?? "—"}</td>
            <td style="text-align:right;font-weight:600">${fmt(r.amount)}</td>
          </tr>`).join("")}
          <tr class="total-row">
            <td colspan="6">Total (${rows.length} donations)</td>
            <td style="text-align:right">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>`;
    printReport("Collection Report (by Collection Date)", `${from} to ${to}`, tableHTML, orgName);
  };

  const handleCSV = () => {
    downloadCSV(
      `collection-by-date-${from}-${to}.csv`,
      rows.map(r => [fmtDate(r.donated_at), r.slip_no ?? "", r.member_name, r.mobile ?? "", r.donation_type ?? "", r.paid_for ?? "", r.amount.toString(), r.collected_by ?? ""]),
      ["Collection Date", "Slip No", "Member", "Mobile", "Type", "Paid For", "Amount", "Collected By"]
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex flex-row items-center gap-2">
          <label className="label whitespace-nowrap">{tr("from")}</label>
          <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-row items-center gap-2">
          <label className="label whitespace-nowrap">{tr("to")}</label>
          <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
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

      {Object.keys(breakdown).length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">Breakdown by Purpose</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {Object.entries(breakdown).map(([purpose, amount]) => (
              <div key={purpose} className="flex items-center justify-between bg-surface-2 border border-border rounded-md px-3 py-2">
                <span className="text-sm text-text-muted">{purpose}</span>
                <span className="font-semibold text-saffron-700">{fmt(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>{tr("date")}</th><th>{tr("slip_no")}</th><th>{tr("member")}</th><th>{tr("type")}</th><th>{tr("paid_for")}</th><th>{tr("amount")}</th><th>{tr("collected_by")}</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center p-6 text-text-muted">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="text-center p-6 text-text-muted">No donations collected in this range</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="text-muted text-xs">{i + 1}</td>
                <td className="text-muted">{fmtDate(r.donated_at)}</td>
                <td className="text-muted text-xs">{r.slip_no ?? "—"}</td>
                <td>
                  <div className="font-medium">{r.member_name}</div>
                  {r.mobile && <div className="text-muted text-xs">{r.mobile}</div>}
                </td>
                <td>{r.donation_type ? <span className="badge badge-info">{r.donation_type}</span> : "—"}</td>
                <td className="text-muted">{r.paid_for ?? "—"}</td>
                <td className="font-semibold text-right text-saffron-700">{fmt(r.amount)}</td>
                <td className="text-muted">{r.collected_by ?? "—"}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-saffron-50 font-bold">
                <td colSpan={6} className="p-3">Total — {rows.length} donation{rows.length !== 1 ? "s" : ""}</td>
                <td className="text-right text-saffron-700 p-3">{fmt(total)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
