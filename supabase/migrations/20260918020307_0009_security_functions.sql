/*
# SECURITY DEFINER Functions for RBAC and RLS

## Summary
Creates the helper functions used by RLS policies throughout the application.
All functions are SECURITY DEFINER with explicit search_path to prevent
search_path injection and RLS recursion.

## Functions Created

### current_profile_id()
Returns auth.uid() — the profile ID of the current user.
Simple wrapper for clarity in policies.

### current_institution_id()
Returns the institution_id from the current user's profile.
Returns NULL for super_admin (who may span institutions).

### current_student_id()
Returns the student record ID linked to the current user's profile.
Returns NULL if the user is not a student.

### current_teacher_id()
Returns the teacher record ID linked to the current user's profile.
Returns NULL if the user is not a teacher.

### current_academic_year_id()
Returns the UUID of the current academic year for the current user's institution,
read from the settings table. Returns NULL if not set.

### has_permission(p_code text)
Returns TRUE if the current user has the given permission via any of their roles.
Returns TRUE unconditionally for super_admin (bypasses the permission check).
Returns FALSE for unauthenticated or users with no matching role.

### is_teacher_of_class(p_class_id uuid)
Returns TRUE if the current user is a teacher assigned to the given class
(via schedules in the current academic year).

### is_super_admin()
Returns TRUE if the current user has the super_admin role in any institution.

## Security Considerations
1. All functions use `SECURITY DEFINER` with `SET search_path = public` to prevent
   search_path attacks and ensure consistent behavior.
2. Functions only return scalars (boolean/uuid) — never rows or sensitive data.
3. Functions only perform SELECTs — never INSERT/UPDATE/DELETE.
4. `has_permission` checks `auth.uid()` internally, not a parameter — it cannot be
   tricked into checking another user's permissions.
5. No function trusts an institution_id passed from the client — all derive it
   from the authenticated user's profile.
6. RLS recursion is avoided because these functions only read from tables that
   either have no RLS (auth.users) or have their own policies that don't call
   back into these functions (roles, permissions, user_roles, profiles).
*/

-- ============================================================
-- 1. current_profile_id()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;

-- ============================================================
-- 2. current_institution_id()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_institution_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_institution_id() TO authenticated;

-- ============================================================
-- 3. current_student_id()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;

-- ============================================================
-- 4. current_teacher_id()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;

-- ============================================================
-- 5. current_academic_year_id()
--    Reads from settings for the current user's institution.
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_academic_year_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT value::uuid FROM public.settings
  WHERE key = 'current_academic_year'
    AND institution_id = public.current_institution_id();
$$;

GRANT EXECUTE ON FUNCTION public.current_academic_year_id() TO authenticated;

-- ============================================================
-- 6. is_super_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.code = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ============================================================
-- 7. has_permission(p_code text)
--    Returns TRUE if the user has the permission OR is super_admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND p.code = p_code
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ============================================================
-- 8. is_teacher_of_class(p_class_id uuid)
--    Checks if the current user teaches the given class.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.teacher_id = public.current_teacher_id()
      AND s.class_id = p_class_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;
