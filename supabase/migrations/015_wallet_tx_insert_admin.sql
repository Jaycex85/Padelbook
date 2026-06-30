-- ============================================================
-- Migration 015 : autoriser l'admin à insérer des wallet_transactions
-- pour n'importe quel membre (ajustements manuels)
-- À coller dans Supabase SQL Editor
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'wallet_transactions' and policyname = 'wallet_transactions_insert_admin'
  ) then
    create policy "wallet_transactions_insert_admin" on wallet_transactions
      for insert with check (is_admin());
  end if;
end $$;
