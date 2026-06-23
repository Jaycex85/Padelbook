-- ============================================================
-- Migration 007 : Tranches tarifaires dynamiques
-- À coller dans Supabase SQL Editor
-- ============================================================

create table price_slots (
  id uuid primary key default uuid_generate_v4(),
  label text not null,                        -- ex: "Heures creuses semaine"
  time_from time not null,
  time_to time not null,
  days_of_week int[] not null,                -- 0=Lun..6=Dim ; [0,1,2,3,4] = semaine
  price numeric(10,2) not null,               -- prix global pour cette tranche
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time_to > time_from),
  check (price >= 0)
);

-- Un créneau de début appartient à une tranche si :
--   time_from <= slot_start < time_to
--   ET day_of_week est dans days_of_week
-- Si aucune tranche ne matche → fallback sur price_per_slot du terrain

create index on price_slots(is_active);

create trigger trg_price_slots_updated_at before update on price_slots
  for each row execute function set_updated_at();

alter table price_slots enable row level security;

create policy "price_slots_read" on price_slots for select using (true);
create policy "price_slots_write" on price_slots for all using (is_admin());
