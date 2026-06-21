-- ============================================================
-- Migration 006 : Statut membre cotisant + règles avancées
-- À coller dans Supabase SQL Editor
-- ============================================================

-- ─── STATUT MEMBRE COTISANT (indépendant du role admin/member/public) ───
create type membership_status as enum ('none', 'pending', 'active', 'expired');

alter table profiles
  add column if not exists membership_status membership_status not null default 'none',
  add column if not exists membership_valid_until date,
  add column if not exists membership_requested_at timestamptz,
  add column if not exists membership_validated_at timestamptz,
  add column if not exists membership_validated_by uuid references profiles(id);

-- ─── EXTENSION access_rules : qui peut aussi cibler le membre cotisant actif ───
-- On élargit access_who pour inclure une cible 'cotisant' sans casser l'existant
alter type access_who add value if not exists 'cotisant';

-- ─── EXTENSION access_rules : nouvelles contraintes cumulables sur une même règle ───
-- max_concurrent_bookings : nombre max de réservations actives simultanées en tant qu'owner (null = pas de limite imposée par cette règle)
-- booking_window_days : la règle ne s'applique qui si le créneau est dans X jours (null = pas de fenêtre)
alter table access_rules
  add column if not exists max_concurrent_bookings int check (max_concurrent_bookings is null or max_concurrent_bookings >= 0),
  add column if not exists booking_window_days int check (booking_window_days is null or booking_window_days >= 0);

comment on column access_rules.max_concurrent_bookings is
  'Nombre max de réservations actives (pending/confirmed) en tant quowner pour le profil ciblé par who. NULL = pas de contrainte par cette règle.';
comment on column access_rules.booking_window_days is
  'Le créneau ne peut être réservé que sil est dans les X jours à venir, pour le profil ciblé par who. NULL = pas de contrainte par cette règle.';

-- Helper : calcule dynamiquement si un profil est cotisant actif (date non expirée)
create or replace function is_active_member(p_profile_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where id = p_profile_id
    and membership_status = 'active'
    and (membership_valid_until is null or membership_valid_until >= current_date)
  )
$$;

-- Index pour les requêtes de validation membership côté admin
create index if not exists idx_profiles_membership_status on profiles(membership_status);
