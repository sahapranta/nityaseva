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
  // Sections
  main:        { en: "Main",        bn: "প্রধান" },
  output:      { en: "Output",      bn: "আউটপুট" },
  system:      { en: "System",      bn: "সিস্টেম" },
  // Common
  search:      { en: "Search",      bn: "খুঁজুন" },
  add:         { en: "Add",         bn: "যোগ করুন" },
  edit:        { en: "Edit",        bn: "সম্পাদনা" },
  delete:      { en: "Delete",      bn: "মুছুন" },
  save:        { en: "Save",        bn: "সংরক্ষণ" },
  cancel:      { en: "Cancel",      bn: "বাতিল" },
  close:       { en: "Close",       bn: "বন্ধ" },
  loading:     { en: "Loading…",    bn: "লোড হচ্ছে…" },
  noData:      { en: "No data",     bn: "কোনো তথ্য নেই" },
  // Members
  name:        { en: "Name",        bn: "নাম" },
  mobile:      { en: "Mobile",      bn: "মোবাইল" },
  address:     { en: "Address",     bn: "ঠিকানা" },
  district:    { en: "District",    bn: "জেলা" },
  status:      { en: "Status",      bn: "অবস্থা" },
  active:      { en: "Active",      bn: "সক্রিয়" },
  inactive:    { en: "Inactive",    bn: "নিষ্ক্রিয়" },
  // Donations
  amount:      { en: "Amount",      bn: "পরিমাণ" },
  date:        { en: "Date",        bn: "তারিখ" },
  type:        { en: "Type",        bn: "ধরন" },
  // Dashboard 
  totalMembers:  { en: "Total",     bn: "মোট সদস্য" },
  activeMembers: { en: "Active",    bn: "সক্রিয় সদস্য" },
  thisMonth:     { en: "This Month",bn: "এই মাসে" },
  avgDonation:   { en: "Average",   bn: "গড় দান" },
  recentDonations: { en: "Recent Donations", bn: "সাম্প্রতিক দান" },
  noDonationRecorded: { en: "No donations recorded yet", bn: "এখনও কোনো দান গৃহীত হয়নি" },
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