/*
# Notifications and Settings

## Summary
Creates the notifications table (in-app) and the settings table (key-value per institution).
Also seeds the default `current_academic_year` setting.

## New Tables

### notifications
In-app notifications for users. Each notification targets a specific profile.
- `id` (uuid PK)
- `profile_id` (uuid FK → profiles, ON DELETE CASCADE)
- `institution_id` (uuid FK → institutions)
- `title` (text), `message` (text)
- `type` (text: enrollment/class_transfer/payment/grade/validation/certificate/admin)
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

### settings
Key-value settings scoped per institution.
- `id` (uuid PK)
- `institution_id` (uuid FK → institutions)
- `key` (text), `value` (text)
- `created_at` / `updated_at`
- UNIQUE (institution_id, key)

## Seeded Data
- No settings seeded here — the seed migration (0011) will insert `current_academic_year`
  after the test institution is created.

## Security
- RLS enabled on both tables.
- Policies in migration 0010.
*/

-- ============================================================
-- 1. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  title           text NOT NULL,
  message         text,
  type            text NOT NULL DEFAULT 'admin'
                  CHECK (type IN (
                    'enrollment', 'class_transfer', 'payment', 'grade',
                    'validation', 'certificate', 'admin'
                  )),
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications (profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_institution ON public.notifications (institution_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (type);

-- ============================================================
-- 2. settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  key             text NOT NULL,
  value           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_unique_key UNIQUE (institution_id, key)
);

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_settings_institution ON public.settings (institution_id);

-- ============================================================
-- 3. Enable RLS
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
