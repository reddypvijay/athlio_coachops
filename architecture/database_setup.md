# Database Setup SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Section 4 (Data Schemas)

## Goal
Initialize Supabase PostgreSQL database with all 7 CoachOps tables, RLS policies, and performance indexes.

## Prerequisites
- Supabase project created (free tier sufficient)
- Database URL and anon key available in `.env`
- Service role key available (for admin operations)

---

## Tables to Create (in dependency order)

### 1. communities
```sql
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  contact_person text not null,
  contact_phone text not null check (contact_phone ~ '^\+91[6-9]\d{9}$'),
  contract_start_date date not null,
  monthly_fee decimal(10,2) check (monthly_fee >= 0),
  status text not null default 'active' check (status in ('active','inactive','terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 2. sports
```sql
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  sport_name text not null,
  shift_timings jsonb,
  operating_days jsonb not null,
  weekly_off_day text not null,
  location_within_community text,
  notes text,
  created_at timestamptz not null default now()
);
```

### 3. coaches
```sql
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique check (phone ~ '^\+91[6-9]\d{9}$'),
  email text,
  bank_account_number text not null,    -- encrypted at application layer
  bank_ifsc text not null check (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  upi_id text,
  -- NOTE: monthly_salary is NOT here. It lives on coach_sport_assignments.
  joining_date date not null,
  status text not null default 'active' check (status in ('active','inactive','on_leave')),
  document_aadhaar_url text,
  document_pan_url text,
  document_certificates jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 4. coach_sport_assignments
```sql
create table public.coach_sport_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  sport_id uuid not null references public.sports(id) on delete restrict,
  monthly_salary decimal(10,2) not null check (monthly_salary > 0),
  -- ^↑ Salary for THIS assignment only. Total pay = SUM of all assignments.
  -- e.g., Community A: ₹10,000 + Community B: ₹8,000 = ₹18,000 total
  created_at timestamptz not null default now(),
  unique (coach_id, sport_id)
);
```

### 5. paid_holidays
```sql
create table public.paid_holidays (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  date date not null,
  holiday_name text,
  created_at timestamptz not null default now(),
  unique (community_id, date)
);
```

### 6. monthly_attendance
```sql
create table public.monthly_attendance (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete restrict,
  sport_id uuid not null references public.sports(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2026),
  attendance_data jsonb,                -- stores ONLY exceptions {"5": "A", "20": "SUB"}
  total_working_days integer not null check (total_working_days > 0),
  days_present integer,
  days_absent integer,
  days_substitute integer,
  paid_holidays integer,
  total_paid_days integer,
  calculated_salary decimal(10,2),
  is_finalized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, sport_id, month, year)
);
```

### 7. substitute_logs
```sql
create table public.substitute_logs (
  id uuid primary key default gen_random_uuid(),
  original_coach_id uuid not null references public.coaches(id) on delete restrict,
  substitute_coach_name text not null,
  substitute_phone text not null check (substitute_phone ~ '^\+91[6-9]\d{9}$'),
  date date not null,
  community_id uuid not null references public.communities(id) on delete restrict,
  sport_id uuid not null references public.sports(id) on delete restrict,
  payment_amount decimal(10,2) not null check (payment_amount > 0),
  is_paid boolean not null default false,
  payment_date date,
  created_at timestamptz not null default now()
);
```

---

## Updated_at Trigger (for all applicable tables)
```sql
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to: communities, coaches, monthly_attendance
create trigger set_updated_at
  before update on public.communities
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.coaches
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.monthly_attendance
  for each row execute function public.handle_updated_at();
```

---

## Performance Indexes
```sql
create index idx_sports_community on public.sports(community_id);
create index idx_assignments_coach on public.coach_sport_assignments(coach_id);
create index idx_assignments_sport on public.coach_sport_assignments(sport_id);
create index idx_attendance_coach on public.monthly_attendance(coach_id);
create index idx_attendance_month_year on public.monthly_attendance(month, year);
create index idx_attendance_community on public.monthly_attendance(community_id);
create index idx_paid_holidays_community_date on public.paid_holidays(community_id, date);
create index idx_substitute_logs_date on public.substitute_logs(date);
create index idx_substitute_logs_coach on public.substitute_logs(original_coach_id);
```

---

## Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
alter table public.communities enable row level security;
alter table public.sports enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_sport_assignments enable row level security;
alter table public.paid_holidays enable row level security;
alter table public.monthly_attendance enable row level security;
alter table public.substitute_logs enable row level security;

-- Grant all operations to authenticated users only
-- (Single admin setup — all authenticated users are admins)
create policy "admin_all" on public.communities
  for all to authenticated using (true) with check (true);

-- Repeat for all tables
create policy "admin_all" on public.sports
  for all to authenticated using (true) with check (true);

create policy "admin_all" on public.coaches
  for all to authenticated using (true) with check (true);

create policy "admin_all" on public.coach_sport_assignments
  for all to authenticated using (true) with check (true);

create policy "admin_all" on public.paid_holidays
  for all to authenticated using (true) with check (true);

create policy "admin_all" on public.monthly_attendance
  for all to authenticated using (true) with check (true);

create policy "admin_all" on public.substitute_logs
  for all to authenticated using (true) with check (true);
```

---

## Supabase Storage

```
Bucket name: coach-documents
Type: Private (NOT public)
File size limit: 5MB
Allowed MIME types: application/pdf, image/jpeg, image/png
```

Access via signed URLs only (generated server-side, time-limited).

---

## Success Criteria
- [ ] All 7 tables created without errors
- [ ] All foreign key constraints enforced (test: try to delete referenced record)
- [ ] Unique constraints working (test: insert duplicate records)
- [ ] RLS policies active (test: query without auth → denied)
- [ ] `coach-documents` bucket created and private
- [ ] Test CRUD on all tables with authenticated session
- [ ] `updated_at` auto-updates on `coaches`, `communities`, `monthly_attendance`
