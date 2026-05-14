import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MonthlySummary, monthName, printReport, fmt } from "./utils";

export default function MonthlySummaryReport({ orgName }: { orgName: string }) {
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
        <div className="form-group flex-row items-center gap-2">
          <label className="label">Year</label>
          <select className="input w-[100px]" value={year} onChange={e => setYear(Number(e.target.value))}>
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
            <tr><th>Month</th><th>Donations</th><th className="text-right">Total Amount</th><th>Bar</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center p-6 text-text-muted">Loading…</td></tr>}
            {!loading && allMonths.map(r => {
              const pct = grandTotal ? (r.total / grandTotal) * 100 : 0;
              return (
                <tr key={r.month}>
                  <td className="font-medium">{monthName(r.month)} {year}</td>
                  <td className="text-muted">{r.count}</td>
                  <td className={`text-right ${r.total ? 'font-semibold text-saffron-700' : 'text-text-muted'}`}>
                    {r.total ? fmt(r.total) : "—"}
                  </td>
                  <td className="w-[160px]">
                    <div className="h-2 bg-surface-4 rounded-full overflow-hidden">
                      <div className="h-full bg-saffron-500 rounded-full transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && (
              <tr className="bg-saffron-50 font-bold">
                <td className="p-3">Total {year}</td>
                <td className="p-3">{grandCount}</td>
                <td className="text-right text-saffron-700 p-3">{fmt(grandTotal)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
