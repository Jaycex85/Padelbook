-- ============================================================
-- Migration 014 : traçabilité des ajustements manuels de wallet
-- À coller dans Supabase SQL Editor
-- ============================================================

alter table wallet_transactions add column if not exists created_by uuid references profiles(id);
