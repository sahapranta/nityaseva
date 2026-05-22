import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../../contexts/LangContext";
import { CollectionRow, fmtDate, downloadCSV, printReport, fmt } from "./utils";
import MonthYearPicker from "../../components/MonthYearPicker";

const today = new Date();

export default function CollectionByMonth({ orgName }: { orgName: string }) {
  const [month, setMonth] = useState<string>((`{today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`));
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { tr } = useLang();

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const data = await invoke<CollectionRow[]>("report_collection_by_month", { month });
      setRows(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

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
    printReport("Collection Report (by Collection Month)", `${month}`, tableHTML, orgName);
  };

  const handleCSV = () => {
    downloadCSV(
      `collection-by-date-${month}.csv`,
      rows.map(r => [fmtDate(r.donated_at), r.slip_no ?? "", r.member_name, r.mobile ?? "", r.donation_type ?? "", r.paid_for ?? "", r.amount.toString(), r.collected_by ?? ""]),
      ["Collection Date", "Slip No", "Member", "Mobile", "Type", "Paid For", "Amount", "Collected By"]
    );
  };

  const changeMonth = (m: number) => {
    const d = new Date(); 
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + m).padStart(2, "0")}`);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex flex-row items-center gap-2">
          <MonthYearPicker value={month} onChange={setMonth} />
        </div>
        {[
          { label: tr("last_month"), fn: () => changeMonth(-1) },          
          { label: tr("this_month"), fn: () => changeMonth(0) },
          { label: tr("next_month"), fn: () => changeMonth(1) },          
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
          <div className="stat-label">{tr("total_collected")}</div>
          <div className="stat-value">{fmt(total, "en-BD", 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr("donations")}</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr("avg_per_donation")}</div>
          <div className="stat-value">{rows.length ? fmt(Math.ceil(total / rows.length), "en-BD", 0) : "৳ 0"}</div>
        </div>
      </div>

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
