/*
# Add identity fields to students table

## Description
Enriches the `students` table with a complete identity profile so the student
record is self-contained — even when no `profiles` row is linked (manual creation).

## New columns on `students`
1. `civility` — text, nullable. Values: 'M', 'Mme', 'Mlle'.
2. `first_name` — text, nullable. Student's first name(s).
3. `last_name` — text, nullable. Student's last name.
4. `email` — text, nullable. Student's email (may differ from auth email).
5. `birth_date` — date, nullable. Date of birth.
6. `birth_place` — text, nullable. Place of birth.
7. `gender` — text, nullable. Values: 'M', 'F'.
8. `nationality` — text, nullable. e.g. 'Sénégalaise'.
9. `marital_status` — text, nullable. Values: 'celibataire', 'marie', 'divorce', 'veuf'.
10. `address` — text, nullable. Postal address.
11. `emergency_contact_name` — text, nullable. Emergency contact full name.
12. `emergency_contact_relation` — text, nullable. Relationship to student (parent, tuteur...).
13. `emergency_contact_phone` — text, nullable. Emergency contact phone.

## Notes
- All new columns are nullable so existing rows are not affected.
- The `profiles` table remains untouched — it still stores `avatar_url` for linked accounts.
- No RLS policy changes needed: existing student policies already cover the new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'civility') THEN
    ALTER TABLE students ADD COLUMN civility text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'first_name') THEN
    ALTER TABLE students ADD COLUMN first_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'last_name') THEN
    ALTER TABLE students ADD COLUMN last_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'email') THEN
    ALTER TABLE students ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'birth_date') THEN
    ALTER TABLE students ADD COLUMN birth_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'birth_place') THEN
    ALTER TABLE students ADD COLUMN birth_place text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'gender') THEN
    ALTER TABLE students ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'nationality') THEN
    ALTER TABLE students ADD COLUMN nationality text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'marital_status') THEN
    ALTER TABLE students ADD COLUMN marital_status text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'address') THEN
    ALTER TABLE students ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'emergency_contact_name') THEN
    ALTER TABLE students ADD COLUMN emergency_contact_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'emergency_contact_relation') THEN
    ALTER TABLE students ADD COLUMN emergency_contact_relation text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'emergency_contact_phone') THEN
    ALTER TABLE students ADD COLUMN emergency_contact_phone text;
  END IF;
END $$;
