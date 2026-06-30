-- ============================================================
-- Migration 013 : S'assurer que chaque membre peut lire ses
-- propres wallet_transactions (nécessaire pour l'historique wallet)
-- À coller dans Supabase SQL Editor
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'wallet_transactions' and policyname = 'wallet_transactions_read_own'
  ) then
    create policy "wallet_transactions_read_own" on wallet_transactions
      for select using (profile_id = auth.uid() or is_admin());
  end if;
end $$;
