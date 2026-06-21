-- ============================================================
-- Migration 003 : Club Event Series (événements récurrents)
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Le "modèle" de série récurrente
create table club_event_series (
  id uuid primary key default uuid_generate_v4(),
  label text not null,                          -- partie libre du libellé (ex: "Open du vendredi")
  day_of_week int not null check (day_of_week between 0 and 6),  -- 0=Lun ... 6=Dim
  start_time time not null,
  end_time time not null,
  series_starts_on date not null,               -- première occurrence
  series_ends_on date not null,                 -- dernière occurrence
  max_players int not null default 8,
  price_per_player numeric(10,2) not null default 0,
  description text,
  who access_who not null default 'all',
  cancellation_deadline_hours int not null default 24,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (series_ends_on >= series_starts_on),
  check (end_time > start_time)
);

-- Terrains associés à la série (utilisés pour générer les occurrences)
create table club_event_series_courts (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid not null references club_event_series(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  unique(series_id, court_id)
);

-- club_events : lien optionnel vers la série d'origine
-- Chaque occurrence générée reste 100% indépendante après création
-- (annulation, modification, inscriptions propres à CETTE occurrence uniquement)
alter table club_events
  add column if not exists series_id uuid references club_event_series(id) on delete set null;

create index on club_events(series_id);
create index on club_event_series(status);

create trigger trg_club_event_series_updated_at before update on club_event_series
  for each row execute function set_updated_at();

-- RLS
alter table club_event_series enable row level security;
alter table club_event_series_courts enable row level security;

create policy "club_event_series_read" on club_event_series for select using (true);
create policy "club_event_series_write" on club_event_series for all using (is_admin());

create policy "club_event_series_courts_read" on club_event_series_courts for select using (true);
create policy "club_event_series_courts_write" on club_event_series_courts for all using (is_admin());
