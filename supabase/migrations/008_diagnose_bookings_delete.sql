-- ============================================================
-- Migration 008 : diagnostic suppression bookings impossible
-- Exécute chaque requête séparément
-- ============================================================

-- A. RLS est-il activé sur bookings ?
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'bookings';

-- B. Quelles policies existent sur bookings ?
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'bookings';

-- C. Y a-t-il une FK d'une autre table qui pointe encore vers bookings
--    et qui pourrait bloquer silencieusement (peu probable sans erreur, mais on vérifie) ?
select
  tc.table_name as referencing_table,
  kcu.column_name,
  ccu.table_name as referenced_table
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'bookings';
