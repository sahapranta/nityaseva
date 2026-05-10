export const fmt = (n: number) =>
    "৳ " + n.toLocaleString("en-BD", { minimumFractionDigits: 2 });

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });