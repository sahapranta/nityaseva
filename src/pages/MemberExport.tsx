import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  { key: "address",         label: "Address" },
  { key: "district",        label: "District" },
  { key: "pin_code",        label: "PIN Code" },
  { key: "membership_type", label: "Membership Type" },
  { key: "status",          label: "Status" },
  { key: "last_donation",   label: "Last Donation" },
  { key: "joined_at",       label: "Joined At" },
  { key: "notes",           label: "Notes" },
];

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map(r =>
    r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob(["\uFEFF" + lines.join("\r\n"), ], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Excel XML format — opens natively in Excel with proper columns
function downloadExcel(filename: string, headers: string[], rows: string[][]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(r =>
    `<Row>${r.map(c => `<Cell><Data ss:Type="String">${esc(c ?? "")}</Data></Cell>`).join("")}</Row>`
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
  <Table>
   <Row>${headerRow.replace(/<Cell>/g, '<Cell ss:StyleID="header">')}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function MemberExportPage() {
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedCols, setSelectedCols] = useState<Set<keyof MemberRow>>(
    new Set(["id", "name", "mobile", "address", "district", "membership_type", "status"])
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

  const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
  const headers = activeCols.map(c => c.label);
  const tableRows = rows.map(r =>
    activeCols.map(c => {
      const v = r[c.key];
      if (v === null || v === undefined) return "";
      if (c.key === "joined_at" || c.key === "last_donation") return String(v).slice(0, 10);
      return String(v);
    })
  );

  const handleCSV = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`members-${statusFilter || "all"}-${date}.csv`, headers, tableRows);
  };

  const handleExcel = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadExcel(`members-${statusFilter || "all"}-${date}.xls`, headers, tableRows);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Member Export</div>
          <div className="page-subtitle">Export member list as CSV or Excel</div>
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

      <div className="grid-cols-2" style={{ alignItems: "start" }}>
        {/* Options */}
        <div className="card">
          <div className="card-header"><div className="card-title">Export Options</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
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
          <div className="card-header">
            <div className="card-title">Preview</div>
            {loaded && (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: "auto" }}>
                {rows.length} member{rows.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ overflow: "auto", maxHeight: 480 }}>
            {!loaded && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>
                Click "Load Preview" to see data
              </div>
            )}
            {loaded && rows.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>
                No members found
              </div>
            )}
            {loaded && rows.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--color-surface-3)", position: "sticky", top: 0 }}>
                    {activeCols.map(c => (
                      <th key={c.key} style={{
                        padding: "6px 10px", textAlign: "left", fontSize: 10,
                        fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4,
                        color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                      }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                      {activeCols.map(c => {
                        const v = r[c.key];
                        const display = v !== null && v !== undefined
                          ? (c.key === "joined_at" || c.key === "last_donation" ? String(v).slice(0, 10) : String(v))
                          : "—";
                        return (
                          <td key={c.key} style={{
                            padding: "6px 10px",
                            color: v ? "var(--color-text-primary)" : "var(--color-text-muted)",
                            whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis",
                          }}>{display}</td>
                        );
                      })}
                    </tr>
                  ))}
                  {rows.length > 20 && (
                    <tr>
                      <td colSpan={activeCols.length} style={{ padding: "8px 10px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 11 }}>
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