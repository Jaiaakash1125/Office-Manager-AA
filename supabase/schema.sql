-- ==============================================================================
-- Office Manager - Complete Supabase Database Schema & RLS Policies
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. PROFILES TABLE (Roles & user metadata)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text unique not null,
  role text not null check (role in ('admin', 'worker')),
  active boolean default true not null,
  api_token text unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Index for fast username & role lookups
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_api_token on public.profiles(api_token);

-- 3. ATTENDANCE TABLE
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  login_time timestamptz not null,
  logout_time timestamptz,
  last_active timestamptz not null,
  active_seconds integer default 0 not null,
  logout_type text check (logout_type in ('manual', 'estimated', 'auto')),
  is_late boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_user_attendance_per_day unique (user_id, date)
);

create index if not exists idx_attendance_user_date on public.attendance(user_id, date);
create index if not exists idx_attendance_date on public.attendance(date);

-- 4. BILLS TABLE (Manual Invoicing & 30-day alerts)
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  bill_no text not null,
  amount numeric(12,2) not null check (amount >= 0),
  bill_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_bills_status on public.bills(status);
create index if not exists idx_bills_date on public.bills(bill_date);

-- 5. CALL STATS TABLE (Daily summary of telecalling counts)
create table if not exists public.call_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  total_calls integer default 0 not null check (total_calls >= 0),
  interested integer default 0 not null check (interested >= 0),
  not_interested integer default 0 not null check (not_interested >= 0),
  not_reachable integer default 0 not null check (not_reachable >= 0),
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_user_call_stats_per_day unique (user_id, date)
);

create index if not exists idx_call_stats_user_date on public.call_stats(user_id, date);

-- 6. LEADS TABLE (Interested prospects with callback reminders)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  note text,
  callback_date date,
  status text not null default 'new' check (status in ('new', 'followed_up', 'converted', 'dropped')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_leads_user_id on public.leads(user_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_callback_date on public.leads(callback_date);

-- 7. WORK NOTES TABLE (Daily wrap-up note)
create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  note text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_user_work_notes_per_day unique (user_id, date)
);

create index if not exists idx_work_notes_user_date on public.work_notes(user_id, date);

-- 8. WORK LOG TABLE (Detailed itemized work minutes)
create table if not exists public.work_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  description text not null,
  minutes integer not null check (minutes > 0),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_work_log_user_date on public.work_log(user_id, date);

-- ==============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function to check if current authenticated user is an admin
create or replace function public.is_admin()
returns boolean security definer
language plpgsql
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
end;
$$;

-- Trigger to update updated_at timestamps automatically
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_attendance_updated_at before update on public.attendance
  for each row execute function public.handle_updated_at();

create trigger set_bills_updated_at before update on public.bills
  for each row execute function public.handle_updated_at();

create trigger set_call_stats_updated_at before update on public.call_stats
  for each row execute function public.handle_updated_at();

create trigger set_leads_updated_at before update on public.leads
  for each row execute function public.handle_updated_at();

create trigger set_work_notes_updated_at before update on public.work_notes
  for each row execute function public.handle_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.bills enable row level security;
alter table public.call_stats enable row level security;
alter table public.leads enable row level security;
alter table public.work_notes enable row level security;
alter table public.work_log enable row level security;

-- PROFILES RLS
create policy "Users can view own profile or admin can view all"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Admin can insert profiles"
  on public.profiles for insert
  with check (public.is_admin() or auth.uid() = id);

create policy "Admin can update profiles or user can update own basic info"
  on public.profiles for update
  using (public.is_admin() or auth.uid() = id);

create policy "Admin can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- ATTENDANCE RLS
create policy "Admin can select all attendance, worker selects own"
  on public.attendance for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Users can insert own attendance or admin can insert any"
  on public.attendance for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Users can update own attendance or admin can update any"
  on public.attendance for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Admin can delete attendance"
  on public.attendance for delete
  using (public.is_admin());

-- BILLS RLS (Admin full access, workers read-only or restricted)
create policy "Admin full access to bills"
  on public.bills for all
  using (public.is_admin());

create policy "Workers can view bills"
  on public.bills for select
  using (auth.uid() is not null);

-- CALL STATS RLS
create policy "Admin sees all call stats, worker sees own"
  on public.call_stats for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Worker inserts own call stats, admin can insert any"
  on public.call_stats for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Worker updates own call stats, admin can update any"
  on public.call_stats for update
  using (auth.uid() = user_id or public.is_admin());

-- LEADS RLS
create policy "Admin sees all leads, worker sees own"
  on public.leads for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Worker inserts own leads, admin can insert any"
  on public.leads for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Worker updates own leads, admin can update any"
  on public.leads for update
  using (auth.uid() = user_id or public.is_admin());

create policy "Admin can delete leads"
  on public.leads for delete
  using (public.is_admin());

-- WORK NOTES RLS
create policy "Admin sees all work notes, worker sees own"
  on public.work_notes for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Worker inserts own work note, admin can insert any"
  on public.work_notes for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Worker updates own work note, admin can update any"
  on public.work_notes for update
  using (auth.uid() = user_id or public.is_admin());

-- WORK LOG RLS
create policy "Admin sees all work logs, worker sees own"
  on public.work_log for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Worker inserts own work log, admin can insert any"
  on public.work_log for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "Worker deletes own work log, admin can delete any"
  on public.work_log for delete
  using (auth.uid() = user_id or public.is_admin());
