-- ============================================================
-- Migration 002 : modes de paiement combinables par terrain
-- À coller dans Supabase SQL Editor
-- ============================================================

-- 1. Nouvelle colonne array, on migre la donnée existante dedans
alter table courts
  add column if not exists payment_modes payment_mode[] not null default '{full}';

update courts
  set payment_modes = ARRAY[payment_mode]
  where payment_modes = '{full}'; -- migre la valeur existante pour chaque terrain

-- 2. Sur les bookings : le joueur choisit son mode au paiement
--    On garde payment_mode (mode choisi pour CETTE résa), mais il doit
--    être un des modes activés sur le terrain — vérifié côté appli.

-- 3. On NE supprime PAS l'ancienne colonne payment_mode tout de suite
--    (sécurité de rollback). À faire dans une migration ultérieure une
--    fois le nouveau système validé en prod :
--    alter table courts drop column payment_mode;
