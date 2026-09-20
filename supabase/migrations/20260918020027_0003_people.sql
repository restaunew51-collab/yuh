/*
# People: Applicants, Students, Teachers

## Summary
Creates the three people tables that link to institutions and (for students/teachers) to auth profiles.

## New Tables

### applicants
Candidates who have not yet been admitted. May or may not have an auth account yet.
- `id` (uuid PK)
- `institution_id` (uuid FK → institutions, NOT NULL)
- `first_name`, `last_name` (text, NOT NULL)
- `email` (text, nullable)
- `phone` (text, nullable)
- `status` (text, CHECK: new / reviewing / admitted / rejected / waitlisted, default 'new')
- `application_date` (date, NOT NULL, default current_date)
- `created_at` / `updated_at`

### students
Admitted students. Linked to an auth profile and optionally to the originating applicant.
- `id` (uuid PK)
- `profile_id` (uuid FK → profiles, nullable — nullable until account is created)
- `institution_id` (uuid FK → institutions, NOT NULL)
- `applicant_id` (uuid FK → applicants, nullable, ON DELETE SET NULL)
- `student_number` (text, NOT NULL, UNIQUE per institution)
- `admission_date` (date, NOT NULL, default current_date)
- `status` (text, CHECK: active / graduated / withdrawn / suspended / expelled, default 'active')
- `created_at` / `updated_at`

### teachers
Formateurs linked to auth profiles.
- `id` (uuid PK)
- `profile_id` (uuid FK → profiles, nullable)
- `institution_id` (uuid FK → institutions, NOT NULL)
- `teacher_number` (text, NOT NULL)
- `specialization` (text, nullable)
- `status` (text, CHECK: active / inactive / on_leave, default 'active')
- `created_at` / `updated_at`

## Constraints
- UNIQUE (institution_id, student_number) — student numbers are unique per institution
- UNIQUE (institution_id, teacher_number) — teacher numbers are unique per institution
- CHECK on status fields to prevent invalid values
- Inter-institution integrity is enforced: a student's institution_id must match
  the institution_id of any enrollment, class, or payment it references (enforced via FK + app logic)

## Security
- RLS enabled on all 3 tables.
- Policies in migration 0010.
*/

-- ============================================================
-- 1. applicants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.applicants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text,
  phone           text,
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'reviewing', 'admitted', 'rejected', 'waitlisted')),
  application_date date NOT NULL DEFAULT current_date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applicants_institution ON public.applicants (institution_id);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON public.applicants (status);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON public.applicants (email);

-- ============================================================
-- 2. students
-- ============================================================
CREATE TABLE IF NOT EXISTS public.students (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  applicant_id    uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  student_number  text NOT NULL,
  admission_date  date NOT NULL DEFAULT current_date,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'graduated', 'withdrawn', 'suspended', 'expelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT students_unique_number UNIQUE (institution_id, student_number)
);

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_students_institution ON public.students (institution_id);
CREATE INDEX IF NOT EXISTS idx_students_profile ON public.students (profile_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);

-- ============================================================
-- 3. teachers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teachers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  teacher_number  text NOT NULL,
  specialization  text,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teachers_unique_number UNIQUE (institution_id, teacher_number)
);

CREATE TRIGGER trg_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_teachers_institution ON public.teachers (institution_id);
CREATE INDEX IF NOT EXISTS idx_teachers_profile ON public.teachers (profile_id);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers (status);

-- ============================================================
-- 4. Enable RLS
-- ============================================================
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
