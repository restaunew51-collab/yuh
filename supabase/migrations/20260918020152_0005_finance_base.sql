/*
# Finance: Payment Plans, Installments, Payments, Transactions, Refunds, Expenses

## Summary
Creates the complete financial structure with 5-table separation and PostgreSQL triggers
for automatic status recalculation. No Edge Functions needed at this stage.

## New Tables (6 tables)

### payment_plans (total amount owed)
- `id`, `institution_id`, `student_id`, `course_id`, `academic_year_id`, `enrollment_id`
- `total_amount` (numeric), `currency` (text: XOF/EUR, default XOF)
- `status` (pending/partially_paid/paid/overdue/cancelled)
- timestamps

### installments (echeances)
- `id`, `payment_plan_id`, `student_id`, `academic_year_id`
- `installment_number` (1,2,3...), `label`, `amount_due`, `amount_paid` (maintained by trigger)
- `due_date`, `status` (pending/partially_paid/paid/overdue/cancelled)
- timestamps

### payments (act of payment)
- `id`, `installment_id`, `student_id`, `academic_year_id`
- `amount`, `payment_date`, `method` (cash/bank_transfer/wave/orange_money/other)
- `status` (pending/completed/failed/cancelled)
- `collected_by` (FK auth.users), `note`
- timestamps

### payment_transactions (technical details)
- `id`, `payment_id`
- `provider` (manual/wave/orange_money/stripe/bank)
- `provider_transaction_id` (UNIQUE — idempotency for webhooks)
- `provider_status`, `amount`, `currency`
- `webhook_received_at`, `signature_verified` (boolean)
- `raw_payload` (jsonb)
- timestamps

### refunds
- `id`, `payment_id`, `student_id`
- `amount`, `refund_date`, `reason`, `method`
- `status` (pending/completed/cancelled)
- `processed_by` (FK auth.users)
- timestamps

### expenses
- `id`, `institution_id`
- `category`, `description`, `amount`, `currency`, `expense_date`
- `created_by` (FK auth.users)
- timestamps

## Triggers
1. `recalc_installment_on_payment` — after INSERT/UPDATE/DELETE on payment_transactions
   with status='completed': recalculates installments.amount_paid and status,
   then cascades to payment_plans.status.
2. `recalc_installment_on_refund` — after INSERT/UPDATE/DELETE on refunds
   with status='completed': deducts refund amount from installments.amount_paid.

## Idempotency
- `provider_transaction_id` has a UNIQUE constraint to prevent duplicate webhook processing.
- Payment transactions with status='completed' are treated as immutable historical records.

## Security
- RLS enabled on all 6 tables.
- Policies in migration 0010.
*/

-- ============================================================
-- 1. payment_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  enrollment_id   uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  total_amount    numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  currency        text NOT NULL DEFAULT 'XOF' CHECK (currency IN ('XOF', 'EUR')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payment_plans_student ON public.payment_plans (student_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_academic_year ON public.payment_plans (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON public.payment_plans (status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_institution ON public.payment_plans (institution_id);

-- ============================================================
-- 2. installments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.installments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id     uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id    uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  installment_number  integer NOT NULL CHECK (installment_number > 0),
  label               text NOT NULL,
  amount_due          numeric(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid         numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date            date NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_installments_payment_plan ON public.installments (payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_installments_student ON public.installments (student_id);
CREATE INDEX IF NOT EXISTS idx_installments_academic_year ON public.installments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments (status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments (due_date);

-- ============================================================
-- 3. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id  uuid NOT NULL REFERENCES public.installments(id) ON DELETE RESTRICT,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date    timestamptz NOT NULL DEFAULT now(),
  method          text NOT NULL DEFAULT 'cash'
                  CHECK (method IN ('cash', 'bank_transfer', 'wave', 'orange_money', 'other')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  collected_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payments_installment ON public.payments (installment_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_academic_year ON public.payments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments (method);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments (payment_date);

-- ============================================================
-- 4. payment_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id              uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  provider                text NOT NULL DEFAULT 'manual'
                          CHECK (provider IN ('manual', 'wave', 'orange_money', 'stripe', 'bank')),
  provider_transaction_id text UNIQUE,
  provider_status         text,
  amount                  numeric(12,2) NOT NULL CHECK (amount > 0),
  currency                text NOT NULL DEFAULT 'XOF' CHECK (currency IN ('XOF', 'EUR')),
  webhook_received_at     timestamptz,
  signature_verified      boolean NOT NULL DEFAULT false,
  raw_payload             jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment ON public.payment_transactions (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON public.payment_transactions (provider);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_txn ON public.payment_transactions (provider_transaction_id);

-- ============================================================
-- 5. refunds
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  refund_date     timestamptz NOT NULL DEFAULT now(),
  reason          text,
  method          text NOT NULL DEFAULT 'cash'
                  CHECK (method IN ('cash', 'bank_transfer', 'wave', 'orange_money', 'other')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'cancelled')),
  processed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_student ON public.refunds (student_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds (status);

-- ============================================================
-- 6. expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  category        text NOT NULL,
  description     text,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  currency        text NOT NULL DEFAULT 'XOF' CHECK (currency IN ('XOF', 'EUR')),
  expense_date    date NOT NULL DEFAULT current_date,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_expenses_institution ON public.expenses (institution_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category);

-- ============================================================
-- 7. FINANCIAL TRIGGERS
--    Recalculate installment.amount_paid and status
--    when a payment_transaction is inserted/updated/deleted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_installment_status()
RETURNS trigger
LANGUAGE plpgsql
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
  -- Determine the installment_id from the affected transaction
  v_installment_id := COALESCE(
    NEW.installment_id,
    OLD.installment_id
  );

  IF v_installment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the installment's payment_plan_id and amounts
  SELECT payment_plan_id, amount_due
    INTO v_plan_id, v_total_due
  FROM public.installments
  WHERE id = v_installment_id;

  -- Sum all completed payments for this installment
  SELECT COALESCE(SUM(p.amount), 0)
    INTO v_total_paid
  FROM public.payments p
  WHERE p.installment_id = v_installment_id
    AND p.status = 'completed';

  -- Update installment
  v_new_status := CASE
    WHEN v_total_paid >= v_total_due AND v_total_due > 0 THEN 'paid'
    WHEN v_total_paid > 0 THEN 'partially_paid'
    ELSE 'pending'
  END;

  UPDATE public.installments
  SET amount_paid = v_total_paid, status = v_new_status, updated_at = now()
  WHERE id = v_installment_id;

  -- Recalculate payment_plan status
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

-- We need the installment_id on payment_transactions. But transactions reference payments,
-- and payments reference installments. So we need a trigger on payments, not transactions.
-- Let's create the trigger on payments instead.

DROP TRIGGER IF EXISTS trg_payment_recalc ON public.payments;
CREATE TRIGGER trg_payment_recalc
  AFTER INSERT OR UPDATE OF status, amount OR DELETE
  ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_installment_status();

-- ============================================================
-- 8. REFUND TRIGGER
--    Deduct refund amount from installment when refund is completed
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_installment_on_refund()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_installment_id uuid;
  v_installment_installment_id uuid;
  v_installment_payment_plan_id uuid;
  v_total_refunds numeric(12,2);
  v_total_paid    numeric(12,2);
  v_amount_due   numeric(12,2);
  v_new_paid     numeric(12,2);
  v_new_status   text;
BEGIN
  -- Get the installment_id from the payment associated with the refund
  SELECT installment_id INTO v_installment_id
  FROM public.payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  IF v_installment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sum completed payments minus completed refunds for this installment
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

  -- Recalc payment plan
  DECLARE
    v_plan_id uuid;
    v_plan_due numeric(12,2);
    v_plan_paid numeric(12,2);
    v_plan_st text;
  BEGIN
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
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_recalc ON public.refunds;
CREATE TRIGGER trg_refund_recalc
  AFTER INSERT OR UPDATE OF status, amount OR DELETE
  ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.recalc_installment_on_refund();

-- ============================================================
-- 9. Enable RLS
-- ============================================================
ALTER TABLE public.payment_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses              ENABLE ROW LEVEL SECURITY;
