-- ============================================================
-- Migration 018 : autoriser les guests dans booking_players
-- La contrainte initiale exige player_id NOT NULL, ce qui bloque
-- l'insertion d'invités sans compte (guest_name sans player_id).
-- On remplace par une contrainte CHECK : soit player_id soit guest_name
-- doit être défini (mais pas forcément les deux).
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Retirer la contrainte NOT NULL sur player_id
alter table booking_players alter column player_id drop not null;

-- Ajouter une contrainte CHECK : player_id OU guest_name obligatoire
alter table booking_players
  add constraint booking_players_player_or_guest
  check (player_id is not null or guest_name is not null);
