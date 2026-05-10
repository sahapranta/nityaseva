import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useLang } from "../contexts/LangContext";

interface MemberRow {
  id: number;
  name: string;
  mobile: string | null;
  address: string | null;
  district: string | null;
  pin_code: string | null;
  membership_type: string | null;
  status: string;
  last_donation: string | null;
  joined_at: string;
  notes: string | null;
}

const ALL_COLUMNS: { key: keyof MemberRow; label: string }[] = [
  { key: "id",              label: "Member ID" },
  { key: "name",            label: "Name" },
  { key: "mobile",          label: "Mobile" },
  { key: "address",         label: "Address" }, // acts as Full Address (Address, District, PIN)
  { key: "membership_type", label: "Membership Type" },
  { key: "status",          label: "Status" },
  { key: "last_donation",   label: "Last Donation" },
  { key: "joined_at",       label: "Joined At" },
  { key: "notes",           label: "Notes" },
];

async function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map(r =>
    r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const content = "\uFEFF" + lines.join("\r\n");

  const path = await save({
    defaultPath: filename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return;
  await writeTextFile(path, content);
}

// Excel XML format — opens natively in Excel with proper columns
async function downloadExcel(filename: string, headers: string[], rows: string[][]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headerRow = headers.map(h =>
    `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(h)}</Data></Cell>`
  ).join("");

  const dataRows = rows.map(r =>
    `<Row>${r.map(c =>
      `<Cell><Data ss:Type="String">${esc(c ?? "")}</Data></Cell>`
    ).join("")}</Row>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#FFF8ED" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Members">
  <Table>${headerRow.replace(/^/, "<Row>").replace(/$/, "</Row>")}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const path = await save({
    defaultPath: filename,
    filters: [{ name: "Excel", extensions: ["xls"] }],
  });
  if (!path) return;
  await writeTextFile(path, xml);
}

export default function MemberExportPage() {
  const { tr } = useLang();
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedCols, setSelectedCols] = useState<Set<keyof MemberRow>>(
    new Set(["id", "name", "mobile", "address", "membership_type", "status"])
  );
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleCol = (key: keyof MemberRow) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<MemberRow[]>("export_members_csv", {
        status: statusFilter || null,
      });
      setRows(data);
      setLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Helper to format specific cell values for both export and preview
  const getFormattedValue = (r: MemberRow, key: keyof MemberRow): string => {
    // Merge address fields
    if (key === "address") {
      const fullAddress = [r.address, r.district, r.pin_code]
        .filter(part => part && part.trim() !== "")
        .join(", ");
      return fullAddress || "";
    }

    const v = r[key];
    if (v === null || v === undefined) return "";
    if (key === "joined_at" || key === "last_donation") return String(v).slice(0, 10);
    return String(v);
  };

  const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
  const headers = activeCols.map(c => c.label);
  
  // Use the helper for table rows so exports get the merged address
  const tableRows = rows.map(r => activeCols.map(c => getFormattedValue(r, c.key)));

  const handleCSV = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await downloadCSV(`members-${statusFilter || "all"}-${date}.csv`, headers, tableRows);
  };

  const handleExcel = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await downloadExcel(`members-${statusFilter || "all"}-${date}.xls`, headers, tableRows);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{tr("member_export")}</div>
          <div className="page-subtitle">{tr("export_member_list")}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleCSV} disabled={!loaded || rows.length === 0}>
            ⬇ Export CSV
          </button>
          <button className="btn btn-primary" onClick={handleExcel} disabled={!loaded || rows.length === 0}>
            ⬇ Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        {/* Options */}
        <div className="card">
          <div className="card-header"><div className="card-title">Export Options</div></div>
          <div className="card-body flex flex-col gap-4">
            <div className="form-group">
              <label className="label">Member Status</label>
              <select className="input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setLoaded(false); }}>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="">All members</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">Columns to include</label>
              <div className="flex flex-col gap-1.5 mt-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={loadData} disabled={loading}>
              {loading ? "Loading…" : "Load Preview"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="card-title">Preview</div>
            {loaded && (
              <span className="text-xs text-gray-500 ml-auto">
                {rows.length} member{rows.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="overflow-auto max-h-[480px]">
            {!loaded && (
              <div className="p-8 text-center text-gray-500">
                Click "Load Preview" to see data
              </div>
            )}
            {loaded && rows.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No members found
              </div>
            )}
            {loaded && rows.length > 0 && (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 sticky top-0">
                    {activeCols.map(c => (
                      <th key={c.key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      {activeCols.map(c => {
                        const display = getFormattedValue(r, c.key) || "—";
                        const hasValue = display !== "—";
                        
                        return (
                          <td key={c.key} className={`px-3 py-1.5 max-w-[160px] truncate ${hasValue ? 'text-gray-900' : 'text-gray-400'}`}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {rows.length > 20 && (
                    <tr>
                      <td colSpan={activeCols.length} className="px-3 py-2 text-center text-gray-500 text-[11px]">
                        … and {rows.length - 20} more rows (shown in export)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}