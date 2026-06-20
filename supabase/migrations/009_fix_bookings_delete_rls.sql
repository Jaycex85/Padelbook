-- ============================================================
-- Migration 009 : fix suppression bookings bloquée par RLS
-- Cause confirmée : RLS activé sur bookings, AUCUNE policy DELETE
-- n'existait => Postgres/PostgREST filtre silencieusement (0 ligne
-- affectée, pas d'erreur HTTP).
-- ============================================================

-- Policy DELETE sur bookings : owner OU admin peut supprimer
create policy "bookings_delete"
  on bookings for delete
  using (owner_id = auth.uid() or is_admin());

-- Tables liées par booking_id : il leur faut aussi une policy DELETE
-- sinon le nettoyage en cascade depuis l'appli (payments, booking_players)
-- échouera silencieusement de la même façon.

create policy "booking_players_delete"
  on booking_players for delete
  using (
    is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
    or player_id = auth.uid()
  );

create policy "payments_delete"
  on payments for delete
  using (
    is_admin()
    or exists (select 1 from bookings b where b.id = booking_id and b.owner_id = auth.uid())
  );

create policy "wallet_transactions_delete"
  on wallet_transactions for delete
  using (is_admin());

create policy "notifications_delete"
  on notifications for delete
  using (is_admin());

create policy "webhook_events_delete"
  on webhook_events for delete
  using (is_admin());

-- Vérification : repasse la requête de la migration 008 partie B,
-- tu dois maintenant voir une ligne "bookings_delete" en plus.
select policyname, cmd from pg_policies where tablename = 'bookings';
