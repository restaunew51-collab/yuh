/*
# HR Module — Staff Management

## Summary
Adds a Human Resources (RH) module to manage administrative and other institutional staff.
Introduces a `staff` table (parallel to `teachers`), a new `rh` role, and HR-specific permissions.
No existing tables are modified — only new tables, new seed rows, and new policies are added.

## New Tables

### staff
Institutional personnel who are not students or formateurs (e.g. administration, comptabilité, direction, support staff).
Linked to `profiles` (auth users) and scoped by institution.
- `id` (uuid PK)
- `profile_id` (uuid FK → profiles, nullable until a portal account is created)
- `institution_id` (uuid FK → institutions, NOT NULL)
- `staff_number` (text, NOT NULL) — unique per institution
- `first_name` (text, nullable)
- `last_name` (text, nullable)
- `email` (text, nullable)
- `phone` (text, nullable)
- `position` (text, nullable) — job title / poste
- `department` (text, nullable) — service / département
- `hire_date` (date, NOT NULL, default current_date)
- `contract_type` (text, CHECK: permanent / fixed_term / intern / external, default 'permanent')
- `status` (text, CHECK: active / inactive / on_leave / terminated, default 'active')
- `manager_id` (uuid FK → staff, nullable, self-reference for hierarchy)
- `created_at` / `updated_at` (timestamptz, auto-managed)

## New Role
- `rh` — "Ressources Humaines": manages staff records, departments, and hierarchy within their institution.

## New Permissions (module: `staff`)
- `staff.view` — Consulter le personnel
- `staff.create` — Créer un membre du personnel
- `staff.update` — Modifier le personnel
- `staff.delete` — Supprimer le personnel

## RLS Policies
- `staff`: institution-scoped CRUD for users with `staff.*` permissions (or super_admin bypass).
- Following the same pattern as `teachers` / `students`.

## Notes
1. The `staff` table reuses `profiles` for auth linking — no new auth tables.
2. `manager_id` is a self-referencing FK allowing a simple hierarchy (optional).
3. The `rh` role gets `staff.*` permissions plus read access to `users.view` so HR can see
   who has accounts, but cannot create/modify auth accounts (that stays with `users.create`/`users.update`).
4. `direction` and `administration` also receive `staff.view` so they can see their teams.
5. The existing `manage-user` edge function is NOT modified — staff account creation
   reuses the same `create_user` / `link_student_account` patterns through the existing
   user management flow. A new `link_staff_account` action is NOT added in this migration
   to avoid touching the edge function; staff accounts can be created via the existing
   "Nouvel utilisateur" dialog and then linked manually.
*/

-- ============================================================
-- 1. staff table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  staff_number    text NOT NULL,
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  position        text,
  department      text,
  hire_date       date NOT NULL DEFAULT current_date,
  contract_type   text NOT NULL DEFAULT 'permanent'
                  CHECK (contract_type IN ('permanent', 'fixed_term', 'intern', 'external')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  manager_id      uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_unique_number UNIQUE (institution_id, staff_number)
);

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_staff_institution ON public.staff (institution_id);
CREATE INDEX IF NOT EXISTS idx_staff_profile ON public.staff (profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff (status);
CREATE INDEX IF NOT EXISTS idx_staff_manager ON public.staff (manager_id);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies (institution-scoped, permission-checked)
-- ============================================================
DROP POLICY IF EXISTS "select_own_staff" ON public.staff;
CREATE POLICY "select_own_staff"
  ON public.staff FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      institution_id = public.current_institution_id()
      AND public.has_permission('staff.view')
    )
  );

DROP POLICY IF EXISTS "insert_own_staff" ON public.staff;
CREATE POLICY "insert_own_staff"
  ON public.staff FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      institution_id = public.current_institution_id()
      AND public.has_permission('staff.create')
    )
  );

DROP POLICY IF EXISTS "update_own_staff" ON public.staff;
CREATE POLICY "update_own_staff"
  ON public.staff FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      institution_id = public.current_institution_id()
      AND public.has_permission('staff.update')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      institution_id = public.current_institution_id()
      AND public.has_permission('staff.update')
    )
  );

DROP POLICY IF EXISTS "delete_own_staff" ON public.staff;
CREATE POLICY "delete_own_staff"
  ON public.staff FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      institution_id = public.current_institution_id()
      AND public.has_permission('staff.delete')
    )
  );

-- ============================================================
-- 4. SEED: new permissions
-- ============================================================
INSERT INTO public.permissions (code, name, module) VALUES
  ('staff.view', 'Consulter le personnel', 'staff'),
  ('staff.create', 'Créer un membre du personnel', 'staff'),
  ('staff.update', 'Modifier le personnel', 'staff'),
  ('staff.delete', 'Supprimer le personnel', 'staff')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. SEED: rh role (only if it doesn't exist)
-- ============================================================
INSERT INTO public.roles (code, name, description)
VALUES ('rh', 'Ressources Humaines', 'Gestion du personnel et de l''organisation hiérarchique')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 6. SEED: role_permissions for rh
-- ============================================================
DO $$
DECLARE
  v_rh             uuid := (SELECT id FROM public.roles WHERE code = 'rh');
  v_direction      uuid := (SELECT id FROM public.roles WHERE code = 'direction');
  v_administration uuid := (SELECT id FROM public.roles WHERE code = 'administration');
BEGIN
  -- rh: full staff management + read users + read documents + notifications + reports
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_rh, id FROM public.permissions
  WHERE code IN (
    'staff.view','staff.create','staff.update','staff.delete',
    'users.view',
    'documents.view','documents.create','documents.delete',
    'notifications.view','notifications.create',
    'reports.view','settings.view'
  ) ON CONFLICT DO NOTHING;

  -- direction: can view staff (see their team)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_direction, id FROM public.permissions
  WHERE code IN ('staff.view') ON CONFLICT DO NOTHING;

  -- administration: can view and manage staff
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_administration, id FROM public.permissions
  WHERE code IN ('staff.view','staff.create','staff.update','staff.delete') ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- 7. Helper: current_staff_id()
--    Returns the staff record ID linked to the current user's profile.
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.staff WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;
