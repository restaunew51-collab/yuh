/*
# Seed: Test Institution and Current Academic Year

## Summary
Inserts a single test institution and a current academic year setting.
Roles and permissions were already seeded in migration 0002.

## Seeded Data
1. One institution: "Centre de Formation Test" (code: "TEST")
2. One academic year: "2025-2026" linked to that institution
3. A settings entry: current_academic_year = the academic year UUID

## Notes
- No test users are created (no hardcoded passwords in git).
- Super admin must be created manually via Supabase Auth + user_roles assignment.
- The academic year is marked as active.
*/

-- ============================================================
-- 1. Insert test institution
-- ============================================================
INSERT INTO public.institutions (name, code, address, email, is_active)
VALUES (
  'Centre de Formation Test',
  'TEST',
  '123 Rue de Test, Dakar',
  'contact@centre-test.edu',
  true
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Insert academic year 2025-2026
-- ============================================================
INSERT INTO public.academic_years (institution_id, name, start_date, end_date, is_active)
SELECT i.id, '2025-2026', '2025-09-01', '2026-07-31', true
FROM public.institutions i WHERE i.code = 'TEST'
ON CONFLICT (institution_id, name) DO NOTHING;

-- ============================================================
-- 3. Set current_academic_year in settings
-- ============================================================
INSERT INTO public.settings (institution_id, key, value)
SELECT i.id, 'current_academic_year', ay.id::text
FROM public.institutions i
JOIN public.academic_years ay ON ay.institution_id = i.id AND ay.name = '2025-2026'
WHERE i.code = 'TEST'
ON CONFLICT (institution_id, key) DO NOTHING;

-- ============================================================
-- 4. Verify seed data
-- ============================================================
SELECT 'institutions' as entity, count(*) as cnt FROM public.institutions
UNION ALL
SELECT 'roles', count(*) FROM public.roles
UNION ALL
SELECT 'permissions', count(*) FROM public.permissions
UNION ALL
SELECT 'role_permissions', count(*) FROM public.role_permissions
UNION ALL
SELECT 'academic_years', count(*) FROM public.academic_years
UNION ALL
SELECT 'settings', count(*) FROM public.settings;
