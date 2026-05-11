import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";
import type { Member } from "../types/member";
import type { Donation } from "../types/donations";
import { useNavigate, useParams } from "react-router-dom";

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (n: number) =>
    "৳ " + n.toLocaleString("en-BD", { minimumFractionDigits: 2 });

const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    });

const fmtDateShort = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === "active" ? "badge-success" :
            status === "inactive" ? "badge-danger" : "badge-warning";
    return <span className={`badge ${cls}`}>{status}</span>;
}

const PAGE_SIZE = 25;

// Member View Page
export default function MemberView() {
    const { tr } = useLang();
    const [member, setMember] = useState<Member | null>(null);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [donLoading, setDonLoading] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [appliedFrom, setAppliedFrom] = useState("");
    const [appliedTo, setAppliedTo] = useState("");
    const [totalDonated, setTotalDonated] = useState(0);
    const navigate = useNavigate();
    const { id } = useParams();
    const memberId = Number(id);
    const onBack = () => navigate("/members");

    // Load member details
    useEffect(() => {
        invoke<Member>("get_member", { id: memberId })
            .then(setMember)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [memberId]);

    // Load donations
    const loadDonations = useCallback(async (pg: number, from: string, to: string) => {
        setDonLoading(true);
        try {
            const all = await invoke<Donation[]>("list_donations", {
                search: null,
                donationType: null,
                fromDate: from || null,
                toDate: to || null,
                memberId,
            });

            setTotal(all.length);
            setTotalDonated(all.reduce((s, d) => s + d.amount, 0));

            // Client-side pagination
            const start = (pg - 1) * PAGE_SIZE;
            setDonations(all.slice(start, start + PAGE_SIZE));
        } catch (e) {
            console.error(e);
        } finally {
            setDonLoading(false);
        }
    }, [memberId]);

    useEffect(() => {
        loadDonations(page, appliedFrom, appliedTo);
    }, [page, appliedFrom, appliedTo, loadDonations]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const applyFilter = () => {
        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
        setPage(1);
        setShowFilter(false);
    };

    const clearFilter = () => {
        setFromDate("");
        setToDate("");
        setAppliedFrom("");
        setAppliedTo("");
        setPage(1);
        setShowFilter(false);
    };

    const isFiltered = appliedFrom || appliedTo;

    if (loading) {
        return (
            <div className="page flex items-center justify-center" style={{ minHeight: 300 }}>
                <span className="text-muted">{tr('loading')}…</span>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="page">
                <button className="btn btn-ghost" onClick={onBack}>← Back</button>
                <p className="text-muted mt-4">{tr('member_not_found')}</p>
            </div>
        );
    }

    return (
        <div className="page">
            {/* Header */}
            <div className="page-header">
                <div className="flex items-center gap-3">
                    <button className="btn btn-ghost btn-sm" onClick={onBack}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                        Back
                    </button>
                    <div>
                        <div className="page-title">{member.name}</div>
                    </div>
                </div>
            </div>

            {/* Member info card */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="grid-cols-3 gap-5">
                        {/* Column 1 */}
                        <div className="flex flex-col gap-2">
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>Status</div>
                                <div className="mt-1"><StatusBadge status={member.status} /></div>
                            </div>
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>Mobile</div>
                                <div className="font-medium text-sm mt-1">{member.mobile ?? "—"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>Membership</div>
                                <div className="font-medium text-sm mt-1">{member.membership_type_name ?? "—"}</div>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="flex flex-col gap-2">
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>Address</div>
                                <div className="font-medium text-sm mt-1">{member.address ?? "—"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>District</div>
                                <div className="font-medium text-sm mt-1">
                                    {member.district ?? "—"}
                                    {member.pin_code ? ` — ${member.pin_code}` : ""}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: "0.5px" }}>Joined</div>
                                <div className="font-medium text-sm mt-1">{fmtDate(member.joined_at)}</div>
                            </div>
                        </div>

                        {/* Column 3 — stats */}
                        <div className="flex flex-col gap-3">
                            <div className="stat-card py-3 px-4">
                                <div className="stat-label">Total Donated</div>
                                <div className="stat-value text-xl">{fmt(totalDonated)}</div>
                            </div>
                            <div className="stat-card py-3 px-4">
                                <div className="stat-label">Total Donations</div>
                                <div className="stat-value text-xl">{total}</div>
                                {member.last_donation && (
                                    <div className="stat-sub">Last: {fmtDate(member.last_donation)}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {member.notes && (
                        <div className="mt-3 pt-3 border-t-border-soft">
                            <div className="text-xs text-muted font-semibold uppercase mb-1" style={{ letterSpacing: "0.5px" }}>Notes</div>
                            <div className="text-sm text-secondary">{member.notes}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Donation history */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">{tr("donation_history")}</div>
                    <div className="flex items-center gap-2 ml-auto">
                        {isFiltered && (
                            <span className="badge badge-warning" style={{ fontSize: 11 }}>
                                Filtered
                            </span>
                        )}
                        <span className="text-xs text-muted">
                            {total} donation{total !== 1 ? "s" : ""}
                            {isFiltered && " (filtered)"}
                        </span>
                        <button
                            className={`btn btn-sm ${isFiltered ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setShowFilter(f => !f)}
                        >
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            Filter
                        </button>
                    </div>
                </div>

                {/* Filter panel */}
                {showFilter && (
                    <div className="bg-surface-3 flex items-end gap-3 flex-wrap border-b-border-soft py-3.5 px-4">
                        <div className="form-group">
                            <label className="label">{tr('from')}</label>
                            <input
                                className="input"
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                style={{ width: 160 }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">{tr('to')}</label>
                            <input
                                className="input"
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                style={{ width: 160 }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={applyFilter}>
                                {tr('apply')}
                            </button>
                            {isFiltered && (
                                <button className="btn btn-secondary btn-sm" onClick={clearFilter}>
                                    {tr('clear')}
                                </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowFilter(false)}>
                                {tr('cancel')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Paid For</th>
                                <th>Collected By</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {donLoading && (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted p-8">
                                        {tr('loading')}…
                                    </td>
                                </tr>
                            )}
                            {!donLoading && donations.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted p-8">
                                        {isFiltered ? "No donations in this date range" : "No donations recorded"}
                                    </td>
                                </tr>
                            )}
                            {!donLoading && donations.map((d, index) => (
                                <tr key={d.id}>
                                    <td className="text-muted" style={{ fontSize: 11 }}>
                                        {index + 1 + (page - 1) * PAGE_SIZE}
                                    </td>
                                    <td className="text-muted">{fmtDateShort(d.donated_at)}</td>
                                    <td className="text-muted">{d.donation_type_name || <span>—</span>}</td>
                                    <td className="text-muted">{d.paid_for ?? "—"}</td>
                                    <td className="text-muted">{d.collected_by_name ?? "—"}</td>
                                    <td className="text-right font-semibold whitespace-nowrap">
                                        {fmt(d.amount)}
                                    </td>
                                </tr>
                            ))}

                            {/* Total row */}
                            {!donLoading && donations.length > 0 && (
                                <tr className="bg-saffron-50 font-bold">
                                    <td colSpan={5} style={{ padding: "10px 14px", fontSize: 13 }}>
                                        Page total ({donations.length} donation{donations.length !== 1 ? "s" : ""})
                                    </td>
                                    <td className="text-right bg-saffron-100 whitespace-nowrap px-3.5 py-2.5">
                                        {fmt(donations.reduce((s, d) => s + d.amount, 0))}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t-border-soft">
                        <span className="text-xs text-muted">
                            Page {page} of {totalPages} · {total} total
                        </span>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                            >«</button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >‹ Prev</button>
                            {/* Page numbers */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) =>
                                    p === "..." ? (
                                        <span key={`ellipsis-${i}`} className="text-muted"
                                            style={{ padding: "5px 4px", fontSize: 13 }}>…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            className={`btn btn-sm ${page === p ? "btn-primary" : "btn-secondary"}`}
                                            onClick={() => setPage(p as number)}
                                            style={{ minWidth: 32 }}
                                        >{p}</button>
                                    )
                                )
                            }
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >Next ›</button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                            >»</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}