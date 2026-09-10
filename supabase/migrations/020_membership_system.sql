-- ============================================================
-- Migration 020 : Refonte du flux Membres — adhésions/licences par sport
-- Idempotent (if not exists partout).
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Types d'adhésion configurables par l'admin (tarifs, libellés), par sport.
-- Seed : padel/license (AFP), padel/interclubs, padel/interequipes, badminton/license.
create table if not exists membership_types (
  id uuid primary key default gen_random_uuid(),
  sport sport_type not null,
  key text not null,
  label text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(sport, key)
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_request_status') then
    create type membership_request_status as enum ('pending', 'active', 'rejected', 'expired');
  end if;
end$$;

-- Une demande d'adhésion/licence par joueur et par type. Le joueur peut avoir
-- plusieurs demandes actives en même temps (ex: licence AFP + InterClubs).
create table if not exists membership_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  membership_type_id uuid not null references membership_types(id),
  status membership_request_status not null default 'pending',
  price numeric(10,2), -- snapshot du tarif au moment de la demande
  payment_status text not null default 'pending', -- 'pending' | 'paid'
  requested_at timestamptz not null default now(),
  valid_from date,
  valid_until date,
  validated_at timestamptz,
  validated_by uuid references profiles(id),
  payconic_ref text,
  created_at timestamptz not null default now()
);

create index if not exists membership_requests_profile_idx on membership_requests(profile_id);
create index if not exists membership_requests_status_idx on membership_requests(status);
create index if not exists membership_types_sport_idx on membership_types(sport);

alter table membership_types enable row level security;
alter table membership_requests enable row level security;

drop policy if exists "membership_types_read" on membership_types;
create policy "membership_types_read" on membership_types for select using (true);
drop policy if exists "membership_types_write" on membership_types;
create policy "membership_types_write" on membership_types for all using (is_admin());

drop policy if exists "membership_requests_read" on membership_requests;
create policy "membership_requests_read" on membership_requests for select
  using (profile_id = auth.uid() or is_admin());
drop policy if exists "membership_requests_insert" on membership_requests;
create policy "membership_requests_insert" on membership_requests for insert
  with check (profile_id = auth.uid() or is_admin());
drop policy if exists "membership_requests_update" on membership_requests;
create policy "membership_requests_update" on membership_requests for update
  using (profile_id = auth.uid() or is_admin());

-- Seed des types d'adhésion (ignoré si déjà présents grâce à la contrainte unique)
insert into membership_types (sport, key, label, price, sort_order)
values
  ('padel', 'license', 'Licence AFP', 0, 1),
  ('padel', 'interclubs', 'Statut compétiteur InterClubs', 0, 2),
  ('padel', 'interequipes', 'Statut compétiteur InterEquipes', 0, 3),
  ('badminton', 'license', 'Licence badminton', 0, 1)
on conflict (sport, key) do nothing;
