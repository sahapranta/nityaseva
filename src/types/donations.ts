export interface Donation {
    id: number;
    member_id: number;
    member_name: string;
    member_mobile: string | null;
    member_address: string | null;
    donation_type: number | null;
    donation_type_name: string | null;
    amount: number;
    paid_for: string | null;
    collected_by: number | null;
    collected_by_name: string | null;
    slip_no: string | null;
    note: string | null;
    donated_at: string;
}

export interface DonationType { id: number; name: string; }
export interface Member { id: number; name: string; mobile: string | null; }
export interface OrgSettings { [key: string]: string; }