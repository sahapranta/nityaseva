import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from '@tauri-apps/plugin-opener';
import { useLang } from "../contexts/LangContext";

interface Member {
  id: number;
  name: string;
  mobile: string | null;
  address: string | null;
  district: string | null;
  pin_code: string | null;
  status: string;
  membership_type_name: string | null;
  last_donation: string | null;
  notes: string | null;
}

function whatsappUrl(mobile: string) {
  // Strip non-digits, ensure country code (BD = 880)
  let num = mobile.replace(/\D/g, "");
  if (num.startsWith("0")) num = "880" + num.slice(1);
  if (!num.startsWith("880")) num = "880" + num;
  return `https://web.whatsapp.com/send?phone=${num}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "badge-success" : status === "inactive" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function ContactsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const { tr } = useLang();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<Member[]>("list_members", {
        search: search || null,
        status: statusFilter || null,
      });
      setMembers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  const openWhatsApp = async (mobile: string) => {
    const url = whatsappUrl(mobile);
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{tr("contacts")}</div>
          <div className="page-subtitle">{members.length} member{members.length !== 1 ? "s" : ""} found</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 360 }}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            className="input search-input"
            style={{ width: "100%" }}
            placeholder="Search by name or mobile…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <select className="input" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{tr("all_statuses")}</option>
          <option value="active">{tr("active")}</option>
          <option value="inactive">{tr("inactive")}</option>
          <option value="skip">{tr("skip")}</option>
        </select>
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>Clear</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 320px" : "1fr", gap: 16, alignItems: "start" }}>
        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("name")}</th>
                <th>{tr("mobile")}</th>
                <th>{tr("district")}</th>
                <th>{tr("membership")}</th>
                <th>{tr("status")}</th>
                <th>{tr("lastDonation")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center p-8 text-text-muted">{tr("searching")}…</td></tr>
              )}
              {!loading && members.length === 0 && (
                <tr><td colSpan={7} className="text-center p-8 text-text-muted">
                  {search ? `No results for "${search}"` : tr("noMembersFound")}
                </td></tr>
              )}
              {members.map(m => (
                <tr
                  key={m.id}
                  onClick={() => setSelected(s => s?.id === m.id ? null : m)}
                  style={{
                    cursor: "pointer",
                    background: selected?.id === m.id ? "var(--color-saffron-50)" : undefined,
                  }}
                >
                  <td className="font-medium">{m.name}</td>
                  <td>
                    {m.mobile ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{m.mobile}</span>
                        <button
                          className="btn btn-ghost btn-icon p-0.5"
                          title="Open in WhatsApp"
                          onClick={e => { e.stopPropagation(); openWhatsApp(m.mobile!); }}
                        >
                          {/* WhatsApp icon */}
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="text-muted">{m.district ?? "—"}</td>
                  <td className="text-muted">{m.membership_type_name ?? "—"}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td className="text-muted">{m.last_donation ? m.last_donation.slice(0, 10) : "—"}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); setSelected(s => s?.id === m.id ? null : m); }}
                    >
                      {selected?.id === m.id ? tr("close") : tr("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ position: "sticky", top: 20 }}>
            <div className="card-header">
              <div className="card-title">{selected.name}</div>
              <button className="btn btn-ghost btn-icon ml-auto" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="card-body flex flex-col gap-3">

              <StatusBadge status={selected.status} />

              {/* Mobile + WhatsApp */}
              {selected.mobile && (
                <div>
                  <div className="label mb-1">{tr("mobile")}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{selected.mobile}</span>
                    <button
                      className="btn btn-sm"
                      style={{ background: "#25D366", color: "white", border: "none", gap: 6 }}
                      onClick={() => openWhatsApp(selected.mobile!)}
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </button>
                  </div>
                </div>
              )}

              {selected.address && (
                <div>
                  <div className="label mb-1">{tr("address")}</div>
                  <div style={{ fontSize: 13 }}>{selected.address}</div>
                </div>
              )}

              {selected.district && (
                <div>
                  <div className="label mb-1">{tr("district")}</div>
                  <div style={{ fontSize: 13 }}>{selected.district}{selected.pin_code ? ` — ${selected.pin_code}` : ""}</div>
                </div>
              )}

              {selected.membership_type_name && (
                <div>
                  <div className="label mb-1">{tr("membershipType")}</div>
                  <div style={{ fontSize: 13 }}>{selected.membership_type_name}</div>
                </div>
              )}

              {selected.last_donation && (
                <div>
                  <div className="label mb-1">{tr("lastDonation")}</div>
                  <div style={{ fontSize: 13 }}>{selected.last_donation.slice(0, 10)}</div>
                </div>
              )}

              {selected.notes && (
                <div>
                  <div className="label mb-1">{tr("notes")}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{selected.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}