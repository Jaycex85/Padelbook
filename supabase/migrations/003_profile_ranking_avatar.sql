-- ============================================================
-- Migration 003 : classement AFP + genre + avatar storage
-- À coller dans Supabase SQL Editor
-- ============================================================

-- 1. Genre (conditionne le dropdown classement MD/WD)
do $$ begin
  create type gender_type as enum ('male', 'female');
exception when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists gender gender_type;

-- 2. Classement AFP (Belgique)
do $$ begin
  create type afp_ranking as enum (
    'MD50','MD100','MD200','MD300','MD400','MD500','MD700','MD1000',
    'WD50','WD100','WD200','WD300','WD400','WD500'
  );
exception when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists afp_ranking afp_ranking;

-- 3. Bucket Storage pour les avatars (public en lecture, upload authentifié)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policy : tout le monde peut voir les avatars
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Policy : un user authentifié peut uploader/modifier UNIQUEMENT son propre avatar
-- (convention de nommage : {user_id}/avatar.ext)
create policy "avatars_own_upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
