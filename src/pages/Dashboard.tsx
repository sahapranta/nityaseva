import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";
import type { OrgSettings } from "../types/donations";
import { fmt as UFmt } from '../utils/helper'
import { PagedResult } from "../hooks/usePagination";

interface Donation {
  id: number;
  member_name: string;
  member_mobile: string | null;
  donation_type_name: string | null;
  amount: number;
  donated_at: string;
  slip_no: string | null;
}

interface MemberCounts { total: number; active: number; inactive: number; }
const fmt = (n: number) => UFmt(n, "en-BD", 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

function typeBadgeClass(type: string | null) {
  if (!type) return "badge-neutral";
  const t = type.toLowerCase();
  if (t.includes("monthly")) return "badge-info";
  if (t.includes("festival")) return "badge-warning";
  if (t.includes("voluntary")) return "badge-success";
  return "badge-neutral";
}

export default function Dashboard() {
  const [memberCounts, setMemberCounts] = useState<MemberCounts>({
    total: 0, active: 0, inactive: 0
  });
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [orgName, setOrgName] = useState("Nityaseva");
  const [loading, setLoading] = useState(true);
  const { tr } = useLang();

  useEffect(() => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    Promise.all([
      invoke<MemberCounts>("count_members"),
      invoke<PagedResult<Donation>>("list_donations", {
        search: null,
        donationType: null,
        fromDate: null,
        toDate: null,
        memberId: null,
        page: 1,           // Mandatory
        pageSize: 8,       // Mandatory
      }),
      invoke<{ total: number; count: number }>("donation_summary", {
        fromDate: firstOfMonth,
        toDate: todayStr,
      }),
      invoke<OrgSettings>("get_org_settings"),
    ]).then(([counts, donations, summary, org]) => {
      setMemberCounts(counts);
      setRecentDonations(donations.data);
      setMonthlyTotal(summary.total);
      setMonthlyCount(summary.count);
      if (org.name) setOrgName(org.name);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const monthLabel = today.toLocaleString("en-GB", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: 300 }}>
        <span className="text-text-muted">{tr("loading")}…</span>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{tr("dashboard")}</div>
          <div className="page-subtitle">{orgName} · {monthLabel}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-cols-4 mb-4">
        <div className="stat-card">
          <div className="stat-label">{tr("totalMembers")}</div>
          <div className="stat-value">{memberCounts.total}</div>
          <div className="stat-sub">{memberCounts.inactive} inactive</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr("activeMembers")}</div>
          <div className="stat-value">{memberCounts.active}</div>
          <div className="stat-sub">of {memberCounts.total} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr("thisMonth")}</div>
          <div className="stat-value">{fmt(monthlyTotal)}</div>
          <div className="stat-sub">{monthlyCount} donation{monthlyCount !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr("avgDonation")}</div>
          <div className="stat-value">{monthlyCount ? fmt(Math.ceil(monthlyTotal / monthlyCount)) : "৳ 0"}</div>
          <div className="stat-sub">per donation</div>
        </div>
      </div>

      {/* Recent donations */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">{tr("recentDonations")}</div>
          <span className="text-xs text-muted ml-auto">
            Last {recentDonations.length} entries
          </span>
        </div>

        {recentDonations.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            {tr("noDonationRecorded")}
          </div>
        ) : (
          <div>
            {recentDonations.map((d, i) => (
              <div
                key={d.id}
                className={`grid grid-cols-[1fr_auto] items-center px-4 py-3 gap-x-4 gap-y-1 transition-colors hover:bg-surface-3 ${i < recentDonations.length - 1 ? "border-b border-border-soft" : ""
                  }`}
              >
                {/* Left */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text-primary truncate">
                      {d.member_name}
                    </span>
                    {d.donation_type_name && (
                      <span className={`badge ${typeBadgeClass(d.donation_type_name)} text-xs py-0 px-2 shrink-0`}>
                        {d.donation_type_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {d.member_mobile && (
                      <span className="text-sm text-muted">{d.member_mobile}</span>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="text-right shrink-0">
                  <div className="font-bold text-saffron-700 tracking-tight whitespace-nowrap">
                    {fmt(d.amount)}
                  </div>
                  <div className="text-sm text-muted mt-0.5">
                    {fmtDate(d.donated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}