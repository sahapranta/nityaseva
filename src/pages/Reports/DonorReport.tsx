import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DonorRow, fmtDate, downloadCSV, printReport, fmt } from "./utils";
import { useLang } from "../../contexts/LangContext";

interface DonorReportProps {
  mode: "top" | "frequent";
  orgName: string;
}

export default function DonorReport({ mode, orgName }: DonorReportProps) {
  const { tr } = useLang();
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
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex flex-row items-center gap-2">
          <label className="label whitespace-nowrap">{tr("from")}</label>
          <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-row items-center gap-2">
          <label className="label whitespace-nowrap">{tr("to")}</label>
          <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex flex-row items-center gap-2">
          <label className="label">{tr("show_top")}</label>
          <select className="input w-[80px]" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-secondary" onClick={handleCSV} disabled={rows.length === 0}>⬇ {tr("download")} CSV</button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={rows.length === 0}>🖨 {tr("print")} PDF</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>{tr("member")}</th><th>{tr("mobile")}</th><th>{tr("donations")}</th><th className="text-right">{sortLabel}</th><th>{tr("last_donation")}</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center p-6 text-text-muted">{tr("loading")}…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-text-muted">{tr("noData")}</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.member_id}>
                <td>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i < 3 ? "bg-saffron-100 text-saffron-700" : "bg-surface-4 text-text-muted"
                    }`}>{i + 1}</span>
                </td>
                <td className="font-medium">{r.name}</td>
                <td className="text-muted">{r.mobile ?? "—"}</td>
                <td>{r.donation_count}</td>
                <td className="text-right font-semibold text-saffron-700">{fmt(r.total_amount)}</td>
                <td className="text-muted">{fmtDate(r.last_donation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
