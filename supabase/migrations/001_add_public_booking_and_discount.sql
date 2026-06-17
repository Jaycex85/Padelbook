-- ============================================================
-- Migration 001 : match public + remise membre
-- À coller dans Supabase SQL Editor
-- ============================================================

-- 1. Match public/privé sur bookings
alter table bookings
  add column if not exists is_public boolean not null default false,
  add column if not exists max_players int not null default 4;

-- 2. Remise par membre sur profiles
alter table profiles
  add column if not exists discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100);

-- 3. Prix effectif payé par le joueur (après remise) sur booking_players
alter table booking_players
  add column if not exists base_price numeric(10,2),
  add column if not exists discount_percent numeric(5,2) not null default 0,
  add column if not exists effective_price numeric(10,2);

-- 4. Index pour les matchs publics ouverts
create index if not exists idx_bookings_public
  on bookings(is_public, status)
  where is_public = true;

-- Notes :
-- base_price      = price_per_player du booking (sans remise)
-- discount_percent = snapshot de la remise au moment de la réservation
-- effective_price  = base_price * (1 - discount_percent / 100)
-- Le club encaisse effective_price, la diff est sa charge
