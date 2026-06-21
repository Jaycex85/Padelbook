-- ============================================================
-- Migration 005 : Fix accès chat — plus de lecture publique
-- Accès (lecture ET écriture) = inscrit OU (booking/event public + pas encore inscrit)
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Supprimer les anciennes policies trop permissives
drop policy if exists "chat_messages_read" on chat_messages;
drop policy if exists "chat_messages_insert_booking" on chat_messages;

-- Fonction helper : un user a-t-il accès au chat d'un booking ?
-- (inscrit comme joueur OU le booking est public et l'utilisateur est connecté)
create or replace function can_access_booking_chat(p_booking_id uuid)
returns boolean language sql security definer as $$
  select
    is_admin()
    or exists (
      select 1 from booking_players bp
      where bp.booking_id = p_booking_id and bp.player_id = auth.uid()
    )
    or exists (
      select 1 from bookings b
      where b.id = p_booking_id and b.is_public = true
    )
$$;

-- Fonction helper : un user a-t-il accès au chat d'un club_event ?
-- (inscrit comme participant OU l'event est accessible à son rôle via who)
create or replace function can_access_event_chat(p_event_id uuid)
returns boolean language sql security definer as $$
  select
    is_admin()
    or exists (
      select 1 from event_registrations er
      where er.event_id = p_event_id and er.player_id = auth.uid() and er.status != 'cancelled'
    )
    or exists (
      select 1 from club_events ce, profiles p
      where ce.id = p_event_id and p.id = auth.uid()
      and (
        ce.who = 'all'
        or (ce.who = 'member' and p.role in ('member','admin'))
        or (ce.who = 'public' and p.role = 'public')
      )
    )
$$;

-- Lecture : accès si on peut accéder au booking/event concerné
create policy "chat_messages_read" on chat_messages for select
  using (
    (booking_id is not null and can_access_booking_chat(booking_id))
    or (event_id is not null and can_access_event_chat(event_id))
  );

-- Écriture : même règle que la lecture (accès = droit d'écrire), + on ne peut écrire qu'en son propre nom
create policy "chat_messages_insert" on chat_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      (booking_id is not null and can_access_booking_chat(booking_id))
      or (event_id is not null and can_access_event_chat(event_id))
    )
  );
