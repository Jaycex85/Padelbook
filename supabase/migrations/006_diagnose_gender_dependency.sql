-- ============================================================
-- Migration 006 : diagnostic des dépendances sur gender / gender_type
-- Exécute CHAQUE requête separement et montre-moi les résultats
-- ============================================================

-- A. Y a-t-il un CHECK constraint sur la colonne gender ?
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'profiles'::regclass
  and pg_get_constraintdef(oid) ilike '%gender%';

-- B. Y a-t-il un index sur gender ?
select indexname, indexdef
from pg_indexes
where tablename = 'profiles' and indexdef ilike '%gender%';

-- C. Y a-t-il une policy RLS qui référence gender ?
select policyname, qual, with_check
from pg_policies
where tablename = 'profiles' and (qual ilike '%gender%' or with_check ilike '%gender%');

-- D. Existe-t-il déjà un type gender_type encore référencé ailleurs (vue, fonction) ?
select t.typname, d.deptype, c.relname, c.relkind
from pg_type t
join pg_depend d on d.refobjid = t.oid
join pg_class c on c.oid = d.objid
where t.typname = 'gender_type';
