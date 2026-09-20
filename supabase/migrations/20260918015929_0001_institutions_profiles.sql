/*
# Institutions and Profiles — Foundation Tables

## Summary
Creates the foundational `institutions` and `profiles` tables, plus a reusable `updated_at` trigger function.

## New Tables

### institutions
Multi-establishment support. The app starts with one institution but the schema supports many.
- `id` (uuid PK)
- `name` (text, NOT NULL)
- `code` (text, UNIQUE, NOT NULL) — short identifier like "MAIN"
- `address` (text, nullable)
- `phone` (text, nullable)
- `email` (text, nullable)
- `logo_url` (text, nullable)
- `is_active` (boolean, default true)
- `created_at` / `updated_at` (timestamptz, auto-managed)

### profiles
Extends `auth.users` — one row per authenticated user. Never stores passwords.
- `id` (uuid PK, FK → auth.users ON DELETE CASCADE) — 1:1 with auth.users
- `institution_id` (uuid, FK → institutions, nullable for super_admin who may span institutions)
- `first_name` (text, NOT NULL)
- `last_name` (text, NOT NULL)
- `phone` (text, nullable)
- `avatar_url` (text, nullable)
- `is_active` (boolean, default true)
- `created_at` / `updated_at` (timestamptz, auto-managed)

## Utility Functions
- `set_updated_at()` — reusable trigger function that updates `updated_at` on row modification.
- `handle_new_user()` — trigger on `auth.users` INSERT that creates a matching `profiles` row automatically.

## Security
- RLS enabled on both tables.
- Policies will be defined in migration 0010_rls_policies.

## Notes
1. The `handle_new_user` trigger automatically creates a profile when a new auth.users row is inserted.
   The profile is created with empty name fields and must be completed by the user or an admin.
2. `institution_id` on profiles is nullable because a super_admin may need access across institutions.
3. A CHECK constraint ensures `code` is not empty on institutions.
*/

-- ============================================================
-- 1. UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. institutions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.institutions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL UNIQUE,
  address     text,
  phone       text,
  email       text,
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutions_code_not_empty CHECK (length(btrim(code)) > 0),
  CONSTRAINT institutions_name_not_empty CHECK (length(btrim(name)) > 0)
);

CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_institutions_is_active ON public.institutions (is_active);

-- ============================================================
-- 3. profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id  uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  first_name      text NOT NULL DEFAULT '',
  last_name       text NOT NULL DEFAULT '',
  phone           text,
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles (institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles (is_active);

-- ============================================================
-- 4. Auto-create profile on auth.users INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, '', '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. Enable RLS (policies come in migration 0010)
-- ============================================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
