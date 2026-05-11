import { useEffect, useState, lazy, Suspense } from "react";
import "./App.css";
import { useAuth } from "./contexts/AuthContext";
import { GlobalSearch, SearchAction } from "./components/GlobalSearch";
import { Topbar } from "./components/Topbar";
import SideNav from "./components/SideNav";

// Lazy pages
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const MembersPage = lazy(() => import("./pages/Members"));
const DonationsPage = lazy(() => import("./pages/Donations"));
const ContactsPage = lazy(() => import("./pages/Contacts"));
const LabelsPage = lazy(() => import("./pages/Labels"));
const MemberExportPage = lazy(() => import("./pages/MemberExport"));
const SmsPage = lazy(() => import("./pages/Sms"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/Settings"));

// ── Page fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[100%] text-text-muted text-sm">
      Loading…
    </div>
  );
}

// ── Route map
type PageKey =
  | "dashboard" | "members" | "donations" | "contacts"
  | "labels" | "export" | "sms" | "reports" | "settings";

export default function App() {
  const [active, setActive] = useState<PageKey>("dashboard");
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => {
      const member = (e as CustomEvent).detail;
      setActive("donations");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-donation-modal", { detail: member }));
      }, 200);
    };
    window.addEventListener("navigate-donate", handler);
    return () => window.removeEventListener("navigate-donate", handler);
  }, []);

  const onNavigate = ({ page, member, openDonation }: SearchAction) => {
    setActive(page as PageKey);
    if (openDonation && member) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-donation-modal", { detail: member }));
      }, 200);
    }
  };

  const renderPage = () => {
    switch (active) {
      case "dashboard": return <DashboardPage />;
      case "members": return <MembersPage />;
      case "donations": return <DonationsPage />;
      case "contacts": return <ContactsPage />;
      case "labels": return <LabelsPage />;
      case "export": return <MemberExportPage />;
      case "sms": return <SmsPage />;
      case "reports": return <ReportsPage />;
      case "settings": return <SettingsPage currentRole={user?.role ?? "operator"} />;
      default: return <DashboardPage />;
    }
  };

  const navigate = (id: string) => setActive(id as PageKey);

  return (
    <div className="app-shell">
      <SideNav active={active} setActive={navigate} />
      <Topbar />
      <main className="content">
        <Suspense fallback={<PageLoader />}>
          {renderPage()}
        </Suspense>
      </main>
      <GlobalSearch onNavigate={onNavigate} />
    </div>
  );
}