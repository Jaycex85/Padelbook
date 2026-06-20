-- ============================================================
-- Migration 005 : fix colonne gender (text -> enum gender_type)
-- À coller dans Supabase SQL Editor
-- ============================================================

-- Recrée le type proprement (si jamais corrompu/partiel)
drop type if exists gender_type cascade;
create type gender_type as enum ('male', 'female');

-- Convertit la colonne text existante vers le bon type enum
alter table profiles
  alter column gender type gender_type
  using (
    case
      when gender in ('male', 'female') then gender::gender_type
      else null
    end
  );

-- Vérification finale — exécute et vérifie le résultat
select column_name, data_type, udt_name
from information_schema.columns
where table_name = 'profiles' and column_name in ('gender', 'afp_ranking');
