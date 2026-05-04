import { JSX, useEffect, useState } from "react";
import "./App.css";
import MembersPage from "./Members";
import DonationsPage from "./pages/Donations";
import SettingsPage from "./pages/Settings";
import { useAuth } from "./contexts/AuthContext";
import LabelsPage from "./pages/Labels";
import DashboardPage from "./pages/Dashboard";
import ReportsPage from "./pages/Reports";
import SmsPage from "./pages/Sms";
import ContactsPage from "./pages/Contacts";
import MemberExportPage from "./pages/MemberExport";
import { GlobalSearch, SearchAction } from "./components/GlobalSearch";
import { Topbar } from "./components/Topbar";
import SideNav from "./components/SideNav";

export default function App() {
  const [active, setActive] = useState("dashboard");
  const { user } = useAuth();

  const pages: Record<string, JSX.Element> = {
    dashboard: <DashboardPage />,
    members: <MembersPage />,
    donations: <DonationsPage />,
    contacts: <ContactsPage />,
    labels: <LabelsPage />,
    export: <MemberExportPage />,
    sms: <SmsPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage currentRole={user?.role ?? "operator"} />
  };

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

  const onNavigate = (action: SearchAction) => {
    const { page, member, openDonation } = action;
    setActive(page);
    if (openDonation && member) {
      // small delay so the page renders first
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-donation-modal", { detail: member }));
      }, 200);
    }
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <SideNav active={active} setActive={setActive} />

      {/* Topbar */}
      <Topbar setActive={setActive} />

      {/* Content */}
      <main className="content">
        {pages[active] ?? null}
      </main>

      <GlobalSearch onNavigate={onNavigate} />
    </div>
  );
}