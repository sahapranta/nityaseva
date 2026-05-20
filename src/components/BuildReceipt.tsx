import type { Donation, OrgSettings } from "../types/donations";
import { fmt, fmtDate } from "../utils/helper";

export default function BuildReceipt(donations: Donation[], org: OrgSettings): string {
    const first = donations[0];
    const isBatch = donations.length > 1;
    const total = donations.reduce((s, d) => s + d.amount, 0);

    const entryRows = donations.map(d => `
        <div class="row">
            <span class="label">
                ${d.donation_type_name ?? "General"}
                ${d.paid_for ? `<span class="paid-for">(${d.paid_for})</span>` : ""}
            </span>
            <span class="value">${fmt(d.amount)}</span>
        </div>
    `).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt ${first.slip_no}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; font-size: 13px; color: #1c1a17; }
  .header { text-align: center; border-bottom: 2px solid #de5d04; padding-bottom: 16px; margin-bottom: 24px; }
  .org-name { font-size: 22px; font-weight: 700; color: #de5d04; }
  .org-sub { font-size: 12px; color: #5a564e; margin-top: 4px; }
  .receipt-title { font-size: 16px; font-weight: 600; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .slip-no { font-size: 12px; color: #9b9589; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9b9589; margin-bottom: 8px; border-bottom: 1px solid #e8e5df; padding-bottom: 4px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e8e5df; }
  .row:last-child { border-bottom: none; }
  .label { color: #5a564e; }
  .paid-for { font-size: 11px; color: #9b9589; margin-left: 4px; }
  .value { font-weight: 500; text-align: right; white-space: nowrap; }
  .subtotal-row { display: flex; justify-content: space-between; padding: 8px 0 0; margin-top: 4px; border-top: 1px solid #d6d2c9; }
  .subtotal-label { font-size: 11px; color: #9b9589; }
  .subtotal-value { font-size: 12px; font-weight: 600; color: #5a564e; }
  .amount-box { background: #fff8ed; border: 2px solid #de5d04; border-radius: 8px; padding: 16px 20px; margin: 24px 0; display: flex; justify-content: space-between; align-items: center; }
  .amount-label { font-size: 13px; color: #5a564e; }
  .amount-value { font-size: 26px; font-weight: 700; color: #de5d04; }
  .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-line { border-top: 1px solid #1c1a17; width: 160px; text-align: center; padding-top: 6px; font-size: 11px; color: #9b9589; }
  .thank-you { text-align: center; margin-top: 32px; font-size: 12px; color: #9b9589; font-style: italic; }
  .watermark { text-align: center; margin-top: 8px; font-size: 10px; color: #d6d2c9; }
</style>
</head>
<body>
  <div class="header">
    <div class="org-name">${org.name ?? "Nityaseva"}</div>
    <div class="org-sub">${org.address ?? ""}</div>
    ${org.mobile ? `<div class="org-sub">Mobile: ${org.mobile}</div>` : ""}
    <div class="receipt-title">Donation Receipt</div>
    <div class="slip-no">Slip No: ${first.slip_no ?? "—"} &nbsp;|&nbsp; Date: ${fmtDate(first.donated_at)}</div>
  </div>

  <div class="section">
    <div class="section-title">Member Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${first.member_name}</span></div>
    ${first.member_mobile ? `<div class="row"><span class="label">Mobile</span><span class="value">${first.member_mobile}</span></div>` : ""}
    ${first.member_address ? `<div class="row"><span class="label">Address</span><span class="value">${first.member_address}</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">${isBatch ? "Donation Entries" : "Donation Details"}</div>
    ${entryRows}
    ${isBatch ? `
    <div class="subtotal-row">
      <span class="subtotal-label">${donations.length} entries</span>
      <span class="subtotal-value">${fmt(total)}</span>
    </div>` : ""}
    ${first.collected_by_name ? `<div class="row" style="margin-top:${isBatch ? "12px" : "0"}"><span class="label">Collected By</span><span class="value">${first.collected_by_name}</span></div>` : ""}
    ${first.note ? `<div class="row"><span class="label">Note</span><span class="value">${first.note}</span></div>` : ""}
  </div>

  <div class="amount-box">
    <span class="amount-label">Total Amount Received</span>
    <span class="amount-value">${fmt(total)}</span>
  </div>

  <div class="footer">
    <div class="sig-line">Member Signature</div>
    <div class="sig-line">Authorised Signatory</div>
  </div>

  <div class="thank-you">Thank you for your generous donation. May you be blessed.</div>
  <div class="watermark">Powered by Nityaseva</div>
</body>
</html>`;
}