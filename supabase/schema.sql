-- Run once in the Supabase SQL editor. Creates a NEW table; it does not touch existing tables.
create table if not exists public.project_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text check (full_name is null or char_length(full_name) <= 100),
  contact_email text not null check (char_length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  service text not null check (char_length(service) between 1 and 80),
  project_type text not null check (char_length(project_type) between 1 and 80),
  requirements text not null check (char_length(requirements) between 20 and 2000),
  budget_range text not null check (char_length(budget_range) between 1 and 40),
  deadline date,
  status text not null default 'new' check (status in ('new','in progress','review','completed')),
  admin_notes text
);

alter table public.project_enquiries enable row level security;

-- The public site may INSERT only. It can never read, update or delete rows.
revoke all on public.project_enquiries from anon, authenticated;
grant insert (full_name, contact_email, service, project_type, requirements, budget_range, deadline) on public.project_enquiries to anon;

drop policy if exists "anon can insert enquiries" on public.project_enquiries;
create policy "anon can insert enquiries" on public.project_enquiries
  for insert to anon with check (status = 'new' and admin_notes is null);
