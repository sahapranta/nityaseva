import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";
import type { Member } from "../types/member";
import type { Donation } from "../types/donations";
import { useNavigate, useParams } from "react-router-dom";
import typeBadgeClass from "../components/TypeBadgeClass";
import Pagination from "../components/Pagination";
import { PagedResult, usePagination } from "../hooks/usePagination";
import { fmt } from '../utils/helper';

const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    });

const fmtDateShort = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short",
    });

const PAGE_SIZE = 25;

// ── Status Badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const cls =
        status === "active" ? "badge-success" :
            status === "inactive" ? "badge-danger" : "badge-warning";
    return <span className={`badge ${cls}`}>{status}</span>;
}

// Member View
export default function MemberView() {
    const { tr } = useLang();
    const navigate = useNavigate();
    const { id } = useParams();
    const memberId = Number(id);

    const [member, setMember] = useState<Member | null>(null);
    const [memberLoading, setMemberLoading] = useState(true);
    const [totalDonated, setTotalDonated] = useState(0);
    const [showFilter, setShowFilter] = useState(false);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [appliedFrom, setAppliedFrom] = useState("");
    const [appliedTo, setAppliedTo] = useState("");

    // ── Load member ───────────────────────────────────────────────────
    useEffect(() => {
        setMemberLoading(true);
        invoke<Member>("get_member", { id: memberId })
            .then(setMember)
            .catch(console.error)
            .finally(() => setMemberLoading(false));
    }, [memberId]);

    // ── Load summary total (all pages, filtered) ──────────────────────
    useEffect(() => {
        invoke<{ total: number; count: number }>("donation_summary", {
            memberId,
            fromDate: appliedFrom || null,
            toDate: appliedTo || null,
        }).then(res => setTotalDonated(res.total))
            .catch(console.error);
    }, [memberId, appliedFrom, appliedTo]);

    // ── Paginated donations ───────────────────────────────────────────
    const fetcher = useCallback(
        (pg: number, size: number) =>
            invoke<PagedResult<Donation>>("list_donations", {
                search: null,
                donationType: null,
                fromDate: appliedFrom || null,
                toDate: appliedTo || null,
                memberId: memberId,
                page: pg,
                pageSize: size,
            }),
        [memberId, appliedFrom, appliedTo]
    );

    const {
        data: donations,
        total,
        total_pages,
        page,
        loading: donLoading,
        goTo,
    } = usePagination(fetcher, { pageSize: PAGE_SIZE });

    // Reset to page 1 when filters change
    useEffect(() => { goTo(1); }, [memberId, appliedFrom, appliedTo]);

    // ── Filter actions 
    const isFiltered = !!(appliedFrom || appliedTo);

    const applyFilter = () => {
        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
        setShowFilter(false);
    };

    const clearFilter = () => {
        setFromDate("");
        setToDate("");
        setAppliedFrom("");
        setAppliedTo("");
        setShowFilter(false);
    };

    // ── Loading / not found guards ────────────────────────────────────
    if (memberLoading) {
        return (
            <div className="page flex items-center justify-center min-h-64">
                <span className="text-muted">{tr("loading")}</span>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="page">
                <button className="btn btn-ghost mb-4" onClick={() => navigate("/members")}>
                    ← Back
                </button>
                <p className="text-muted">{tr("member_not_found")}.</p>
            </div>
        );
    }

    const pageTotal = donations.reduce((s, d) => s + d.amount, 0);

    return (
        <div className="page">
            {/* ── Header ── */}
            <div className="page-header">
                <div className="flex items-center gap-3">
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate("/members")}
                    >
                        <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                        Back
                    </button>
                    <div>
                        <div className="page-title">{member.name}</div>
                        <div className="page-subtitle flex items-center gap-2 mt-0.5">
                            <StatusBadge status={member.status} />
                            {member.membership_type_name && (
                                <span className="text-muted">
                                    · {member.membership_type_name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Member info card ── */}
            <div className="card mb-4">
                <div className="card-body py-3">
                    <div className="flex flex-wrap gap-x-8 gap-y-3 items-start">
                        {[
                            { label: "Mobile", value: member.mobile },
                            { label: "Address", value: member.address },
                            {
                                label: "District",
                                value: member.district
                                    ? `${member.district}${member.pin_code ? ` - ${member.pin_code}` : ""}`
                                    : null,
                            },
                            { label: "Joined", value: fmtDate(member.joined_at) },
                        ].map(({ label, value }) =>
                            value ? (
                                <div key={label}>
                                    <div className="text-xs text-muted font-semibold uppercase tracking-wide">
                                        {label}
                                    </div>
                                    <div className="text-sm font-medium mt-0.5">{value}</div>
                                </div>
                            ) : null
                        )}

                        {/* Stats — pushed right */}
                        <div className="ml-auto flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs text-muted font-semibold uppercase tracking-wide">
                                    Total Donated
                                </div>
                                <div className="text-lg font-bold mt-0.5 text-saffron-700">
                                    {fmt(totalDonated)}
                                </div>
                            </div>
                            <div className="w-px h-8 bg-border-soft" />
                            <div className="text-right">
                                <div className="text-xs text-muted font-semibold uppercase tracking-wide">
                                    {tr("donations")}
                                </div>
                                <div className="text-lg font-bold mt-0.5">{total}</div>
                                {member.last_donation && (
                                    <div className="text-xs text-muted">
                                        Last {fmtDateShort(member.last_donation)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {member.notes && (
                        <div className="mt-2 pt-2 border-t-border-soft">
                            <span className="text-xs text-muted">Note: </span>
                            <span className="text-sm text-secondary">{member.notes}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Donation history card ── */}
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
                    <div className="flex items-end gap-3 flex-wrap px-4 py-3 bg-surface-3 border-b-border-soft">
                        <div className="form-group">
                            <label className="label">{tr("from")}</label>
                            <input
                                className="input"
                                type="date"
                                style={{ width: 160 }}
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">{tr("to")}</label>
                            <input
                                className="input"
                                type="date"
                                style={{ width: 160 }}
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={applyFilter}>
                                Apply
                            </button>
                            {isFiltered && (
                                <button className="btn btn-secondary btn-sm" onClick={clearFilter}>
                                    Clear
                                </button>
                            )}
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowFilter(false)}
                            >
                                Cancel
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
                                <th>{tr("date")}</th>
                                <th>{tr("type")}</th>
                                <th>{tr("paidFor")}</th>
                                <th>{tr("collectedBy")}</th>
                                <th className="text-right">{tr("amount")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {donLoading && (
                                <tr>
                                    <td colSpan={6}
                                        className="text-center text-muted"
                                        style={{ padding: 32 }}>
                                        {tr("loading")}…
                                    </td>
                                </tr>
                            )}

                            {!donLoading && donations.length === 0 && (
                                <tr>
                                    <td colSpan={6}
                                        className="text-center text-muted"
                                        style={{ padding: 32 }}>
                                        {isFiltered
                                            ? "No donations in this date range"
                                            : "No donations recorded"}
                                    </td>
                                </tr>
                            )}

                            {!donLoading && donations.map((d, i) => (
                                <tr key={d.id}>
                                    <td className="text-muted text-xs">
                                        {(page - 1) * PAGE_SIZE + i + 1}
                                    </td>
                                    <td className="text-muted">
                                        {fmtDateShort(d.donated_at)}
                                    </td>
                                    <td>
                                        {d.donation_type_name
                                            ? <span className={`badge ${typeBadgeClass(d.donation_type_name)}`}>
                                                {d.donation_type_name}
                                            </span>
                                            : <span className="text-muted">—</span>}
                                    </td>
                                    <td className="text-muted">{d.paid_for ?? "—"}</td>
                                    <td className="text-muted">{d.collected_by_name ?? "—"}</td>
                                    <td className="text-right font-semibold whitespace-nowrap text-saffron-700">
                                        {fmt(d.amount)}
                                    </td>
                                </tr>
                            ))}

                            {/* Page total row */}
                            {!donLoading && donations.length > 0 && (
                                <tr className="bg-saffron-50 font-bold">
                                    <td colSpan={5} className="text-sm px-3.5 py-2.5">
                                        Page total ({donations.length})
                                    </td>
                                    <td className="text-right whitespace-nowrap text-saffron-700 px-3.5 py-2.5">                                        
                                        {fmt(pageTotal)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <Pagination
                    page={page}
                    totalPages={total_pages}
                    total={total}
                    pageSize={PAGE_SIZE}
                    onChange={goTo}
                    loading={donLoading}
                />
            </div>
        </div>
    );
}