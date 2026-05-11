import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "en" | "bn";

const t: Record<string, Record<Lang, string>> = {
  // Nav
  dashboard:   { en: "Dashboard",   bn: "ড্যাশবোর্ড" },
  members:     { en: "Members",     bn: "সদস্যগণ" },
  donations:   { en: "Donations",   bn: "দান" },
  contacts:    { en: "Contacts",    bn: "যোগাযোগ" },
  labels:      { en: "Labels",      bn: "লেবেল" },
  sms:         { en: "SMS Export",  bn: "এসএমএস" },
  reports:     { en: "Reports",     bn: "প্রতিবেদন" },
  export:      { en: "Export",      bn: "এক্সপোর্ট" },
  settings:    { en: "Settings",    bn: "সেটিংস" },
  this_month:  { en: "This Month", bn: "এই মাস" },
  last_month:  { en: "Last Month", bn: "গত মাস" },
  this_year:   { en: "This Year",  bn: "এই বছর" },
  last_year:   { en: "Last Year",  bn: "গত বছর" },
  from:        { en: "From",       bn: "থেকে" },
  to:          { en: "To",         bn: "পর্যন্ত" },
  apply:       { en: "Apply",      bn: "প্রয়োগ" },
  // Sections
  main:        { en: "Main",        bn: "প্রধান" },
  output:      { en: "Output",      bn: "আউটপুট" },
  system:      { en: "System",      bn: "সিস্টেম" },
  // Common
  search:      { en: "Search",      bn: "খুঁজুন" },
  searching:   { en: "Searching",   bn: "খুঁজছি" },
  view:        { en: "View",        bn: "দেখুন" },
  skip:        { en: "Skip",        bn: "স্কিপ" },
  add:         { en: "Add",         bn: "যোগ করুন" },
  edit:        { en: "Edit",        bn: "এডিট" },
  delete:      { en: "Delete",      bn: "মুছুন" },
  save:        { en: "Save",        bn: "সংরক্ষণ" },
  cancel:      { en: "Cancel",      bn: "বাতিল" },
  close:       { en: "Close",       bn: "বন্ধ" },
  loading:     { en: "Loading…",    bn: "লোড হচ্ছে…" },
  noData:      { en: "No data",     bn: "কোনো তথ্য নেই" },
  print:       { en: "Print",       bn: "প্রিন্ট" },
  printPdf:    { en: "Print PDF",   bn: "প্রিন্ট পিডিএফ" },
  csv:         { en: "Export CSV",   bn: "সিএসভি" },
  save_changes:{ en: "Save Changes", bn: "পরিবর্তন সংরক্ষণ" },
  // Members
  name:        { en: "Name",        bn: "নাম" },
  fullName:    { en: "Full Name",   bn: "পূর্ণ নাম" },
  mobile:      { en: "Mobile",      bn: "মোবাইল" },
  address:     { en: "Address",     bn: "ঠিকানা" },
  district:    { en: "District",    bn: "জেলা" },
  postCode:    { en: "Postcode",    bn: "পোস্টকোড" },
  status:      { en: "Status",      bn: "অবস্থা" },
  active:      { en: "Active",      bn: "সক্রিয়" },
  inactive:    { en: "Inactive",    bn: "নিষ্ক্রিয়" },
  membership:  { en: "Membership",  bn: "সদস্যপদ" },
  membershipType:  { en: "Membership Type",  bn: "সদস্যপদের প্রকার" },
  lastDonation: { en: "Last Donation", bn: "সর্বশেষ দান" },
  noMembersFound: { en: "No members found", bn: "কোনো সদস্য পাওয়া যায়নি" },
  saving:      { en: "Saving…",      bn: "সংরক্ষণ হচ্ছে…" },
  saveChanges: { en: "Save Changes", bn: "পরিবর্তন সংরক্ষণ" },
  addMember:   { en: "Add Member",   bn: "সদস্য যোগ করুন" },
  refresh:     { en: "Refresh",      bn: "রিফ্রেশ" },
  notes:       { en: "Notes",        bn: "নোট" },
  note:        { en: "Note",         bn: "নোট" },
  // Donations
  donate:       { en: "Donate",         bn: "দান করুন" },
  amount:       { en: "Amount",         bn: "পরিমাণ" },
  date:         { en: "Date",           bn: "তারিখ" },
  type:         { en: "Type",           bn: "ধরন" },
  donation_type:{ en: "Donation Type",  bn: "দানের ধরন" },
  new_donation: { en: "New Donation",   bn: "নতুন দান" },
  edit_donation:{ en: "Edit Donation", bn: "দান সম্পাদনা" },
  clear:        { en: "Clear",          bn: "পরিষ্কার" },
  slip_no:      { en: "Slip No.",       bn: "স্লিপ নং" },
  paid_for:     { en: "Paid For",       bn: "পেইড ফর" },
  collected_by: { en: "Collected By",   bn: "গ্রহন করেছেন" },
  search_member:{ en: "Search member…", bn: "সদস্য খুঁজুন…" },
  total:        { en: "Total",          bn: "মোট" },
  all_types:    { en: "All Types",      bn: "সব ধরন" },
  member:       { en: "Member",         bn: "সদস্য" },
  editMember:   { en: "Edit Member",    bn: "সদস্য সম্পাদনা" },
  print_receipt:{ en: "Print Receipt",  bn: "রসিদ প্রিন্ট" },
  record_donation:{ en: "Record Donation", bn: "দান রেকর্ড করুন" },
  no_donations_found: { en: "No donations found", bn: "কোনো দান পাওয়া যায়নি" },  
  // Contacts
  all_statuses: { en: "All Statuses",   bn: "সব অবস্থা" },
  // sms
  message:      { en: "Message",     bn: "বার্তা" },
  template:     { en: "Template",    bn: "টেমপ্লেট" },
  preview:      { en: "Preview",     bn: "প্রিভিউ" },
  export_csv:   { en: "Export CSV",  bn: "সিএসভি এক্সপোর্ট" },
  no_active_members: { en: "No active members found", bn: "কোনো সক্রিয় সদস্য পাওয়া যায়নি" },
  // Member Export
  member_export: { en: "Member Export", bn: "সদস্য এক্সপোর্ট" },
  export_member_list: { en: "Export member list as CSV or Excel", bn: "সদস্য তালিকা সিএসভি বা এক্সেল হিসেবে এক্সপোর্ট করুন" },
  // Dashboard 
  totalMembers:       { en: "Total",     bn: "মোট সদস্য" },
  activeMembers:      { en: "Active",    bn: "সক্রিয় সদস্য" },
  thisMonth:          { en: "This Month",bn: "এই মাসে" },
  avgDonation:        { en: "Average",   bn: "গড় দান" },
  recentDonations:    { en: "Recent Donations", bn: "সাম্প্রতিক দান" },
  noDonationRecorded: { en: "No donations recorded yet", bn: "এখনও কোনো দান গৃহীত হয়নি" },
  // Member View
  donation_history:   { en: "Donation History", bn: "দানের ইতিহাস" },
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (key: string) => string;
}

const LangContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  tr: (k) => k,
});

export const useLang = () => useContext(LangContext);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem("nityaseva_lang") as Lang) ?? "en";
  });

  const switchLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("nityaseva_lang", l);
  };

  const tr = (key: string) => t[key]?.[lang] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang: switchLang, tr }}>
      {children}
    </LangContext.Provider>
  );
}