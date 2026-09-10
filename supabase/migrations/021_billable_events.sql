-- ============================================================
-- Migration 021 : Registre unifié des éléments facturables
-- (réservations, adhésions/licences, club events, invités) — avec sport,
-- pour permettre des stats fiables dans les rapports financiers.
-- Idempotent. À coller dans Supabase SQL Editor.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'billable_category') then
    create type billable_category as enum ('booking', 'membership', 'event', 'wallet_topup');
  end if;
end$$;

create table if not exists billable_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  category billable_category not null,
  sport sport_type, -- null = non applicable (ex: recharge wallet)
  amount numeric(10,2) not null,
  payment_method text not null, -- 'wallet' | 'card'
  description text,
  booking_id uuid references bookings(id) on delete set null,
  booking_player_id uuid references booking_players(id) on delete set null,
  membership_request_id uuid references membership_requests(id) on delete set null,
  event_registration_id uuid references event_registrations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists billable_events_created_idx on billable_events(created_at);
create index if not exists billable_events_sport_idx on billable_events(sport);
create index if not exists billable_events_category_idx on billable_events(category);

alter table billable_events enable row level security;

drop policy if exists "billable_events_read" on billable_events;
create policy "billable_events_read" on billable_events for select using (is_admin());
drop policy if exists "billable_events_insert" on billable_events;
create policy "billable_events_insert" on billable_events for insert with check (true);
