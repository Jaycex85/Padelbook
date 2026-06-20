-- ============================================================
-- Migration 007 : fix définitif colonne gender
-- Cause trouvée : un CHECK constraint résiduel "profiles_gender_check"
-- attendait 'M'/'F'/'other' et bloquait le cast vers l'enum.
-- ============================================================

-- 1. Supprimer le check constraint obsolète
alter table profiles
  drop constraint if exists profiles_gender_check;

-- 2. Recréer le type proprement
drop type if exists gender_type cascade;
create type gender_type as enum ('male', 'female');

-- 3. Convertir la colonne — gère aussi d'anciennes valeurs 'M'/'F' si présentes
alter table profiles
  alter column gender type gender_type
  using (
    case
      when gender in ('male', 'M') then 'male'::gender_type
      when gender in ('female', 'F') then 'female'::gender_type
      else null
    end
  );

-- 4. Vérification finale
select column_name, data_type, udt_name
from information_schema.columns
where table_name = 'profiles' and column_name in ('gender', 'afp_ranking');
