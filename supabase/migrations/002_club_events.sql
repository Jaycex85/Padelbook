-- ============================================================
-- Migration 002 : Club Events
-- À coller dans Supabase SQL Editor
-- ============================================================

create type event_registration_status as enum ('pending', 'confirmed', 'cancelled');

-- Événements du club
create table club_events (
  id uuid primary key default uuid_generate_v4(),
  label text not null,                          -- partie libre du libellé (ex: "Tournoi de printemps")
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_players int not null default 8,
  price_per_player numeric(10,2) not null default 0,
  description text,
  who access_who not null default 'all',         -- réutilise l'enum existant (all/member/public)
  cancellation_deadline_hours int not null default 24,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Liaison N-N événement <-> terrains concernés
create table club_event_courts (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references club_events(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  block_id uuid references blocks(id) on delete set null,  -- le block généré automatiquement sur ce terrain
  unique(event_id, court_id)
);

-- Inscriptions des joueurs
create table event_registrations (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references club_events(id) on delete cascade,
  player_id uuid references profiles(id),
  guest_name text,
  guest_email text,
  status event_registration_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  price_paid numeric(10,2),
  payconic_ref text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (player_id is not null or (guest_name is not null and guest_email is not null))
);

-- Index
create index on club_events(starts_at);
create index on club_events(status);
create index on club_event_courts(event_id);
create index on club_event_courts(court_id);
create index on event_registrations(event_id);
create index on event_registrations(player_id);

-- Trigger updated_at
create trigger trg_club_events_updated_at before update on club_events
  for each row execute function set_updated_at();

-- RLS
alter table club_events enable row level security;
alter table club_event_courts enable row level security;
alter table event_registrations enable row level security;

create policy "club_events_read" on club_events for select using (true);
create policy "club_events_write" on club_events for all using (is_admin());

create policy "club_event_courts_read" on club_event_courts for select using (true);
create policy "club_event_courts_write" on club_event_courts for all using (is_admin());

create policy "event_registrations_read" on event_registrations for select
  using (player_id = auth.uid() or is_admin());
create policy "event_registrations_insert" on event_registrations for insert
  with check (player_id = auth.uid() or is_admin());
create policy "event_registrations_update_own" on event_registrations for update
  using (player_id = auth.uid() or is_admin());
