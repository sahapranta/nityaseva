import { lazy, Suspense, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLang } from "../../contexts/LangContext";

const CollectionReport = lazy(() => import("./Collection"));
const CollectionByDateReport = lazy(() => import("./CollectionByDate"));
const MonthlySummaryReport = lazy(() => import("./MonthlySummary"));
const TopDonorsReport = lazy(() => import("./TopDonors"));
const FrequentDonorsReport = lazy(() => import("./FrequentDonors"));

const TABS = ["Monthly Summary", "Collection", "Collection (by Date)", "Top Donors", "Frequent Donors"] as const;
type Tab = typeof TABS[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-border mb-5">
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === t
              ? "text-saffron-700 border-b-2 border-saffron-600 -mb-0.5"
              : "text-text-secondary border-b-2 border-transparent"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="p-6 text-center text-text-muted">Loading…</div>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("Monthly Summary");
  const [orgName, setOrgName] = useState("Nityaseva");
  const { tr } = useLang();

  useEffect(() => {
    invoke<{ [k: string]: string }>("get_org_settings")
      .then(s => { if (s.name) setOrgName(s.name); })
      .catch(() => { });
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">{tr("reports")}</div>
      </div>
      <TabBar active={tab} onChange={setTab} />
      <Suspense fallback={<Loading />}>
        {tab === "Monthly Summary" && <MonthlySummaryReport orgName={orgName} />}
        {tab === "Collection" && <CollectionReport orgName={orgName} />}
        {tab === "Collection (by Date)" && <CollectionByDateReport orgName={orgName} />}
        {tab === "Top Donors" && <TopDonorsReport orgName={orgName} />}
        {tab === "Frequent Donors" && <FrequentDonorsReport orgName={orgName} />}
      </Suspense>
    </div>
  );
}
