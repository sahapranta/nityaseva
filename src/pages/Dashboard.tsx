import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../contexts/LangContext";

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
interface OrgSettings { [key: string]: string; }

const fmt = (n: number) => "৳ " + n.toLocaleString("en-BD", { minimumFractionDigits: 0 });
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
  const [memberCounts, setMemberCounts] = useState<MemberCounts>({ total: 0, active: 0, inactive: 0 });
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
      invoke<Donation[]>("list_donations", {
        search: null, donationType: null,
        fromDate: null, toDate: null, memberId: null,
      }),
      invoke<{ total: number; count: number }>("donation_summary", {
        fromDate: firstOfMonth,
        toDate: todayStr,
      }),
      invoke<OrgSettings>("get_org_settings"),
    ]).then(([counts, donations, summary, org]) => {
      setMemberCounts(counts);
      setRecentDonations(donations.slice(0, 8));
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
        <span style={{ color: "var(--color-text-muted)" }}>Loading…</span>
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
          <div className="stat-value">{monthlyCount ? fmt(monthlyTotal / monthlyCount) : "৳ 0"}</div>
          <div className="stat-sub">per donation</div>
        </div>
      </div>

      {/* Recent donations */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">{tr("recentDonations")}</div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: "auto" }}>
            Last {recentDonations.length} entries
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Slip</th>
                <th>Member</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentDonations.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-text-muted">
                    {tr("noDonationRecorded")}
                  </td>
                </tr>
              )}
              {recentDonations.map(d => (
                <tr key={d.id}>
                  <td className="text-muted" style={{ fontSize: 11 }}>{d.slip_no ?? "—"}</td>
                  <td>
                    <div className="font-medium">{d.member_name}</div>
                    {d.member_mobile && (
                      <div className="text-muted" style={{ fontSize: 11 }}>{d.member_mobile}</div>
                    )}
                  </td>
                  <td>
                    {d.donation_type_name
                      ? <span className={`badge ${typeBadgeClass(d.donation_type_name)}`}>{d.donation_type_name}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="font-semibold text-saffron-700 text-right">
                    {fmt(d.amount)}
                  </td>
                  <td className="text-muted">{fmtDate(d.donated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}