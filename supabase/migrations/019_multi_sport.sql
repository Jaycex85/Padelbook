-- ============================================================
-- Migration 019 : Support multi-sport (padel + badminton)
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Le sport est porté uniquement par les terrains (courts).
-- Toutes les tables liées à un terrain (bookings, blocks, price_slots
-- si un jour spécifiques à un court, club_events via club_event_courts,
-- club_event_series via club_event_series_courts) héritent du sport
-- via le court_id — pas de duplication de colonne ailleurs.
--
-- Les tables transverses (profiles, wallet_transactions, payments)
-- restent volontairement NON sportées : un wallet reste un wallet
-- quel que soit le sport pratiqué.

create type sport_type as enum ('padel', 'badminton');

alter table courts
  add column sport sport_type not null default 'padel';

-- Le default 'padel' backfill automatiquement les terrains existants.
-- On retire le default après coup pour forcer un choix explicite
-- à la création de tout nouveau terrain.
alter table courts
  alter column sport drop default;

create index on courts(sport);

-- club_events / club_event_series : sport nullable = annonce/événement
-- commun aux deux sports (ex: soirée club, AG). Sport renseigné =
-- visible uniquement pour ce sport.
alter table club_events
  add column if not exists sport sport_type;

alter table club_event_series
  add column if not exists sport sport_type;

-- club_posts (fil du club) : même logique, nullable = visible pour tous.
alter table club_posts
  add column if not exists sport sport_type;

create index on club_events(sport);
create index on club_event_series(sport);
create index on club_posts(sport);
