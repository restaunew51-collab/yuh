/*
# Fix: Revoke remaining EXECUTE permissions

## Summary
- Revoke EXECUTE on is_teacher_of_class from anon/public (was missed in 0013)
- Revoke EXECUTE on trigger functions from authenticated (they should only run via triggers, not RPC)
*/

-- Fix is_teacher_of_class
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;

-- Revoke from authenticated on trigger functions (they run as table owner via triggers, not RPC)
REVOKE EXECUTE ON FUNCTION public.create_audit_log() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_enrollment_institution() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_installment_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_installment_on_refund() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_audit_trigger(text) FROM authenticated;
