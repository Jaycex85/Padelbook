-- ============================================================
-- Migration 004 : Chat (matchs/events) + Fil d'actualité club
-- À coller dans Supabase SQL Editor
-- ============================================================

-- ─── CHAT sur bookings (matchs) et club_events ───
-- Un message appartient SOIT à un booking SOIT à un club_event, jamais les deux
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id) on delete cascade,
  event_id uuid references club_events(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (
    (booking_id is not null and event_id is null) or
    (booking_id is null and event_id is not null)
  )
);

create index on chat_messages(booking_id, created_at);
create index on chat_messages(event_id, created_at);

alter table chat_messages enable row level security;

-- Lecture : tout le monde connecté peut lire (comme convenu)
create policy "chat_messages_read" on chat_messages for select
  using (auth.uid() is not null);

-- Écriture : uniquement les joueurs inscrits au booking/event concerné, ou l'admin
create policy "chat_messages_insert_booking" on chat_messages for insert
  with check (
    sender_id = auth.uid() and (
      is_admin() or
      (booking_id is not null and exists (
        select 1 from booking_players bp where bp.booking_id = chat_messages.booking_id and bp.player_id = auth.uid()
      )) or
      (event_id is not null and exists (
        select 1 from event_registrations er where er.event_id = chat_messages.event_id and er.player_id = auth.uid() and er.status != 'cancelled'
      ))
    )
  );

-- ─── FIL D'ACTUALITÉ DU CLUB ───
create table club_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references profiles(id),
  content text not null check (char_length(content) between 1 and 2000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table club_post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references club_posts(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index on club_posts(created_at desc);
create index on club_posts(pinned);
create index on club_post_comments(post_id, created_at);

create trigger trg_club_posts_updated_at before update on club_posts
  for each row execute function set_updated_at();

alter table club_posts enable row level security;
alter table club_post_comments enable row level security;

-- Postes : lecture publique, écriture admin uniquement
create policy "club_posts_read" on club_posts for select using (true);
create policy "club_posts_write" on club_posts for all using (is_admin());

-- Commentaires : lecture publique, écriture par tout utilisateur connecté
create policy "club_post_comments_read" on club_post_comments for select using (true);
create policy "club_post_comments_insert" on club_post_comments for insert
  with check (author_id = auth.uid());
create policy "club_post_comments_delete_own" on club_post_comments for delete
  using (author_id = auth.uid() or is_admin());
