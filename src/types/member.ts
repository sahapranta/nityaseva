export interface Member {
  id: number;
  name: string;
  mobile: string | null;
  address: string | null;
  district: string | null;
  pin_code: string | null;
  membership_type_name: string | null;
  status: string;
  last_donation: string | null;
  joined_at: string;
  notes: string | null;
}