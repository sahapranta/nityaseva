import { lazy, Suspense } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { Topbar } from "./components/Topbar";
import SideNav from "./components/SideNav";
import { GlobalSearch } from "./components/GlobalSearch";
import { useAuth } from "./contexts/AuthContext";

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
const MemberViewPage = lazy(() => import("./pages/MemberView"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-text-muted">
      Loading...
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <SideNav />
      <Topbar />

      <main className="content">
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </main>

      <GlobalSearch />
    </div>
  );
}

function SettingsWrapper() {
  const { user } = useAuth();

  return (
    <SettingsPage currentRole={user?.role ?? "operator"} />
  );
}

export default function AppRouter() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:id" element={<MemberViewPage />} />
          <Route path="/donations" element={<DonationsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="/export" element={<MemberExportPage />} />
          <Route path="/sms" element={<SmsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsWrapper />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}