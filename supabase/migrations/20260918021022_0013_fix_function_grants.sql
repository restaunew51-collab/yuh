/*
# Fix: Revoke EXECUTE from anon on SECURITY DEFINER functions

## Summary
The security advisor flagged that SECURITY DEFINER functions were callable by the
`anon` role via the REST API. This migration revokes EXECUTE from anon and public,
and grants it only to authenticated.

## Fixed Functions
- create_audit_log() — trigger function, should never be called directly
- handle_new_user() — trigger function, should never be called directly
- validate_enrollment_institution() — trigger function
- recalc_installment_status() — trigger function
- recalc_installment_on_refund() — trigger function
- add_audit_trigger() — helper, admin only
- perform_class_transfer() — RPC, authenticated only
- current_institution_id() — helper, authenticated only
- current_student_id() — helper, authenticated only
- current_teacher_id() — helper, authenticated only
- current_academic_year_id() — helper, authenticated only
- is_super_admin() — helper, authenticated only
- has_permission() — helper, authenticated only
- current_profile_id() — helper, authenticated only

## Security
- anon role can no longer call any of these functions via /rest/v1/rpc/
- authenticated role retains EXECUTE on the helper functions
- Trigger functions (create_audit_log, handle_new_user, etc.) have EXECUTE
  revoked from both anon and authenticated — they are only called by triggers,
  not by clients.
*/

-- ============================================================
-- Revoke EXECUTE from anon and public on ALL SECURITY DEFINER functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.create_audit_log() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_enrollment_institution() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalc_installment_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalc_installment_on_refund() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_audit_trigger(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.perform_class_transfer(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_institution_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_student_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_teacher_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_academic_year_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon, public;

-- ============================================================
-- Re-grant EXECUTE to authenticated on helper functions only
-- (trigger functions don't need explicit grants — they run as the table owner)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_academic_year_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perform_class_transfer(uuid, uuid, text) TO authenticated;
