-- ============================================================
-- Migration 004 : diagnostic + fix afp_ranking
-- À coller dans Supabase SQL Editor
-- ============================================================

-- ÉTAPE 1 : Diagnostic — exécute d'abord cette requête seule et regarde le résultat
select column_name, data_type, udt_name
from information_schema.columns
where table_name = 'profiles' and column_name in ('gender', 'afp_ranking');

-- ÉTAPE 2 : si udt_name pour afp_ranking n'est PAS "afp_ranking" (le type enum),
-- ou si la colonne n'existe pas / est en text, exécute ce qui suit :

-- Renomme le type pour lever toute ambiguïté avec le nom de colonne
alter type afp_ranking rename to afp_ranking_enum;

-- Recrée proprement la colonne avec le type renommé
alter table profiles
  drop column if exists afp_ranking;

alter table profiles
  add column afp_ranking afp_ranking_enum;

-- Vérification finale
select column_name, data_type, udt_name
from information_schema.columns
where table_name = 'profiles' and column_name = 'afp_ranking';
