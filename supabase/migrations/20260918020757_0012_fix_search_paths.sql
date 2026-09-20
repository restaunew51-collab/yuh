/*
# Fix: Add SET search_path to trigger functions

## Summary
The security advisor flagged functions without explicit SET search_path.
This migration adds SET search_path = public to all trigger functions that were missing it.

## Fixed Functions
- set_updated_at() — used by all updated_at triggers
- validate_enrollment_institution() — enrollment integrity check
- recalc_installment_status() — financial trigger
- recalc_installment_on_refund() — refund trigger
- add_audit_trigger() — helper to attach audit triggers
*/

-- ============================================================
-- Fix: set_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix: validate_enrollment_institution
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_enrollment_institution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = NEW.class_id AND course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'Class % does not belong to course %', NEW.class_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix: recalc_installment_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_installment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_installment_id uuid;
  v_plan_id        uuid;
  v_total_paid     numeric(12,2);
  v_total_due      numeric(12,2);
  v_new_status     text;
  v_plan_total_due numeric(12,2);
  v_plan_total_paid numeric(12,2);
  v_plan_status    text;
BEGIN
  v_installment_id := COALESCE(NEW.installment_id, OLD.installment_id);

  IF v_installment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT payment_plan_id, amount_due
    INTO v_plan_id, v_total_due
  FROM public.installments
  WHERE id = v_installment_id;

  SELECT COALESCE(SUM(p.amount), 0)
    INTO v_total_paid
  FROM public.payments p
  WHERE p.installment_id = v_installment_id
    AND p.status = 'completed';

  v_new_status := CASE
    WHEN v_total_paid >= v_total_due AND v_total_due > 0 THEN 'paid'
    WHEN v_total_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.installments
  SET amount_paid = v_total_paid, status = v_new_status, updated_at = now()
  WHERE id = v_installment_id;

  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_paid), 0)
    INTO v_plan_total_due, v_plan_total_paid
  FROM public.installments
  WHERE payment_plan_id = v_plan_id AND status != 'cancelled';

  v_plan_status := CASE
    WHEN v_plan_total_paid >= v_plan_total_due AND v_plan_total_due > 0 THEN 'paid'
    WHEN v_plan_total_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.payment_plans
  SET status = v_plan_status, updated_at = now()
  WHERE id = v_plan_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Fix: recalc_installment_on_refund
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_installment_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_installment_id uuid;
  v_total_paid    numeric(12,2);
  v_amount_due   numeric(12,2);
  v_new_paid     numeric(12,2);
  v_new_status   text;
  v_plan_id      uuid;
  v_plan_due     numeric(12,2);
  v_plan_paid    numeric(12,2);
  v_plan_st      text;
BEGIN
  SELECT installment_id INTO v_installment_id
  FROM public.payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  IF v_installment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) - COALESCE((
    SELECT SUM(r.amount) FROM public.refunds r
    JOIN public.payments p2 ON p2.id = r.payment_id
    WHERE p2.installment_id = v_installment_id AND r.status = 'completed'
  ), 0)
    INTO v_total_paid
  FROM public.payments p
  WHERE p.installment_id = v_installment_id AND p.status = 'completed';

  SELECT amount_due INTO v_amount_due
  FROM public.installments WHERE id = v_installment_id;

  v_new_paid := GREATEST(v_total_paid, 0);
  v_new_status := CASE
    WHEN v_new_paid >= v_amount_due AND v_amount_due > 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.installments
  SET amount_paid = v_new_paid, status = v_new_status, updated_at = now()
  WHERE id = v_installment_id;

  SELECT payment_plan_id INTO v_plan_id FROM public.installments WHERE id = v_installment_id;

  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_paid), 0)
    INTO v_plan_due, v_plan_paid
  FROM public.installments
  WHERE payment_plan_id = v_plan_id AND status != 'cancelled';

  v_plan_st := CASE
    WHEN v_plan_paid >= v_plan_due AND v_plan_due > 0 THEN 'paid'
    WHEN v_plan_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.payment_plans
  SET status = v_plan_st, updated_at = now()
  WHERE id = v_plan_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Fix: add_audit_trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_audit_trigger(p_table_name text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_audit_%s ON public.%I; '
    'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I '
    'FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();',
    p_table_name, p_table_name,
    p_table_name, p_table_name
  );
END;
$$;
