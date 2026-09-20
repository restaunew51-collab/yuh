/*
# Roles, Permissions, and RBAC Tables

## Summary
Creates the complete RBAC infrastructure: roles, permissions, role_permissions junction,
and user_roles (with institution scoping). Seeds all 7 roles and all permissions.

## New Tables

### roles
The 7 application roles: super_admin, direction, administration, scolarite, comptabilite, formateur, etudiant.
- `id` (uuid PK)
- `code` (text, UNIQUE, NOT NULL) — machine-readable identifier
- `name` (text, NOT NULL) — display name
- `description` (text, nullable)
- `created_at` (timestamptz)

### permissions
Granular permissions in `resource.action` format (e.g. `students.view`).
- `id` (uuid PK)
- `code` (text, UNIQUE, NOT NULL)
- `name` (text, NOT NULL)
- `module` (text, NOT NULL) — grouping key like "students", "payments"
- `created_at` (timestamptz)

### role_permissions
Junction table mapping roles to permissions (N:N).
- `role_id` (uuid FK → roles, ON DELETE CASCADE)
- `permission_id` (uuid FK → permissions, ON DELETE CASCADE)
- PRIMARY KEY (role_id, permission_id)

### user_roles
Assigns roles to users, scoped by institution. A user can have different roles in different institutions.
- `user_id` (uuid FK → auth.users, ON DELETE CASCADE)
- `role_id` (uuid FK → roles, ON DELETE CASCADE)
- `institution_id` (uuid FK → institutions, ON DELETE CASCADE)
- `created_at` (timestamptz)
- PRIMARY KEY (user_id, role_id, institution_id)

## Seeded Data
- 7 roles inserted
- ~60 permissions inserted across all modules
- role_permissions mapping each permission to the appropriate roles per the validated matrix

## Security
- RLS enabled on all 4 tables.
- Policies defined in migration 0010.
- A CHECK constraint prevents empty codes on roles and permissions.

## Notes
1. user_roles is scoped by institution_id — a user can be a formateur in institution A
   and an administrator in institution B.
2. super_admin role_permissions are NOT seeded here — super_admin bypasses permission checks
   in the RLS functions (has_permission returns true for super_admin). This is by design
   to avoid maintaining a massive permission list for the super role.
3. The etudiant and formateur roles receive only their limited subset of permissions.
*/

-- ============================================================
-- 1. roles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_not_empty CHECK (length(btrim(code)) > 0)
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  module      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_code_not_empty CHECK (length(btrim(code)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions (module);

-- ============================================================
-- 3. role_permissions junction
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 4. user_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_institution ON public.user_roles (institution_id);

-- ============================================================
-- 5. Enable RLS
-- ============================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. SEED: roles
-- ============================================================
INSERT INTO public.roles (code, name, description) VALUES
  ('super_admin', 'Super Administrateur', 'Accès complet à toutes les fonctionnalités et paramètres'),
  ('direction', 'Direction', 'Accès administratif large à son établissement, validation et rapports'),
  ('administration', 'Administration', 'Gestion opérationnelle : étudiants, classes, planning'),
  ('scolarite', 'Scolarité', 'Inscriptions, présences, bulletins, emploi du temps'),
  ('comptabilite', 'Comptabilité', 'Paiements, échéances, dépenses, recettes'),
  ('formateur', 'Formateur', 'Accès aux classes et matières attribuées uniquement'),
  ('etudiant', 'Étudiant', 'Accès à ses propres données uniquement')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 7. SEED: permissions
-- ============================================================
INSERT INTO public.permissions (code, name, module) VALUES
  -- institutions
  ('institutions.view', 'Consulter les établissements', 'institutions'),
  ('institutions.manage', 'Gérer les établissements', 'institutions'),
  -- users
  ('users.view', 'Consulter les utilisateurs', 'users'),
  ('users.create', 'Créer des utilisateurs', 'users'),
  ('users.update', 'Modifier des utilisateurs', 'users'),
  ('users.delete', 'Supprimer des utilisateurs', 'users'),
  -- students
  ('students.view', 'Consulter les étudiants', 'students'),
  ('students.create', 'Créer des étudiants', 'students'),
  ('students.update', 'Modifier des étudiants', 'students'),
  ('students.delete', 'Supprimer des étudiants', 'students'),
  -- teachers
  ('teachers.view', 'Consulter les formateurs', 'teachers'),
  ('teachers.create', 'Créer des formateurs', 'teachers'),
  ('teachers.update', 'Modifier des formateurs', 'teachers'),
  ('teachers.delete', 'Supprimer des formateurs', 'teachers'),
  -- applicants
  ('applicants.view', 'Consulter les candidats', 'applicants'),
  ('applicants.create', 'Créer des candidats', 'applicants'),
  ('applicants.update', 'Modifier des candidats', 'applicants'),
  ('applicants.delete', 'Supprimer des candidats', 'applicants'),
  -- programs
  ('programs.view', 'Consulter les programmes', 'programs'),
  ('programs.create', 'Créer des programmes', 'programs'),
  ('programs.update', 'Modifier des programmes', 'programs'),
  ('programs.delete', 'Supprimer les programmes', 'programs'),
  -- courses
  ('courses.view', 'Consulter les formations', 'courses'),
  ('courses.create', 'Créer des formations', 'courses'),
  ('courses.update', 'Modifier les formations', 'courses'),
  ('courses.delete', 'Supprimer les formations', 'courses'),
  -- classes
  ('classes.view', 'Consulter les classes', 'classes'),
  ('classes.create', 'Créer des classes', 'classes'),
  ('classes.update', 'Modifier les classes', 'classes'),
  ('classes.delete', 'Supprimer les classes', 'classes'),
  -- enrollments
  ('enrollments.view', 'Consulter les inscriptions', 'enrollments'),
  ('enrollments.create', 'Créer des inscriptions', 'enrollments'),
  ('enrollments.update', 'Modifier les inscriptions', 'enrollments'),
  ('enrollments.delete', 'Supprimer les inscriptions', 'enrollments'),
  -- class transfers
  ('class_transfers.view', 'Consulter les changements de classe', 'class_transfers'),
  ('class_transfers.create', 'Effectuer un changement de classe', 'class_transfers'),
  -- schedules
  ('schedules.view', 'Consulter l''emploi du temps', 'schedules'),
  ('schedules.create', 'Créer des créneaux', 'schedules'),
  ('schedules.update', 'Modifier des créneaux', 'schedules'),
  ('schedules.delete', 'Supprimer des créneaux', 'schedules'),
  -- attendance
  ('attendance.view', 'Consulter les présences', 'attendance'),
  ('attendance.create', 'Saisir les présences', 'attendance'),
  ('attendance.update', 'Modifier les présences', 'attendance'),
  -- assessments
  ('assessments.view', 'Consulter les évaluations', 'assessments'),
  ('assessments.create', 'Créer des évaluations', 'assessments'),
  ('assessments.update', 'Modifier des évaluations', 'assessments'),
  ('assessments.delete', 'Supprimer des évaluations', 'assessments'),
  -- grades
  ('grades.view', 'Consulter les notes', 'grades'),
  ('grades.create', 'Saisir des notes', 'grades'),
  ('grades.update', 'Modifier des notes', 'grades'),
  ('grades.validate', 'Valider les notes', 'grades'),
  -- payments
  ('payments.view', 'Consulter les paiements', 'payments'),
  ('payments.create', 'Créer des paiements', 'payments'),
  ('payments.update', 'Modifier les paiements', 'payments'),
  -- refunds
  ('refunds.view', 'Consulter les remboursements', 'refunds'),
  ('refunds.create', 'Créer des remboursements', 'refunds'),
  -- expenses
  ('expenses.view', 'Consulter les dépenses', 'expenses'),
  ('expenses.create', 'Créer des dépenses', 'expenses'),
  ('expenses.update', 'Modifier des dépenses', 'expenses'),
  ('expenses.delete', 'Supprimer des dépenses', 'expenses'),
  -- documents
  ('documents.view', 'Consulter les documents', 'documents'),
  ('documents.create', 'Téléverser des documents', 'documents'),
  ('documents.delete', 'Supprimer des documents', 'documents'),
  -- certificates
  ('certificates.view', 'Consulter les certificats', 'certificates'),
  ('certificates.create', 'Créer des certificats', 'certificates'),
  ('certificates.verify', 'Vérifier un certificat', 'certificates'),
  -- notifications
  ('notifications.view', 'Consulter les notifications', 'notifications'),
  ('notifications.create', 'Créer des notifications', 'notifications'),
  -- reports
  ('reports.view', 'Consulter les rapports', 'reports'),
  -- audit
  ('audit.view', 'Consulter le journal d''audit', 'audit'),
  -- settings
  ('settings.view', 'Consulter les paramètres', 'settings'),
  ('settings.manage', 'Gérer les paramètres', 'settings')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 8. SEED: role_permissions
--    super_admin is NOT seeded here — has_permission() returns true
--    for super_admin regardless of role_permissions.
-- ============================================================

-- Helper: assign permissions to a role by code pattern
DO $$
DECLARE
  v_direction       uuid := (SELECT id FROM public.roles WHERE code = 'direction');
  v_administration  uuid := (SELECT id FROM public.roles WHERE code = 'administration');
  v_scolarite       uuid := (SELECT id FROM public.roles WHERE code = 'scolarite');
  v_comptabilite    uuid := (SELECT id FROM public.roles WHERE code = 'comptabilite');
  v_formateur       uuid := (SELECT id FROM public.roles WHERE code = 'formateur');
  v_etudiant        uuid := (SELECT id FROM public.roles WHERE code = 'etudiant');
BEGIN
  -- direction: broad read + validation + reports + audit
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_direction, id FROM public.permissions
  WHERE code IN (
    'institutions.view',
    'users.view',
    'students.view','applicants.view','teachers.view',
    'programs.view','courses.view','classes.view',
    'enrollments.view','class_transfers.view',
    'schedules.view','attendance.view',
    'assessments.view','grades.view','grades.validate',
    'payments.view','refunds.view','expenses.view',
    'documents.view','certificates.view','certificates.verify',
    'notifications.view','reports.view','audit.view',
    'settings.view'
  ) ON CONFLICT DO NOTHING;

  -- administration: operational management
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_administration, id FROM public.permissions
  WHERE code IN (
    'institutions.view',
    'users.view','users.create','users.update','users.delete',
    'students.view','students.create','students.update','students.delete',
    'applicants.view','applicants.create','applicants.update','applicants.delete',
    'teachers.view','teachers.create','teachers.update','teachers.delete',
    'programs.view','programs.create','programs.update','programs.delete',
    'courses.view','courses.create','courses.update','courses.delete',
    'classes.view','classes.create','classes.update','classes.delete',
    'enrollments.view','enrollments.create','enrollments.update','enrollments.delete',
    'class_transfers.view','class_transfers.create',
    'schedules.view','schedules.create','schedules.update','schedules.delete',
    'attendance.view','attendance.create','attendance.update',
    'assessments.view','assessments.create','assessments.update','assessments.delete',
    'grades.view','grades.create','grades.update',
    'documents.view','documents.create','documents.delete',
    'certificates.view','certificates.create',
    'notifications.view','notifications.create',
    'reports.view','settings.view'
  ) ON CONFLICT DO NOTHING;

  -- scolarite: inscriptions, présences, bulletins, emploi du temps
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_scolarite, id FROM public.permissions
  WHERE code IN (
    'students.view','students.create','students.update',
    'applicants.view','applicants.create','applicants.update',
    'teachers.view',
    'programs.view','courses.view','classes.view',
    'enrollments.view','enrollments.create','enrollments.update',
    'class_transfers.view','class_transfers.create',
    'schedules.view','schedules.create','schedules.update',
    'attendance.view','attendance.create','attendance.update',
    'assessments.view','assessments.create','assessments.update',
    'grades.view','grades.create','grades.update',
    'documents.view','documents.create',
    'certificates.view','certificates.create',
    'notifications.view','notifications.create',
    'reports.view','settings.view'
  ) ON CONFLICT DO NOTHING;

  -- comptabilite: finances
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_comptabilite, id FROM public.permissions
  WHERE code IN (
    'students.view',
    'payments.view','payments.create','payments.update',
    'refunds.view','refunds.create',
    'expenses.view','expenses.create','expenses.update','expenses.delete',
    'documents.view','documents.create',
    'notifications.view','notifications.create',
    'reports.view','settings.view'
  ) ON CONFLICT DO NOTHING;

  -- formateur: limited to assigned classes
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_formateur, id FROM public.permissions
  WHERE code IN (
    'students.view',
    'classes.view',
    'schedules.view',
    'attendance.view','attendance.create','attendance.update',
    'assessments.view','assessments.create','assessments.update',
    'grades.view','grades.create','grades.update',
    'documents.view','documents.create'
  ) ON CONFLICT DO NOTHING;

  -- etudiant: own data only
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_etudiant, id FROM public.permissions
  WHERE code IN (
    'students.view',
    'enrollments.view',
    'schedules.view',
    'attendance.view',
    'grades.view',
    'payments.view',
    'documents.view',
    'certificates.view',
    'notifications.view'
  ) ON CONFLICT DO NOTHING;
END;
$$;
