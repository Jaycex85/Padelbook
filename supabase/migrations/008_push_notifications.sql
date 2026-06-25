-- ============================================================
-- Migration 008 : Push notifications Web natif
-- Version corrigée avec IF NOT EXISTS
-- ============================================================

-- Subscriptions push (recrée seulement si absente)
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_subs_profile on push_subscriptions(profile_id);

-- Préférences de notification par utilisateur
create table if not exists notification_preferences (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  booking_confirmed boolean not null default true,
  booking_reminder boolean not null default true,
  chat_message boolean not null default true,
  club_announcement boolean not null default true,
  spot_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_notif_prefs_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

-- RLS
alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;

-- Policies (drop + recreate pour éviter les conflits si déjà existantes)
drop policy if exists "push_subs_own" on push_subscriptions;
drop policy if exists "push_subs_admin" on push_subscriptions;
drop policy if exists "notif_prefs_own" on notification_preferences;

create policy "push_subs_own" on push_subscriptions for all
  using (profile_id = auth.uid());
create policy "push_subs_admin" on push_subscriptions for select
  using (is_admin());
create policy "notif_prefs_own" on notification_preferences for all
  using (profile_id = auth.uid());
