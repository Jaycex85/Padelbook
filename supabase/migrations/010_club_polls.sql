-- ============================================================
-- Migration 010 : Sondages dans le fil d'actualité du club
-- À coller dans Supabase SQL Editor
-- ============================================================

alter table club_posts add column post_type text not null default 'text' check (post_type in ('text', 'poll'));

create table club_poll_options (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references club_posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  sort_order int not null default 0
);

create table club_poll_votes (
  id uuid primary key default uuid_generate_v4(),
  option_id uuid not null references club_poll_options(id) on delete cascade,
  voter_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (option_id, voter_id)
);

create index on club_poll_options(post_id, sort_order);
create index on club_poll_votes(option_id);
create index on club_poll_votes(voter_id);

alter table club_poll_options enable row level security;
alter table club_poll_votes enable row level security;

-- Options : lecture publique, écriture admin uniquement (créées en même temps que le post)
create policy "club_poll_options_read" on club_poll_options for select using (true);
create policy "club_poll_options_write" on club_poll_options for all using (is_admin());

-- Votes : lecture publique (pour calculer les totaux), chacun vote pour soi-même,
-- chacun peut retirer son propre vote (choix multiple = cocher/décocher librement)
create policy "club_poll_votes_read" on club_poll_votes for select using (true);
create policy "club_poll_votes_insert" on club_poll_votes for insert
  with check (voter_id = auth.uid());
create policy "club_poll_votes_delete_own" on club_poll_votes for delete
  using (voter_id = auth.uid());
