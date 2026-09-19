-- ============================================================
-- Migration 022 : Intégration Mollie (remplace le stub PayConic)
-- Centralise TOUS les paiements carte (réservations, events, adhésions,
-- recharges wallet) dans la table payments, avec assez de contexte pour
-- que le webhook Mollie puisse traiter chaque cas sans dépendre du client.
-- Idempotent. À coller dans Supabase SQL Editor.
-- ============================================================

alter table payments add column if not exists category text; -- 'booking' | 'event' | 'membership' | 'wallet_topup'
alter table payments add column if not exists event_registration_id uuid references event_registrations(id) on delete set null;
alter table payments add column if not exists membership_request_id uuid references membership_requests(id) on delete set null;
alter table payments add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table payments add column if not exists settle_open_balance boolean not null default false;
alter table payments add column if not exists provider text not null default 'mollie';
alter table payments add column if not exists provider_payment_id text;
alter table payments add column if not exists sport sport_type;

create index if not exists payments_provider_payment_id_idx on payments(provider_payment_id);
create index if not exists payments_category_idx on payments(category);

-- Permet à un joueur de suivre l'état de SON paiement depuis /payment/return
-- (lecture seule ; les écritures passent uniquement par le webhook, en
-- service role, qui contourne RLS).
alter table payments enable row level security;
drop policy if exists "payments_read_own" on payments;
create policy "payments_read_own" on payments for select
  using (profile_id = auth.uid() or is_admin());
