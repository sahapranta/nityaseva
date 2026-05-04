import Icon from "./Icon";
import { LogoutButton } from "./LogoutButton";

const icons = {
    dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    members: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    donations: "M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    contacts: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15z",
    labels: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
    reports: "M18 20V10 M12 20V4 M6 20v-6",
    settings: "M12 20a8 8 0 100-16 8 8 0 000 16z M12 14a2 2 0 100-4 2 2 0 000 4z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0",
    plus: "M12 5v14 M5 12h14",
    close: "M18 6L6 18 M6 6l12 12",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    chevron: "M9 18l6-6-6-6",
    bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
    db: "M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zM12 13.5c-4.42 0-8-1.57-8-3.5s3.58-3.5 8-3.5 8 1.57 8 3.5-3.58 3.5-8 3.5z",
    sms: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
};
const navGroups = [
    {
        label: "Main",
        items: [
            { id: "dashboard", label: "Dashboard", icon: "dashboard" },
            { id: "members", label: "Members", icon: "members" },
            { id: "donations", label: "Donations", icon: "donations" },
            { id: "contacts", label: "Contacts", icon: "contacts" },
        ],
    },
    {
        label: "Output",
        items: [
            { id: "labels", label: "Labels", icon: "labels" },
            { id: "sms", label: "SMS Export", icon: "sms" },
            { id: "reports", label: "Reports", icon: "reports" },
            { id: "export", label: "Export Members", icon: "labels" },
        ],
    },
    {
        label: "System",
        items: [
            { id: "settings", label: "Settings", icon: "settings" },
        ],
    },
];

export default function SideNav({ active, setActive }: {
    active: string;
    setActive: (id: string) => void;
}) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-mark">ন</div>
                <div className="sidebar-logo-text">Nityaseva</div>
            </div>
            <nav className="sidebar-nav">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        <div className="sidebar-section">{group.label}</div>
                        {group.items.map((item) => (
                            <div
                                key={item.id}
                                className={`nav-item ${active === item.id ? "active" : ""}`}
                                onClick={() => setActive(item.id)}
                            >
                                <span className="nav-icon">
                                    <Icon d={icons[item.icon as keyof typeof icons]} size={15} />
                                </span>
                                {item.label}
                            </div>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="sidebar-footer">
                <div className="nav-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </aside>
    );
}