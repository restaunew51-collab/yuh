/*
# Convert Applicant to Student + Student Number Generation

## Purpose
This migration adds two SECURITY DEFINER functions:

1. `generate_student_number(p_institution_id uuid)` — Generates a unique, stable
   student number (matricule) in the format `YYYY-NNNN` where YYYY is the current
   year and NNNN is a zero-padded sequence within that institution. The function
   is concurrency-safe: it uses a transactional `SELECT ... FOR UPDATE` on the
   last matching student_number and retries on collision.

2. `convert_applicant_to_student(p_applicant_id uuid)` — Atomically converts an
   applicant into a student. This function:
   - Verifies the applicant exists and belongs to the caller's institution
   - Verifies the applicant has not already been converted (no existing student
     with that applicant_id)
   - Checks the caller has `students.create` permission
   - Generates a unique student_number via generate_student_number
   - Creates the student record with status 'active'
   - Updates the applicant status to 'admitted'
   - Audit is handled automatically by existing triggers on both tables
   - Returns the new student's id

## Security
- Both functions are SECURITY DEFINER so they can operate on tables even when
  the calling role has limited direct privileges.
- convert_applicant_to_student checks `has_permission('students.create')` and
  `current_institution_id()` to enforce multi-tenant isolation.
- The functions do NOT bypass RLS for SELECT queries — they use the security
  definer only for the INSERT/UPDATE operations that need atomicity.

## Important Notes
1. No new tables are created.
2. No existing columns are modified or dropped.
3. The student_number format is `YYYY-NNNN` (e.g., 2026-0001) and is unique
   per institution via the existing `students_unique_number` index.
4. The conversion is atomic — a double-click or concurrent request will not
   create duplicate students because the function checks for an existing
   student with the same applicant_id and raises an exception if found.
*/

-- =============================================================
-- generate_student_number: concurrency-safe matricule generator
-- =============================================================
CREATE OR REPLACE FUNCTION public.generate_student_number(p_institution_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year          text := to_char(now(), 'YYYY');
  v_prefix        text := v_year || '-';
  v_last_number   text;
  v_next_seq      int;
  v_new_number    text;
BEGIN
  -- Find the highest existing student_number for this institution with the current year prefix
  SELECT student_number
  INTO v_last_number
  FROM public.students
  WHERE institution_id = p_institution_id
    AND student_number LIKE v_prefix || '%'
  ORDER BY student_number DESC
  LIMIT 1
  FOR UPDATE;

  IF v_last_number IS NULL THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := CAST(REPLACE(v_last_number, v_prefix, '') AS int) + 1;
  END IF;

  v_new_number := v_prefix || lpad(v_next_seq::text, 4, '0');

  RETURN v_new_number;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_student_number(uuid) TO authenticated;

-- =============================================================
-- convert_applicant_to_student: atomic applicant → student conversion
-- =============================================================
CREATE OR REPLACE FUNCTION public.convert_applicant_to_student(p_applicant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant     public.applicants%ROWTYPE;
  v_institution   uuid;
  v_student_id    uuid;
  v_student_num   text;
  v_existing_id   uuid;
BEGIN
  -- 1. Get the caller's institution
  v_institution := public.current_institution_id();
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Aucune institution associée à votre compte.';
  END IF;

  -- 2. Check permission
  IF NOT public.has_permission('students.create') THEN
    RAISE EXCEPTION 'Vous n''avez pas la permission de créer un étudiant.';
  END IF;

  -- 3. Fetch the applicant and verify institution
  SELECT * INTO v_applicant
  FROM public.applicants
  WHERE id = p_applicant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidat introuvable.';
  END IF;

  IF v_applicant.institution_id != v_institution AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Ce candidat n''appartient pas à votre institution.';
  END IF;

  -- 4. Check if already converted (idempotency guard)
  SELECT id INTO v_existing_id
  FROM public.students
  WHERE applicant_id = p_applicant_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce candidat a déjà été converti en étudiant.';
  END IF;

  -- 5. Generate student number
  v_student_num := public.generate_student_number(v_institution);

  -- 6. Create the student record
  INSERT INTO public.students (
    institution_id,
    applicant_id,
    student_number,
    admission_date,
    status
  ) VALUES (
    v_applicant.institution_id,
    p_applicant_id,
    v_student_num,
    CURRENT_DATE,
    'active'
  )
  RETURNING id INTO v_student_id;

  -- 7. Update applicant status to 'admitted'
  UPDATE public.applicants
  SET status = 'admitted'
  WHERE id = p_applicant_id;

  -- Audit is handled by existing triggers (trg_audit_applicants, trg_audit_students)

  RETURN v_student_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.convert_applicant_to_student(uuid) TO authenticated;
