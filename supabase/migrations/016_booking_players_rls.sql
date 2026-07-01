-- ============================================================
-- Migration 016 : policies INSERT + SELECT sur booking_players
-- Sans ça, les invitations (membres et guests) sont bloquées
-- silencieusement par RLS.
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Lecture : le owner du booking, les joueurs assignés, et l'admin
create policy "booking_players_select"
  on booking_players for select
  using (
    is_admin()
    or player_id = auth.uid()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
  );

-- Insert : le owner du booking peut ajouter des joueurs/guests,
-- un joueur peut s'inscrire lui-même (open matches), admin peut tout faire.
create policy "booking_players_insert"
  on booking_players for insert
  with check (
    is_admin()
    -- Owner du booking peut inviter quelqu'un (guest ou membre)
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    -- Un membre peut s'inscrire lui-même sur un match ouvert
    or (player_id = auth.uid() and exists (
      select 1 from bookings b where b.id = booking_id and b.is_public = true and b.status in ('pending','confirmed')
    ))
  );

-- Update : owner ou admin peuvent modifier (ex: assigner une équipe, marquer payé)
create policy "booking_players_update"
  on booking_players for update
  using (
    is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    or player_id = auth.uid()
  );
