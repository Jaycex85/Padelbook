-- ============================================================
-- Migration 011 : Scores de match (détaillé par set, tie-break) + stats perso
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Équipe du joueur dans le match (1 ou 2) — nécessaire pour calculer victoire/défaite par joueur
alter table booking_players add column if not exists team smallint check (team in (1, 2));

create table match_results (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  -- sets: [{ "team1": 6, "team2": 3 }, { "team1": 6, "team2": 4 }, { "team1": 10, "team2": 7, "tiebreak": true }]
  sets jsonb not null,
  winning_team smallint not null check (winning_team in (1, 2)),
  recorded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on match_results(booking_id);

alter table match_results enable row level security;

-- Lecture publique (stats visibles par tous les membres)
create policy "match_results_read" on match_results for select using (true);

-- Écriture : un joueur du match (présent dans booking_players de ce booking) ou l'admin
create policy "match_results_insert" on match_results for insert
  with check (
    is_admin() or exists (
      select 1 from booking_players bp
      where bp.booking_id = match_results.booking_id and bp.player_id = auth.uid()
    )
  );

create policy "match_results_update" on match_results for update
  using (
    is_admin() or exists (
      select 1 from booking_players bp
      where bp.booking_id = match_results.booking_id and bp.player_id = auth.uid()
    )
  );

create policy "match_results_delete" on match_results for delete using (is_admin());
