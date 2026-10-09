export type UserRole = 'admin' | 'worker';

export type LogoutType = 'manual' | 'estimated' | 'auto';

export type BillStatus = 'pending' | 'paid';

export type LeadStatus = 'new' | 'followed_up' | 'converted' | 'dropped';

export interface Profile {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  api_token: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  login_time: string;
  logout_time: string | null;
  last_active: string;
  active_seconds: number;
  logout_type: LogoutType | null;
  is_late: boolean;
  created_at: string;
  updated_at: string;
  // joined fields:
  profiles?: Profile;
}

export interface Bill {
  id: string;
  client_name: string;
  bill_no: string;
  amount: number;
  bill_date: string;
  status: BillStatus;
  paid_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_overdue_30_days?: boolean;
}

export interface CallStats {
  id: string;
  user_id: string;
  date: string;
  total_calls: number;
  interested: number;
  not_interested: number;
  not_reachable: number;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  note: string | null;
  callback_date: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface WorkNote {
  id: string;
  user_id: string;
  date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  description: string;
  minutes: number;
  created_at: string;
}
