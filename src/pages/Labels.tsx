import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import { useLang } from "../contexts/LangContext";
import type { PagedResult } from "../hooks/usePagination";

interface Member {
    id: number;
    name: string;
    address: string | null;
    district: string | null;
    pin_code: string | null;
    mobile: string | null;
    status: string;
}

interface OrgSettings { [key: string]: string; }

// Build printable HTML for all labels
function buildLabelsHTML(members: Member[], org: OrgSettings): string {
    const senderLines = [
        `<strong>${org.name ?? "Nityaseva"}</strong>`,
        org.address ?? "",
        org.mobile ? `Mobile: ${org.mobile}` : "",
    ].filter(Boolean).join("<br/>");

    const pages = members.map((m) => {
        const receiverLines = [
            `<strong>${m.name}</strong>`,
            m.address ?? "",
            m.district ?? "",
            m.pin_code ? `PIN: ${m.pin_code}` : "",
            m.mobile ? `Mobile: ${m.mobile}` : "",
        ].filter(Boolean).join("<br/>");

        return `
    <div class="label-page">
      <div class="label-half sender">
        <div class="label-tag">প্রেরক / Sender</div>
        <div class="label-content">${senderLines}</div>
      </div>
      <div class="label-divider"></div>
      <div class="label-half receiver">
        <div class="label-tag">প্রাপক / Receiver</div>
        <div class="label-content">${receiverLines}</div>
      </div>
    </div>`;
    }).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Magazine Labels</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', 'Noto Sans Bengali', Arial, sans-serif; font-size: 14px; }

  .label-page {
    width: 210mm;
    height: 297mm;
    display: flex;
    flex-direction: row;
    page-break-after: always;
    border: 1px solid #ccc;
  }

  .label-half {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 24mm 16mm;
    position: relative;
  }

  .label-tag {
    position: absolute;
    top: 12mm;
    left: 16mm;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #9b9589;
  }

  .label-divider {
    width: 1px;
    background: repeating-linear-gradient(
      to bottom,
      #ccc 0px, #ccc 6px,
      transparent 6px, transparent 12px
    );
    margin: 16mm 0;
    flex-shrink: 0;
  }

  .sender .label-content {
    font-size: 13px;
    line-height: 1.8;
    color: #5a564e;
    border-left: 3px solid #de5d04;
    padding-left: 12px;
  }

  .receiver .label-content {
    font-size: 15px;
    line-height: 2;
    color: #1c1a17;
    font-weight: 500;
  }

  .receiver .label-content strong {
    font-size: 18px;
    font-weight: 700;
    display: block;
    margin-bottom: 4px;
  }

  @media print {
    .label-page { border: none; }
  }
</style>
</head>
<body>${pages}</body>
</html>`;
}

// Labels Page
export default function LabelsPage() {
    const { tr } = useLang();
    const [members, setMembers] = useState<Member[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [org, setOrg] = useState<OrgSettings>({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [previewing, setPreviewing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [result, o] = await Promise.all([
                invoke<PagedResult<Member>>("list_members", {
                    search: search || null,
                    status: "active",
                    page: 1,
                    pageSize: 1000,
                }),
                invoke<OrgSettings>("get_org_settings"),
            ]);
            setMembers(result.data);
            setOrg(o);
            // Select all by default
            setSelected(new Set(result.data.map(x => x.id)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [search]);

    const toggleOne = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === members.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(members.map(m => m.id)));
        }
    };

    const selectedMembers = members.filter(m => selected.has(m.id));

    //   const handlePrint = () => {
    //     if (selectedMembers.length === 0) return;
    //     const html = buildLabelsHTML(selectedMembers, org);
    //     const win = window.open("", "_blank");
    //     if (!win) return;
    //     win.document.write(html);
    //     win.document.close();
    //     win.focus();
    //     setTimeout(() => { win.print(); }, 400);
    //   };
    const handlePrint = async () => {
        if (selectedMembers.length === 0) return;

        // 1. Build your HTML string (ensure it has the auto-print script inside)
        const html = buildLabelsHTML(selectedMembers, org);

        // Add auto-print logic if buildLabelsHTML doesn't have it
        const finalHtml = `
            ${html}
            <script>window.onload = () => { window.print(); }</script>
        `;

        try {
            const tempFileName = 'print_labels.html';

            // 2. Save the HTML to a temporary file in AppData
            await writeTextFile(tempFileName, finalHtml, {
                baseDir: BaseDirectory.AppData
            });

            // 3. Resolve the full path
            const appDataPath = await appDataDir();
            const fullPath = await join(appDataPath, tempFileName);

            // 4. Open that path in the default browser
            await openPath(fullPath);

        } catch (error) {
            console.error("Failed to print:", error);
        }
    };

    const handlePreview = () => setPreviewing(true);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Magazine Labels</div>
                    <div className="page-subtitle">
                        {selectedMembers.length} of {members.length} active members selected
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={handlePreview} disabled={selectedMembers.length === 0}>
                        👁 {tr("preview")}
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint} disabled={selectedMembers.length === 0}>
                        🖨 {tr("print")} {selectedMembers.length} Label{selectedMembers.length !== 1 ? "s" : ""}
                    </button>
                </div>
            </div>

            {/* Sender preview card */}
            <div className="card mb-4 max-w-sm">
                <div className="card-header"><div className="card-title">Sender (Left side of label)</div></div>
                <div className="card-body text-xs leading-relaxed text-text-secondary">
                    <strong className="text-text-primary">{org.name ?? "— Set in Settings →"}</strong><br />
                    {org.address && <>{org.address}<br /></>}
                    {org.mobile && <>Mobile: {org.mobile}<br /></>}
                    {!org.name && (
                        <span className="text-warning text-xs block">
                            ⚠ Set organisation details in Settings first
                        </span>
                    )}
                </div>
            </div>

            {/* Search + select */}
            <div className="flex items-center gap-3 mb-4">
                <div className="search-wrap">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                    </svg>
                    <input
                        className="input search-input"
                        placeholder="Filter members…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                    {selected.size === members.length ? "Deselect All" : "Select All"}
                </button>
            </div>

            {/* Member list */}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input
                                    type="checkbox"
                                    checked={selected.size === members.length && members.length > 0}
                                    onChange={toggleAll}
                                />
                            </th>
                            <th>{tr("name")}</th>
                            <th>{tr("address")}</th>
                            <th>{tr("district")}</th>
                            <th>{tr("pin")}</th>
                            <th>{tr("mobile")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={6} className="text-center text-text-muted p-6">{tr("loading")}…</td></tr>
                        )}
                        {!loading && members.length === 0 && (
                            <tr><td colSpan={6} className="text-center text-text-muted p-6">{tr("no_active_members")}</td></tr>
                        )}
                        {members.map(m => (
                            <tr
                                key={m.id}
                                onClick={() => toggleOne(m.id)}
                                className={`cursor-pointer transition-opacity ${selected.has(m.id) ? "opacity-100" : "opacity-45"}`}
                            >
                                <td onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                                </td>
                                <td className="font-medium">{m.name}</td>
                                <td className="text-muted">{m.address ?? "—"}</td>
                                <td className="text-muted">{m.district ?? "—"}</td>
                                <td className="text-muted">{m.pin_code ?? "—"}</td>
                                <td className="text-muted">{m.mobile ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Preview modal */}
            {previewing && (
                <div className="modal-overlay" onClick={() => setPreviewing(false)}>
                    <div
                        className="modal w-[90vw] max-w-2xl max-h-[85vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div className="modal-title">Label Preview — first label</div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setPreviewing(false)}>✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {selectedMembers[0] && (
                                <div className="flex border border-border rounded-md overflow-hidden min-h-56">
                                    {/* Sender */}
                                    <div className="flex-1 p-6 bg-surface-3 flex flex-col justify-center gap-1">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                                            প্রেরক / Sender
                                        </div>
                                        <div className="border-l-[3px] border-saffron-600 pl-2.5 leading-relaxed text-xs text-text-secondary">
                                            <strong className="text-text-primary">{org.name}</strong><br />
                                            {org.address && <>{org.address}<br /></>}
                                            {org.mobile && <>Mobile: {org.mobile}</>}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-px bg-border my-4" />

                                    {/* Receiver */}
                                    <div className="flex-1 p-6 flex flex-col justify-center gap-1">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                                            প্রাপক / Receiver
                                        </div>
                                        <div className="leading-loose text-sm">
                                            <strong className="text-base block">{selectedMembers[0].name}</strong>
                                            {selectedMembers[0].address && <>{selectedMembers[0].address}<br /></>}
                                            {selectedMembers[0].district && <>{selectedMembers[0].district}<br /></>}
                                            {selectedMembers[0].pin_code && <>PIN: {selectedMembers[0].pin_code}<br /></>}
                                            {selectedMembers[0].mobile && <>Mobile: {selectedMembers[0].mobile}</>}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-text-muted mt-3 text-center">
                                Each label prints on a full A4 page. {selectedMembers.length} page{selectedMembers.length !== 1 ? "s" : ""} total.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setPreviewing(false)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { setPreviewing(false); handlePrint(); }}>
                                🖨 Print Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}