-- ============================================================
-- Migration 017 : colonnes manquantes sur booking_players
-- guest_name, guest_email, paid_at n'existaient pas → 400 Bad Request
-- à l'insert d'un invité sans compte.
-- À coller dans Supabase SQL Editor
-- ============================================================

alter table booking_players
  add column if not exists guest_name  text,
  add column if not exists guest_email text,
  add column if not exists paid_at     timestamptz;
