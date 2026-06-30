-- ============================================================
-- Migration 012 : Historique des suppressions (audit) + fix FK
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Journal générique de suppression : conserve un snapshot complet
-- de l'élément supprimé, qui l'a supprimé et quand.
create table deletion_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null, -- 'booking' | 'event' | 'event_series' | 'block'
  entity_id uuid not null,
  label text not null, -- résumé lisible (ex: "Terrain 1 - 12/06/2026 19h")
  snapshot jsonb not null,
  deleted_by uuid references profiles(id),
  deleted_at timestamptz not null default now()
);

create index on deletion_log(entity_type, deleted_at desc);

alter table deletion_log enable row level security;

create policy "deletion_log_read" on deletion_log for select using (is_admin());
create policy "deletion_log_insert" on deletion_log for insert with check (is_admin());

-- ------------------------------------------------------------
-- Fix du conflit 409 à la suppression d'un booking :
-- wallet_transactions.booking_id n'autorisait pas la suppression
-- du booking parent (pas de ON DELETE). On passe à SET NULL pour
-- garder la trace financière même si le booking est supprimé.
-- Recherche générique du nom de la contrainte (peu importe comment
-- elle a été nommée à la création du schéma).
-- ------------------------------------------------------------
do $$
declare
  conname text;
begin
  select tc.constraint_name into conname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'wallet_transactions'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'booking_id'
  limit 1;

  if conname is not null then
    execute format('alter table wallet_transactions drop constraint %I', conname);
  end if;

  alter table wallet_transactions
    add constraint wallet_transactions_booking_id_fkey
    foreign key (booking_id) references bookings(id) on delete set null;
end $$;
