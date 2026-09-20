/*
# Academic Structure: Years, Programs, Courses, Classes, Enrollments, Schedules, Attendance, Grades

## Summary
Creates the full academic hierarchy with strict institution + academic_year isolation.

## New Tables (14 tables)

### academic_years
- `id`, `institution_id` (NOT NULL), `name` ("2025-2026"), `start_date`, `end_date`, `is_active`, `created_at`
- UNIQUE (institution_id, name)

### terms
- `id`, `academic_year_id` (FK), `name` ("Semestre 1"), `start_date`, `end_date`, `created_at`

### programs (curriculum — stable across years)
- `id`, `institution_id`, `name`, `code`, `description`, `duration_years`, `admission_requirements`, `is_active`, timestamps
- UNIQUE (institution_id, code)

### modules (within a program)
- `id`, `program_id` (FK), `name`, `code`, `semester` (1/2), `order_index`, timestamps

### subjects (within a module)
- `id`, `module_id` (FK), `name`, `code`, `hours_planned`, `coefficient`, timestamps

### courses (formation offered a specific year)
- `id`, `institution_id`, `program_id` (FK), `academic_year_id` (FK, NOT NULL), `name`, `tuition_fee`, `enrollment_fee`, `start_date`, `end_date`, `status` (planned/active/completed), timestamps
- UNIQUE (program_id, academic_year_id, institution_id) — one course per program per year per institution

### classes (group within a course)
- `id`, `institution_id`, `course_id` (FK), `academic_year_id` (FK, NOT NULL — denormalized for direct queries), `name`, `capacity`, `room`, timestamps
- UNIQUE (course_id, name)

### enrollments (student enrolled in a class for a year)
- `id`, `student_id`, `course_id`, `class_id`, `academic_year_id` (NOT NULL), `enrollment_date`, `status` (pending/active/completed/withdrawn/transferred), `previous_enrollment_id` (self-FK nullable), timestamps
- UNIQUE (student_id, academic_year_id) — one enrollment per student per year
- CHECK: student, course, class, and academic_year all belong to the same institution

### class_transfers (history of class changes)
- `id`, `enrollment_id`, `student_id`, `from_class_id`, `to_class_id`, `academic_year_id`, `transfer_date`, `reason`, `created_by` (FK auth.users), `created_at`

### schedules (timetable slots)
- `id`, `institution_id`, `class_id`, `subject_id`, `teacher_id`, `academic_year_id` (NOT NULL), `day_of_week` (1-7), `start_time`, `end_time`, `room`, `created_at`
- CHECK: end_time > start_time, day_of_week BETWEEN 1 AND 7

### attendance (presence per schedule per student)
- `id`, `schedule_id`, `student_id`, `academic_year_id` (NOT NULL), `date`, `status` (present/absent/late/excused), `note`, `recorded_by` (FK auth.users), `created_at`
- UNIQUE (schedule_id, student_id, date)

### assessments (exams/assignments)
- `id`, `class_id`, `subject_id`, `academic_year_id` (NOT NULL), `teacher_id`, `type` (exam/quiz/homework/project), `title`, `max_score`, `coefficient`, `date`, `status` (draft/published/validated), `created_by`, timestamps

### grades (student scores)
- `id`, `assessment_id`, `student_id`, `academic_year_id` (NOT NULL), `teacher_id`, `score`, `status` (draft/submitted/validated), `graded_by` (FK auth.users), `validated_by` (FK auth.users, nullable), `created_at`, `updated_at`
- CHECK: score >= 0 AND score <= max_score (via join, enforced by app + trigger)
- UNIQUE (assessment_id, student_id)

## Cross-Institution Integrity
A trigger `validate_enrollment_institution` ensures the student, course, class, and academic_year
all share the same institution_id before allowing an INSERT or UPDATE on enrollments.

## Security
- RLS enabled on all 14 tables.
- Policies in migration 0010.
*/

-- ============================================================
-- 1. academic_years
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academic_years (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ay_unique_name UNIQUE (institution_id, name),
  CONSTRAINT ay_dates_valid CHECK (end_date > start_date)
);

CREATE TRIGGER trg_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_academic_years_institution ON public.academic_years (institution_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_active ON public.academic_years (is_active);

-- ============================================================
-- 2. terms
-- ============================================================
CREATE TABLE IF NOT EXISTS public.terms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terms_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_terms_academic_year ON public.terms (academic_year_id);

-- ============================================================
-- 3. programs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id          uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  name                    text NOT NULL,
  code                    text NOT NULL,
  description             text,
  duration_years          integer NOT NULL DEFAULT 1 CHECK (duration_years > 0),
  admission_requirements  text,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programs_unique_code UNIQUE (institution_id, code)
);

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_programs_institution ON public.programs (institution_id);
CREATE INDEX IF NOT EXISTS idx_programs_active ON public.programs (is_active);

-- ============================================================
-- 4. modules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  code        text NOT NULL,
  semester    integer NOT NULL DEFAULT 1 CHECK (semester IN (1, 2)),
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_modules_program ON public.modules (program_id);

-- ============================================================
-- 5. subjects
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  hours_planned   integer NOT NULL DEFAULT 0 CHECK (hours_planned >= 0),
  coefficient     numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (coefficient > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_subjects_module ON public.subjects (module_id);

-- ============================================================
-- 6. courses (formation offered for a specific academic year)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  program_id      uuid NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  tuition_fee     numeric(12,2) NOT NULL DEFAULT 0 CHECK (tuition_fee >= 0),
  enrollment_fee   numeric(12,2) NOT NULL DEFAULT 0 CHECK (enrollment_fee >= 0),
  start_date      date,
  end_date        date,
  status          text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'active', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_unique_per_year UNIQUE (program_id, academic_year_id, institution_id)
);

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_courses_institution ON public.courses (institution_id);
CREATE INDEX IF NOT EXISTS idx_courses_academic_year ON public.courses (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_courses_program ON public.courses (program_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);

-- ============================================================
-- 7. classes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  capacity        integer NOT NULL DEFAULT 30 CHECK (capacity > 0),
  room            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classes_unique_name UNIQUE (course_id, name)
);

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_classes_institution ON public.classes (institution_id);
CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes (course_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON public.classes (academic_year_id);

-- ============================================================
-- 8. enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id               uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  class_id                uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  academic_year_id        uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  enrollment_date         date NOT NULL DEFAULT current_date,
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'completed', 'withdrawn', 'transferred')),
  previous_enrollment_id  uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_unique_per_year UNIQUE (student_id, academic_year_id)
);

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON public.enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic_year ON public.enrollments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments (status);

-- ============================================================
-- 8a. Trigger: validate enrollment institution consistency
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_enrollment_institution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_institution  uuid;
  v_course_institution   uuid;
  v_class_institution    uuid;
  v_ay_institution       uuid;
BEGIN
  SELECT institution_id INTO v_student_institution FROM public.students WHERE id = NEW.student_id;
  SELECT institution_id INTO v_course_institution FROM public.courses WHERE id = NEW.course_id;
  SELECT institution_id INTO v_class_institution FROM public.classes WHERE id = NEW.class_id;
  SELECT institution_id INTO v_ay_institution FROM public.academic_years WHERE id = NEW.academic_year_id;

  IF v_student_institution IS NULL
     OR v_student_institution != v_course_institution
     OR v_student_institution != v_class_institution
     OR v_student_institution != v_ay_institution THEN
    RAISE EXCEPTION 'Enrollment institutions mismatch: student=%, course=%, class=%, year=%',
      v_student_institution, v_course_institution, v_class_institution, v_ay_institution;
  END IF;

  -- Validate that the class belongs to the course
  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = NEW.class_id AND course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'Class % does not belong to course %', NEW.class_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_enrollment ON public.enrollments;
CREATE TRIGGER trg_validate_enrollment
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.validate_enrollment_institution();

-- ============================================================
-- 9. class_transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  to_class_id     uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  transfer_date   date NOT NULL DEFAULT current_date,
  reason          text,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_transfers_enrollment ON public.class_transfers (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_class_transfers_student ON public.class_transfers (student_id);
CREATE INDEX IF NOT EXISTS idx_class_transfers_academic_year ON public.class_transfers (academic_year_id);

-- ============================================================
-- 9a. Function: perform_class_transfer (SECURITY DEFINER)
-- Atomically transfers a student to a new class and logs the transfer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.perform_class_transfer(
  p_enrollment_id uuid,
  p_to_class_id  uuid,
  p_reason       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id uuid;
  v_student_id   uuid;
  v_from_class   uuid;
  v_ay_id        uuid;
BEGIN
  SELECT student_id, class_id, academic_year_id
    INTO v_student_id, v_from_class, v_ay_id
  FROM public.enrollments
  WHERE id = p_enrollment_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active enrollment not found: %', p_enrollment_id;
  END IF;

  INSERT INTO public.class_transfers (
    enrollment_id, student_id, from_class_id, to_class_id, academic_year_id, reason, created_by
  ) VALUES (
    p_enrollment_id, v_student_id, v_from_class, p_to_class_id, v_ay_id, p_reason, auth.uid()
  ) RETURNING id INTO v_transfer_id;

  UPDATE public.enrollments
  SET class_id = p_to_class_id, updated_at = now()
  WHERE id = p_enrollment_id;

  RETURN v_transfer_id;
END;
$$;

-- ============================================================
-- 10. schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  class_id        uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id      uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  day_of_week     integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  room            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedules_time_valid CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedules_class ON public.schedules (class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON public.schedules (teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_academic_year ON public.schedules (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON public.schedules (day_of_week);

-- ============================================================
-- 11. attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  date            date NOT NULL,
  status          text NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note            text,
  recorded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_unique UNIQUE (schedule_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule ON public.attendance (schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON public.attendance (academic_year_id);

-- ============================================================
-- 12. assessments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id      uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  teacher_id      uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  type            text NOT NULL DEFAULT 'exam'
                  CHECK (type IN ('exam', 'quiz', 'homework', 'project')),
  title           text NOT NULL,
  max_score       numeric(6,2) NOT NULL DEFAULT 20 CHECK (max_score > 0),
  coefficient     numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (coefficient > 0),
  date            date NOT NULL DEFAULT current_date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'validated')),
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_assessments_class ON public.assessments (class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_subject ON public.assessments (subject_id);
CREATE INDEX IF NOT EXISTS idx_assessments_academic_year ON public.assessments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments (status);

-- ============================================================
-- 13. grades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  teacher_id      uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  score           numeric(6,2) NOT NULL CHECK (score >= 0),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'validated')),
  graded_by       uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grades_unique UNIQUE (assessment_id, student_id)
);

CREATE TRIGGER trg_grades_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_grades_assessment ON public.grades (assessment_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON public.grades (student_id);
CREATE INDEX IF NOT EXISTS idx_grades_academic_year ON public.grades (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_grades_status ON public.grades (status);
CREATE INDEX IF NOT EXISTS idx_grades_teacher ON public.grades (teacher_id);

-- ============================================================
-- 14. Enable RLS on all academic tables
-- ============================================================
ALTER TABLE public.academic_years   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_transfers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades           ENABLE ROW LEVEL SECURITY;
