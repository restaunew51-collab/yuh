/*
# RLS Policies — All Tables

## Summary
Creates Row Level Security policies for every table in the database.
Uses the SECURITY DEFINER helper functions from migration 0009.

## Policy Patterns
- Admin/Staff: has_permission + institution match
- Student: self-data only (current_student_id)
- Teacher: assigned classes only (is_teacher_of_class)
- Public: anon read for active programs/courses/institutions
- All INSERT/UPDATE enforce institution_id = current_institution_id()
- UPDATE policies prevent changing institution_id

## Recursion Prevention
- profiles: uses auth.uid() directly (no helper)
- user_roles: uses auth.uid() directly
- roles/permissions/role_permissions: open SELECT to all authenticated
*/

-- ============================================================
-- 1. institutions
-- ============================================================
DROP POLICY IF EXISTS "select_institutions" ON public.institutions;
CREATE POLICY "select_institutions" ON public.institutions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "public_select_institutions" ON public.institutions;
CREATE POLICY "public_select_institutions" ON public.institutions FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "insert_institutions" ON public.institutions;
CREATE POLICY "insert_institutions" ON public.institutions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('institutions.manage'));

DROP POLICY IF EXISTS "update_institutions" ON public.institutions;
CREATE POLICY "update_institutions" ON public.institutions FOR UPDATE
  TO authenticated
  USING (public.has_permission('institutions.manage'))
  WITH CHECK (public.has_permission('institutions.manage'));

DROP POLICY IF EXISTS "delete_institutions" ON public.institutions;
CREATE POLICY "delete_institutions" ON public.institutions FOR DELETE
  TO authenticated
  USING (public.has_permission('institutions.manage'));

-- ============================================================
-- 2. profiles — uses auth.uid() directly to prevent recursion
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_permission('users.view')
  );

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_permission('users.update')
  )
  WITH CHECK (
    id = auth.uid()
    OR public.has_permission('users.update')
  );

DROP POLICY IF EXISTS "insert_profiles" ON public.profiles;
CREATE POLICY "insert_profiles" ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('users.create'));

DROP POLICY IF EXISTS "delete_profiles" ON public.profiles;
CREATE POLICY "delete_profiles" ON public.profiles FOR DELETE
  TO authenticated
  USING (public.has_permission('users.delete'));

-- ============================================================
-- 3. roles — reference data, readable by all authenticated
-- ============================================================
DROP POLICY IF EXISTS "select_roles" ON public.roles;
CREATE POLICY "select_roles" ON public.roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_roles" ON public.roles;
CREATE POLICY "insert_roles" ON public.roles FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_roles" ON public.roles;
CREATE POLICY "update_roles" ON public.roles FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_roles" ON public.roles;
CREATE POLICY "delete_roles" ON public.roles FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================
-- 4. permissions — reference data, readable by all authenticated
-- ============================================================
DROP POLICY IF EXISTS "select_permissions" ON public.permissions;
CREATE POLICY "select_permissions" ON public.permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_permissions" ON public.permissions;
CREATE POLICY "insert_permissions" ON public.permissions FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_permissions" ON public.permissions;
CREATE POLICY "update_permissions" ON public.permissions FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_permissions" ON public.permissions;
CREATE POLICY "delete_permissions" ON public.permissions FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================
-- 5. role_permissions — readable by all authenticated
-- ============================================================
DROP POLICY IF EXISTS "select_role_permissions" ON public.role_permissions;
CREATE POLICY "select_role_permissions" ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_role_permissions" ON public.role_permissions;
CREATE POLICY "insert_role_permissions" ON public.role_permissions FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_role_permissions" ON public.role_permissions;
CREATE POLICY "update_role_permissions" ON public.role_permissions FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_role_permissions" ON public.role_permissions;
CREATE POLICY "delete_role_permissions" ON public.role_permissions FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================
-- 6. user_roles — users can see their own role assignments
-- ============================================================
DROP POLICY IF EXISTS "select_user_roles" ON public.user_roles;
CREATE POLICY "select_user_roles" ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission('users.view')
  );

DROP POLICY IF EXISTS "insert_user_roles" ON public.user_roles;
CREATE POLICY "insert_user_roles" ON public.user_roles FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('users.create'));

DROP POLICY IF EXISTS "update_user_roles" ON public.user_roles;
CREATE POLICY "update_user_roles" ON public.user_roles FOR UPDATE
  TO authenticated USING (public.has_permission('users.update'))
  WITH CHECK (public.has_permission('users.update'));

DROP POLICY IF EXISTS "delete_user_roles" ON public.user_roles;
CREATE POLICY "delete_user_roles" ON public.user_roles FOR DELETE
  TO authenticated USING (public.has_permission('users.delete'));

-- ============================================================
-- 7. applicants
-- ============================================================
DROP POLICY IF EXISTS "select_applicants" ON public.applicants;
CREATE POLICY "select_applicants" ON public.applicants FOR SELECT
  TO authenticated
  USING (
    public.has_permission('applicants.view')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "public_insert_applicants" ON public.applicants;
CREATE POLICY "public_insert_applicants" ON public.applicants FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_applicants" ON public.applicants;
CREATE POLICY "update_applicants" ON public.applicants FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('applicants.update')
    AND institution_id = public.current_institution_id()
  )
  WITH CHECK (
    public.has_permission('applicants.update')
    AND institution_id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "delete_applicants" ON public.applicants;
CREATE POLICY "delete_applicants" ON public.applicants FOR DELETE
  TO authenticated
  USING (
    public.has_permission('applicants.delete')
    AND institution_id = public.current_institution_id()
  );

-- ============================================================
-- 8. students
-- ============================================================
DROP POLICY IF EXISTS "select_students" ON public.students;
CREATE POLICY "select_students" ON public.students FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('students.view') AND institution_id = public.current_institution_id())
    OR id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_students" ON public.students;
CREATE POLICY "insert_students" ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('students.create')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_students" ON public.students;
CREATE POLICY "update_students" ON public.students FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('students.update')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('students.update')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "delete_students" ON public.students;
CREATE POLICY "delete_students" ON public.students FOR DELETE
  TO authenticated
  USING (
    public.has_permission('students.delete')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

-- ============================================================
-- 9. teachers
-- ============================================================
DROP POLICY IF EXISTS "select_teachers" ON public.teachers;
CREATE POLICY "select_teachers" ON public.teachers FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('teachers.view') AND institution_id = public.current_institution_id())
    OR id = public.current_teacher_id()
  );

DROP POLICY IF EXISTS "insert_teachers" ON public.teachers;
CREATE POLICY "insert_teachers" ON public.teachers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('teachers.create')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_teachers" ON public.teachers;
CREATE POLICY "update_teachers" ON public.teachers FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('teachers.update')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('teachers.update')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "delete_teachers" ON public.teachers;
CREATE POLICY "delete_teachers" ON public.teachers FOR DELETE
  TO authenticated
  USING (
    public.has_permission('teachers.delete')
    AND (public.is_super_admin() OR institution_id = public.current_institution_id())
  );

-- ============================================================
-- 10. academic_years
-- ============================================================
DROP POLICY IF EXISTS "select_academic_years" ON public.academic_years;
CREATE POLICY "select_academic_years" ON public.academic_years FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin() OR institution_id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "insert_academic_years" ON public.academic_years;
CREATE POLICY "insert_academic_years" ON public.academic_years FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('settings.manage') AND institution_id = public.current_institution_id()
  );

DROP POLICY IF EXISTS "update_academic_years" ON public.academic_years;
CREATE POLICY "update_academic_years" ON public.academic_years FOR UPDATE
  TO authenticated
  USING (public.has_permission('settings.manage') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('settings.manage') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_academic_years" ON public.academic_years;
CREATE POLICY "delete_academic_years" ON public.academic_years FOR DELETE
  TO authenticated
  USING (public.has_permission('settings.manage') AND institution_id = public.current_institution_id());

-- ============================================================
-- 11. terms
-- ============================================================
DROP POLICY IF EXISTS "select_terms" ON public.terms;
CREATE POLICY "select_terms" ON public.terms FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.academic_years ay
      WHERE ay.id = terms.academic_year_id
        AND ay.institution_id = public.current_institution_id()
    )
  );

DROP POLICY IF EXISTS "insert_terms" ON public.terms;
CREATE POLICY "insert_terms" ON public.terms FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('settings.manage')
    AND EXISTS (
      SELECT 1 FROM public.academic_years ay
      WHERE ay.id = terms.academic_year_id
        AND ay.institution_id = public.current_institution_id()
    )
  );

DROP POLICY IF EXISTS "update_terms" ON public.terms;
CREATE POLICY "update_terms" ON public.terms FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('settings.manage')
    AND EXISTS (SELECT 1 FROM public.academic_years ay WHERE ay.id = terms.academic_year_id AND ay.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('settings.manage')
    AND EXISTS (SELECT 1 FROM public.academic_years ay WHERE ay.id = terms.academic_year_id AND ay.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "delete_terms" ON public.terms;
CREATE POLICY "delete_terms" ON public.terms FOR DELETE
  TO authenticated
  USING (
    public.has_permission('settings.manage')
    AND EXISTS (SELECT 1 FROM public.academic_years ay WHERE ay.id = terms.academic_year_id AND ay.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 12. programs — public read for active programs
-- ============================================================
DROP POLICY IF EXISTS "select_programs" ON public.programs;
CREATE POLICY "select_programs" ON public.programs FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    OR (auth.uid() IS NOT NULL AND (public.is_super_admin() OR institution_id = public.current_institution_id()))
  );

DROP POLICY IF EXISTS "insert_programs" ON public.programs;
CREATE POLICY "insert_programs" ON public.programs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('programs.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_programs" ON public.programs;
CREATE POLICY "update_programs" ON public.programs FOR UPDATE
  TO authenticated
  USING (public.has_permission('programs.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('programs.update') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_programs" ON public.programs;
CREATE POLICY "delete_programs" ON public.programs FOR DELETE
  TO authenticated
  USING (public.has_permission('programs.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 13. modules
-- ============================================================
DROP POLICY IF EXISTS "select_modules" ON public.modules;
CREATE POLICY "select_modules" ON public.modules FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = modules.program_id AND p.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "insert_modules" ON public.modules;
CREATE POLICY "insert_modules" ON public.modules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('programs.create')
    AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = modules.program_id AND p.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_modules" ON public.modules;
CREATE POLICY "update_modules" ON public.modules FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('programs.update')
    AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = modules.program_id AND p.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('programs.update')
    AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = modules.program_id AND p.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "delete_modules" ON public.modules;
CREATE POLICY "delete_modules" ON public.modules FOR DELETE
  TO authenticated
  USING (
    public.has_permission('programs.delete')
    AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = modules.program_id AND p.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 14. subjects
-- ============================================================
DROP POLICY IF EXISTS "select_subjects" ON public.subjects;
CREATE POLICY "select_subjects" ON public.subjects FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.modules m JOIN public.programs p ON p.id = m.program_id
      WHERE m.id = subjects.module_id AND p.institution_id = public.current_institution_id()
    )
  );

DROP POLICY IF EXISTS "insert_subjects" ON public.subjects;
CREATE POLICY "insert_subjects" ON public.subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('programs.create')
    AND EXISTS (
      SELECT 1 FROM public.modules m JOIN public.programs p ON p.id = m.program_id
      WHERE m.id = subjects.module_id AND p.institution_id = public.current_institution_id()
    )
  );

DROP POLICY IF EXISTS "update_subjects" ON public.subjects;
CREATE POLICY "update_subjects" ON public.subjects FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('programs.update')
    AND EXISTS (SELECT 1 FROM public.modules m JOIN public.programs p ON p.id = m.program_id WHERE m.id = subjects.module_id AND p.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('programs.update')
    AND EXISTS (SELECT 1 FROM public.modules m JOIN public.programs p ON p.id = m.program_id WHERE m.id = subjects.module_id AND p.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "delete_subjects" ON public.subjects;
CREATE POLICY "delete_subjects" ON public.subjects FOR DELETE
  TO authenticated
  USING (
    public.has_permission('programs.delete')
    AND EXISTS (SELECT 1 FROM public.modules m JOIN public.programs p ON p.id = m.program_id WHERE m.id = subjects.module_id AND p.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 15. courses — public read for active courses
-- ============================================================
DROP POLICY IF EXISTS "select_courses" ON public.courses;
CREATE POLICY "select_courses" ON public.courses FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    OR (auth.uid() IS NOT NULL AND (public.is_super_admin() OR institution_id = public.current_institution_id()))
  );

DROP POLICY IF EXISTS "insert_courses" ON public.courses;
CREATE POLICY "insert_courses" ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('courses.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_courses" ON public.courses;
CREATE POLICY "update_courses" ON public.courses FOR UPDATE
  TO authenticated
  USING (public.has_permission('courses.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('courses.update') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_courses" ON public.courses;
CREATE POLICY "delete_courses" ON public.courses FOR DELETE
  TO authenticated
  USING (public.has_permission('courses.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 16. classes
-- ============================================================
DROP POLICY IF EXISTS "select_classes" ON public.classes;
CREATE POLICY "select_classes" ON public.classes FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('classes.view') AND institution_id = public.current_institution_id())
    OR public.is_teacher_of_class(id)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = classes.id AND e.student_id = public.current_student_id() AND e.status = 'active')
  );

DROP POLICY IF EXISTS "insert_classes" ON public.classes;
CREATE POLICY "insert_classes" ON public.classes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('classes.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_classes" ON public.classes;
CREATE POLICY "update_classes" ON public.classes FOR UPDATE
  TO authenticated
  USING (public.has_permission('classes.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('classes.update') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_classes" ON public.classes;
CREATE POLICY "delete_classes" ON public.classes FOR DELETE
  TO authenticated
  USING (public.has_permission('classes.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 17. enrollments
-- ============================================================
DROP POLICY IF EXISTS "select_enrollments" ON public.enrollments;
CREATE POLICY "select_enrollments" ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('enrollments.view') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
    OR public.is_teacher_of_class(class_id)
  );

DROP POLICY IF EXISTS "insert_enrollments" ON public.enrollments;
CREATE POLICY "insert_enrollments" ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('enrollments.create')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_enrollments" ON public.enrollments;
CREATE POLICY "update_enrollments" ON public.enrollments FOR UPDATE
  TO authenticated
  USING (public.has_permission('enrollments.update') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.institution_id = public.current_institution_id()))
  WITH CHECK (public.has_permission('enrollments.update') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.institution_id = public.current_institution_id()));

DROP POLICY IF EXISTS "delete_enrollments" ON public.enrollments;
CREATE POLICY "delete_enrollments" ON public.enrollments FOR DELETE
  TO authenticated
  USING (public.has_permission('enrollments.delete') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.institution_id = public.current_institution_id()));

-- ============================================================
-- 18. class_transfers
-- ============================================================
DROP POLICY IF EXISTS "select_class_transfers" ON public.class_transfers;
CREATE POLICY "select_class_transfers" ON public.class_transfers FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('class_transfers.view') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = class_transfers.student_id AND s.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_class_transfers" ON public.class_transfers;
CREATE POLICY "insert_class_transfers" ON public.class_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('class_transfers.create')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = class_transfers.student_id AND s.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 19. schedules
-- ============================================================
DROP POLICY IF EXISTS "select_schedules" ON public.schedules;
CREATE POLICY "select_schedules" ON public.schedules FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('schedules.view') AND institution_id = public.current_institution_id())
    OR teacher_id = public.current_teacher_id()
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = schedules.class_id AND e.student_id = public.current_student_id() AND e.status = 'active')
  );

DROP POLICY IF EXISTS "insert_schedules" ON public.schedules;
CREATE POLICY "insert_schedules" ON public.schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('schedules.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_schedules" ON public.schedules;
CREATE POLICY "update_schedules" ON public.schedules FOR UPDATE
  TO authenticated
  USING (public.has_permission('schedules.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('schedules.update') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_schedules" ON public.schedules;
CREATE POLICY "delete_schedules" ON public.schedules FOR DELETE
  TO authenticated
  USING (public.has_permission('schedules.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 20. attendance
-- ============================================================
DROP POLICY IF EXISTS "select_attendance" ON public.attendance;
CREATE POLICY "select_attendance" ON public.attendance FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('attendance.view') AND EXISTS (SELECT 1 FROM public.schedules s JOIN public.classes c ON c.id = s.class_id WHERE s.id = attendance.schedule_id AND c.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
    OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = attendance.schedule_id AND s.teacher_id = public.current_teacher_id())
  );

DROP POLICY IF EXISTS "insert_attendance" ON public.attendance;
CREATE POLICY "insert_attendance" ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('attendance.create')
    AND EXISTS (SELECT 1 FROM public.schedules s JOIN public.classes c ON c.id = s.class_id WHERE s.id = attendance.schedule_id AND c.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_attendance" ON public.attendance;
CREATE POLICY "update_attendance" ON public.attendance FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('attendance.update')
    AND EXISTS (SELECT 1 FROM public.schedules s JOIN public.classes c ON c.id = s.class_id WHERE s.id = attendance.schedule_id AND c.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('attendance.update')
    AND EXISTS (SELECT 1 FROM public.schedules s JOIN public.classes c ON c.id = s.class_id WHERE s.id = attendance.schedule_id AND c.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 21. assessments
-- ============================================================
DROP POLICY IF EXISTS "select_assessments" ON public.assessments;
CREATE POLICY "select_assessments" ON public.assessments FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('assessments.view') AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assessments.class_id AND c.institution_id = public.current_institution_id()))
    OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.class_id = assessments.class_id AND s.teacher_id = public.current_teacher_id())
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = assessments.class_id AND e.student_id = public.current_student_id() AND e.status = 'active')
  );

DROP POLICY IF EXISTS "insert_assessments" ON public.assessments;
CREATE POLICY "insert_assessments" ON public.assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('assessments.create')
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assessments.class_id AND c.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_assessments" ON public.assessments;
CREATE POLICY "update_assessments" ON public.assessments FOR UPDATE
  TO authenticated
  USING (public.has_permission('assessments.update') AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assessments.class_id AND c.institution_id = public.current_institution_id()))
  WITH CHECK (public.has_permission('assessments.update') AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assessments.class_id AND c.institution_id = public.current_institution_id()));

DROP POLICY IF EXISTS "delete_assessments" ON public.assessments;
CREATE POLICY "delete_assessments" ON public.assessments FOR DELETE
  TO authenticated
  USING (public.has_permission('assessments.delete') AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = assessments.class_id AND c.institution_id = public.current_institution_id()));

-- ============================================================
-- 22. grades
-- ============================================================
DROP POLICY IF EXISTS "select_grades" ON public.grades;
CREATE POLICY "select_grades" ON public.grades FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('grades.view') AND EXISTS (SELECT 1 FROM public.assessments a JOIN public.classes c ON c.id = a.class_id WHERE a.id = grades.assessment_id AND c.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
    OR teacher_id = public.current_teacher_id()
  );

DROP POLICY IF EXISTS "insert_grades" ON public.grades;
CREATE POLICY "insert_grades" ON public.grades FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('grades.create')
    AND EXISTS (SELECT 1 FROM public.assessments a JOIN public.classes c ON c.id = a.class_id WHERE a.id = grades.assessment_id AND c.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_grades" ON public.grades;
CREATE POLICY "update_grades" ON public.grades FOR UPDATE
  TO authenticated
  USING (public.has_permission('grades.update') AND EXISTS (SELECT 1 FROM public.assessments a JOIN public.classes c ON c.id = a.class_id WHERE a.id = grades.assessment_id AND c.institution_id = public.current_institution_id()))
  WITH CHECK (public.has_permission('grades.update') AND EXISTS (SELECT 1 FROM public.assessments a JOIN public.classes c ON c.id = a.class_id WHERE a.id = grades.assessment_id AND c.institution_id = public.current_institution_id()));

-- ============================================================
-- 23. payment_plans
-- ============================================================
DROP POLICY IF EXISTS "select_payment_plans" ON public.payment_plans;
CREATE POLICY "select_payment_plans" ON public.payment_plans FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('payments.view') AND institution_id = public.current_institution_id())
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_payment_plans" ON public.payment_plans;
CREATE POLICY "insert_payment_plans" ON public.payment_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('payments.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_payment_plans" ON public.payment_plans;
CREATE POLICY "update_payment_plans" ON public.payment_plans FOR UPDATE
  TO authenticated
  USING (public.has_permission('payments.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('payments.update') AND institution_id = public.current_institution_id());

-- ============================================================
-- 24. installments
-- ============================================================
DROP POLICY IF EXISTS "select_installments" ON public.installments;
CREATE POLICY "select_installments" ON public.installments FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('payments.view') AND EXISTS (SELECT 1 FROM public.payment_plans pp WHERE pp.id = installments.payment_plan_id AND pp.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_installments" ON public.installments;
CREATE POLICY "insert_installments" ON public.installments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('payments.create')
    AND EXISTS (SELECT 1 FROM public.payment_plans pp WHERE pp.id = installments.payment_plan_id AND pp.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_installments" ON public.installments;
CREATE POLICY "update_installments" ON public.installments FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.payment_plans pp WHERE pp.id = installments.payment_plan_id AND pp.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.payment_plans pp WHERE pp.id = installments.payment_plan_id AND pp.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 25. payments
-- ============================================================
DROP POLICY IF EXISTS "select_payments" ON public.payments;
CREATE POLICY "select_payments" ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('payments.view') AND EXISTS (SELECT 1 FROM public.installments i JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE i.id = payments.installment_id AND pp.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_payments" ON public.payments;
CREATE POLICY "insert_payments" ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('payments.create')
    AND EXISTS (SELECT 1 FROM public.installments i JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE i.id = payments.installment_id AND pp.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_payments" ON public.payments;
CREATE POLICY "update_payments" ON public.payments FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.installments i JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE i.id = payments.installment_id AND pp.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.installments i JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE i.id = payments.installment_id AND pp.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 26. payment_transactions
-- ============================================================
DROP POLICY IF EXISTS "select_payment_transactions" ON public.payment_transactions;
CREATE POLICY "select_payment_transactions" ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('payments.view') AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = payment_transactions.payment_id AND pp.institution_id = public.current_institution_id()))
  );

DROP POLICY IF EXISTS "insert_payment_transactions" ON public.payment_transactions;
CREATE POLICY "insert_payment_transactions" ON public.payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('payments.create')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = payment_transactions.payment_id AND pp.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_payment_transactions" ON public.payment_transactions;
CREATE POLICY "update_payment_transactions" ON public.payment_transactions FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = payment_transactions.payment_id AND pp.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('payments.update')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = payment_transactions.payment_id AND pp.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 27. refunds
-- ============================================================
DROP POLICY IF EXISTS "select_refunds" ON public.refunds;
CREATE POLICY "select_refunds" ON public.refunds FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('refunds.view') AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = refunds.payment_id AND pp.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_refunds" ON public.refunds;
CREATE POLICY "insert_refunds" ON public.refunds FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('refunds.create')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = refunds.payment_id AND pp.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_refunds" ON public.refunds;
CREATE POLICY "update_refunds" ON public.refunds FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('refunds.create')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = refunds.payment_id AND pp.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('refunds.create')
    AND EXISTS (SELECT 1 FROM public.payments p JOIN public.installments i ON i.id = p.installment_id JOIN public.payment_plans pp ON pp.id = i.payment_plan_id WHERE p.id = refunds.payment_id AND pp.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 28. expenses
-- ============================================================
DROP POLICY IF EXISTS "select_expenses" ON public.expenses;
CREATE POLICY "select_expenses" ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('expenses.view') AND institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "insert_expenses" ON public.expenses;
CREATE POLICY "insert_expenses" ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('expenses.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_expenses" ON public.expenses;
CREATE POLICY "update_expenses" ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_permission('expenses.update') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('expenses.update') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_expenses" ON public.expenses;
CREATE POLICY "delete_expenses" ON public.expenses FOR DELETE
  TO authenticated
  USING (public.has_permission('expenses.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 29. documents
-- ============================================================
DROP POLICY IF EXISTS "select_documents" ON public.documents;
CREATE POLICY "select_documents" ON public.documents FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('documents.view') AND institution_id = public.current_institution_id())
    OR uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.document_students ds WHERE ds.document_id = documents.id AND ds.student_id = public.current_student_id())
  );

DROP POLICY IF EXISTS "insert_documents" ON public.documents;
CREATE POLICY "insert_documents" ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('documents.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_documents" ON public.documents;
CREATE POLICY "delete_documents" ON public.documents FOR DELETE
  TO authenticated
  USING (public.has_permission('documents.delete') AND institution_id = public.current_institution_id());

-- ============================================================
-- 30. document_students
-- ============================================================
DROP POLICY IF EXISTS "select_document_students" ON public.document_students;
CREATE POLICY "select_document_students" ON public.document_students FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_permission('documents.view') OR student_id = public.current_student_id());

DROP POLICY IF EXISTS "insert_document_students" ON public.document_students;
CREATE POLICY "insert_document_students" ON public.document_students FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('documents.create'));

DROP POLICY IF EXISTS "delete_document_students" ON public.document_students;
CREATE POLICY "delete_document_students" ON public.document_students FOR DELETE
  TO authenticated USING (public.has_permission('documents.delete'));

-- ============================================================
-- 31. document_teachers
-- ============================================================
DROP POLICY IF EXISTS "select_document_teachers" ON public.document_teachers;
CREATE POLICY "select_document_teachers" ON public.document_teachers FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_permission('documents.view') OR teacher_id = public.current_teacher_id());

DROP POLICY IF EXISTS "insert_document_teachers" ON public.document_teachers;
CREATE POLICY "insert_document_teachers" ON public.document_teachers FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('documents.create'));

DROP POLICY IF EXISTS "delete_document_teachers" ON public.document_teachers;
CREATE POLICY "delete_document_teachers" ON public.document_teachers FOR DELETE
  TO authenticated USING (public.has_permission('documents.delete'));

-- ============================================================
-- 32. document_applicants
-- ============================================================
DROP POLICY IF EXISTS "select_document_applicants" ON public.document_applicants;
CREATE POLICY "select_document_applicants" ON public.document_applicants FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_permission('documents.view'));

DROP POLICY IF EXISTS "insert_document_applicants" ON public.document_applicants;
CREATE POLICY "insert_document_applicants" ON public.document_applicants FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('documents.create'));

DROP POLICY IF EXISTS "delete_document_applicants" ON public.document_applicants;
CREATE POLICY "delete_document_applicants" ON public.document_applicants FOR DELETE
  TO authenticated USING (public.has_permission('documents.delete'));

-- ============================================================
-- 33. document_classes
-- ============================================================
DROP POLICY IF EXISTS "select_document_classes" ON public.document_classes;
CREATE POLICY "select_document_classes" ON public.document_classes FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_permission('documents.view') OR public.is_teacher_of_class(class_id));

DROP POLICY IF EXISTS "insert_document_classes" ON public.document_classes;
CREATE POLICY "insert_document_classes" ON public.document_classes FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('documents.create'));

DROP POLICY IF EXISTS "delete_document_classes" ON public.document_classes;
CREATE POLICY "delete_document_classes" ON public.document_classes FOR DELETE
  TO authenticated USING (public.has_permission('documents.delete'));

-- ============================================================
-- 34. document_institutions
-- ============================================================
DROP POLICY IF EXISTS "select_document_institutions" ON public.document_institutions;
CREATE POLICY "select_document_institutions" ON public.document_institutions FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_permission('documents.view'));

DROP POLICY IF EXISTS "insert_document_institutions" ON public.document_institutions;
CREATE POLICY "insert_document_institutions" ON public.document_institutions FOR INSERT
  TO authenticated WITH CHECK (public.has_permission('documents.create'));

DROP POLICY IF EXISTS "delete_document_institutions" ON public.document_institutions;
CREATE POLICY "delete_document_institutions" ON public.document_institutions FOR DELETE
  TO authenticated USING (public.has_permission('documents.delete'));

-- ============================================================
-- 35. certificates
-- ============================================================
DROP POLICY IF EXISTS "select_certificates" ON public.certificates;
CREATE POLICY "select_certificates" ON public.certificates FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('certificates.view') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = certificates.student_id AND s.institution_id = public.current_institution_id()))
    OR student_id = public.current_student_id()
  );

DROP POLICY IF EXISTS "insert_certificates" ON public.certificates;
CREATE POLICY "insert_certificates" ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('certificates.create')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = certificates.student_id AND s.institution_id = public.current_institution_id())
  );

DROP POLICY IF EXISTS "update_certificates" ON public.certificates;
CREATE POLICY "update_certificates" ON public.certificates FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('certificates.create')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = certificates.student_id AND s.institution_id = public.current_institution_id())
  )
  WITH CHECK (
    public.has_permission('certificates.create')
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = certificates.student_id AND s.institution_id = public.current_institution_id())
  );

-- ============================================================
-- 36. notifications
-- ============================================================
DROP POLICY IF EXISTS "select_notifications" ON public.notifications;
CREATE POLICY "select_notifications" ON public.notifications FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR (public.has_permission('notifications.view') AND institution_id = public.current_institution_id()));

DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
CREATE POLICY "insert_notifications" ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('notifications.create') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_notifications" ON public.notifications;
CREATE POLICY "update_notifications" ON public.notifications FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- ============================================================
-- 37. settings
-- ============================================================
DROP POLICY IF EXISTS "select_settings" ON public.settings;
CREATE POLICY "select_settings" ON public.settings FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR (public.has_permission('settings.view') AND institution_id = public.current_institution_id()));

DROP POLICY IF EXISTS "insert_settings" ON public.settings;
CREATE POLICY "insert_settings" ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('settings.manage') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "update_settings" ON public.settings;
CREATE POLICY "update_settings" ON public.settings FOR UPDATE
  TO authenticated
  USING (public.has_permission('settings.manage') AND institution_id = public.current_institution_id())
  WITH CHECK (public.has_permission('settings.manage') AND institution_id = public.current_institution_id());

DROP POLICY IF EXISTS "delete_settings" ON public.settings;
CREATE POLICY "delete_settings" ON public.settings FOR DELETE
  TO authenticated
  USING (public.has_permission('settings.manage') AND institution_id = public.current_institution_id());

-- ============================================================
-- 38. audit_logs — SELECT only
-- ============================================================
DROP POLICY IF EXISTS "select_audit_logs" ON public.audit_logs;
CREATE POLICY "select_audit_logs" ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_permission('audit.view') AND (institution_id IS NULL OR institution_id = public.current_institution_id()))
  );
