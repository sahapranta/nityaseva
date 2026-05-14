export default function StatusBadge({ status }: { status: string }) {
    const cls = status === "active" ? "badge-success"
        : status === "inactive" ? "badge-danger" : "badge-warning";
    return <span className={`badge ${cls}`}>{status}</span>;
}