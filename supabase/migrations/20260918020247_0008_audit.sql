/*
# Audit Logs

## Summary
Creates the audit_logs table and a generic audit trigger function that can be attached
to any table to automatically log INSERT/UPDATE/DELETE operations.

## New Tables

### audit_logs
Immutable log of sensitive operations. Users cannot directly INSERT, UPDATE, or DELETE
audit log entries — only the trigger function (running as the table owner) can insert.
- `id` (uuid PK)
- `institution_id` (uuid, nullable — derived from the row being audited)
- `user_id` (uuid FK → auth.users, nullable — the actor, from auth.uid())
- `action` (text: INSERT/UPDATE/DELETE)
- `table_name` (text)
- `record_id` (uuid — the PK of the affected row)
- `old_data` (jsonb, nullable — row state before change)
- `new_data` (jsonb, nullable — row state after change)
- `created_at` (timestamptz, default now())

## Functions
- `create_audit_log()` — generic trigger function. Attached to sensitive tables.
  Captures the old/new row as jsonb, the table name, and the acting user via auth.uid().
- `add_audit_trigger(table_name text)` — helper to attach the audit trigger to a table.

## Security
- RLS enabled.
- No INSERT/UPDATE/DELETE policies for authenticated users — only the trigger (SECURITY DEFINER)
  can write to audit_logs.
- SELECT policy for audit.view permission (in migration 0010).
*/

-- ============================================================
-- 1. audit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name      text NOT NULL,
  record_id       uuid,
  old_data        jsonb,
  new_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_institution ON public.audit_logs (institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- ============================================================
-- 2. Generic audit trigger function (SECURITY DEFINER)
--    Runs as the table owner, so it can INSERT into audit_logs
--    even though the calling user has no INSERT permission.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id uuid;
  v_record_id uuid;
BEGIN
  -- Try to extract institution_id from the row (if the column exists)
  BEGIN
    v_institution_id := NEW.institution_id;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      v_institution_id := OLD.institution_id;
    EXCEPTION WHEN undefined_column THEN
      v_institution_id := NULL;
    END;
  END;

  -- Extract the primary key (assumes uuid PK named 'id')
  BEGIN
    v_record_id := NEW.id;
  EXCEPTION WHEN undefined_column THEN
    v_record_id := OLD.id;
  END;

  INSERT INTO public.audit_logs (
    institution_id, user_id, action, table_name, record_id, old_data, new_data
  ) VALUES (
    v_institution_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 3. Helper: attach audit trigger to a table
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_audit_trigger(p_table_name text)
RETURNS void
LANGUAGE plpgsql
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

-- ============================================================
-- 4. Attach audit triggers to sensitive tables
-- ============================================================
SELECT public.add_audit_trigger('students');
SELECT public.add_audit_trigger('teachers');
SELECT public.add_audit_trigger('applicants');
SELECT public.add_audit_trigger('enrollments');
SELECT public.add_audit_trigger('class_transfers');
SELECT public.add_audit_trigger('grades');
SELECT public.add_audit_trigger('payments');
SELECT public.add_audit_trigger('payment_transactions');
SELECT public.add_audit_trigger('refunds');
SELECT public.add_audit_trigger('certificates');
SELECT public.add_audit_trigger('settings');
SELECT public.add_audit_trigger('user_roles');

-- ============================================================
-- 5. Enable RLS
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
