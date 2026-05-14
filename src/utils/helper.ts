export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmt = (n: number, locale: string = "en-BD", minimumFractionDigits: number = 2) =>
    "৳ " + n.toLocaleString(locale, { minimumFractionDigits });

export const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });