-- Hard backstop for plan instructor limits, enforced at the DB level so it
-- can't be bypassed by any code path (onboarding, the admin Instructors
-- page, or instructor-invite-code redemption all insert into instructors
-- directly). The app also does a friendly pre-flight check before insert
-- so users see an upgrade prompt instead of this raw exception in the
-- common case. Keep these limits in sync with src/lib/plans.ts.
CREATE OR REPLACE FUNCTION public.enforce_instructor_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.billing_status;
  v_plan public.plan_key;
  v_limit INT;
  v_count INT;
BEGIN
  SELECT billing_status, plan INTO v_status, v_plan
  FROM public.school_billing WHERE school_id = NEW.school_id;

  -- No billing row yet, or comped: unlimited.
  IF v_status IS NULL OR v_status = 'free_forever' OR v_plan IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := CASE v_plan
    WHEN 'starter' THEN 3
    WHEN 'professional' THEN 9
    WHEN 'enterprise' THEN 10
  END;

  SELECT count(*) INTO v_count FROM public.instructors
  WHERE school_id = NEW.school_id AND deleted_at IS NULL;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Instructor limit reached for the % plan (max %). Upgrade your plan to add more instructors.', v_plan, v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instructor_limit ON public.instructors;
CREATE TRIGGER trg_instructor_limit
  BEFORE INSERT ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_instructor_limit();
