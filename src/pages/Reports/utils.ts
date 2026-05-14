import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import { fmt as fmtNumber, MONTHS } from '../../utils/helper';

export const fmt = fmtNumber;

export interface CollectionRow {
  id: number; slip_no: string | null; member_name: string; mobile: string | null;
  address: string | null; donation_type: string | null; amount: number;
  paid_for: string | null; donated_at: string; collected_by: string | null;
}

export interface DonorRow {
  member_id: number; name: string; mobile: string | null;
  donation_count: number; total_amount: number; last_donation: string;
}

export interface MonthlySummary { month: string; count: number; total: number; }

export const fmtDate = (s: string) => s ? s.slice(0, 10) : "—";

export function monthName(mm: string) { return MONTHS[parseInt(mm, 10) - 1] ?? mm; }

export function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function printReport(title: string, subtitle: string, tableHTML: string, orgName: string) {
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
    await writeTextFile(tempFileName, html, { baseDir: BaseDirectory.AppData });
    const appDataPath = await appDataDir();
    const fullPath = await join(appDataPath, tempFileName);
    await openPath(fullPath);
  } catch (e) {
    alert(`Print failed: ${e}`);
  }
}
