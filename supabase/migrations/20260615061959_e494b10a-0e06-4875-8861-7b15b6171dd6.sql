
-- 1) user_roles: explicit admin-only INSERT/UPDATE/DELETE
CREATE POLICY ur_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ur_admin_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ur_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) bookings: trigger to block instructors from editing protected fields
CREATE OR REPLACE FUNCTION public.bookings_guard_instructor_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.instructor_id IS DISTINCT FROM OLD.instructor_id
     OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.lesson_type_id IS DISTINCT FROM OLD.lesson_type_id
  THEN
    RAISE EXCEPTION 'Instructors cannot modify assignment, pricing, or payment fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_guard_instructor_edits ON public.bookings;
CREATE TRIGGER bookings_guard_instructor_edits
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_guard_instructor_edits();

-- Add WITH CHECK so instructor still owns the row after update
DROP POLICY IF EXISTS b_inst_update ON public.bookings;
CREATE POLICY b_inst_update ON public.bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = bookings.instructor_id AND i.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = bookings.instructor_id AND i.profile_id = auth.uid()));

-- 3) student_progress: split into read/insert/update (no delete for instructors)
DROP POLICY IF EXISTS sp_inst_all ON public.student_progress;
CREATE POLICY sp_inst_read ON public.student_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid()
  ));
CREATE POLICY sp_inst_insert ON public.student_progress
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid()
  ));
CREATE POLICY sp_inst_update ON public.student_progress
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.instructors i ON i.id = b.instructor_id
    WHERE b.student_id = student_progress.student_id AND i.profile_id = auth.uid()
  ));
