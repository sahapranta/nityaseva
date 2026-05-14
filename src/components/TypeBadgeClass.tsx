export default function TypeBadgeClass(type: string): string {
    const t = type.toLowerCase();
    if (t.includes("monthly")) return "badge-info";
    if (t.includes("festival")) return "badge-warning";
    if (t.includes("voluntary")) return "badge-success";
    return "badge-neutral";
}