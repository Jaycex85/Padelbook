-- ============================================================
-- Migration 002 : champs profil — genre, classement
-- (phone existe déjà dans profiles)
-- À coller dans Supabase SQL Editor
-- ============================================================

alter table profiles
  add column if not exists gender text check (gender in ('M', 'F', 'other')),
  add column if not exists ranking text;

-- ranking est libre (texte) : ex. "P500", "4e série", "classé 250", etc.
-- L'admin peut le remplir manuellement ou le joueur à l'inscription
