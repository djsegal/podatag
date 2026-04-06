-- profiles: display name + city for each auth user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- availability: one row per user per slot
-- slot_key format: "2026-04-07|18:00"
create table public.availability (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  format text not null,
  slot_key text not null,
  created_at timestamptz default now(),

  unique(user_id, city, format, slot_key)
);

-- indexes for fast lookups
create index idx_availability_scope on public.availability(city, format);
create index idx_availability_user on public.availability(user_id, city, format);

-- RLS: everyone can read, only own rows can be written
alter table public.profiles enable row level security;
alter table public.availability enable row level security;

-- profiles: anyone can read, users can insert/update their own
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- availability: anyone can read, users can manage their own
create policy "avail_select" on public.availability for select using (true);
create policy "avail_insert" on public.availability for insert with check (auth.uid() = user_id);
create policy "avail_delete" on public.availability for delete using (auth.uid() = user_id);

ALTER TABLE public.availability
  ADD CONSTRAINT availability_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
