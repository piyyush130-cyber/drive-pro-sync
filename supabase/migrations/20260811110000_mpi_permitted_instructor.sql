-- MPI requires both the school AND the individual instructor to hold their
-- own permit. Defaults to false — a real legal/compliance requirement,
-- not a preference, so an instructor must be explicitly confirmed rather
-- than assumed permitted (matches the school-level MPI checkbox pattern).
ALTER TABLE public.instructors
  ADD COLUMN mpi_permitted BOOLEAN NOT NULL DEFAULT false;

-- tv_inst_insert previously only verified the instructor was acting as
-- themselves — nothing checked whether they personally hold an MPI
-- permit, so any instructor at the school could sign a TSR verification.
-- Enforced here at the RLS level, not just hidden client-side, since a
-- UI-only gate isn't a real boundary.
DROP POLICY IF EXISTS "tv_inst_insert" ON public.tsr_verifications;
CREATE POLICY "tv_inst_insert" ON public.tsr_verifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.instructors i
    WHERE i.id = tsr_verifications.issued_by_instructor_id
      AND i.profile_id = auth.uid()
      AND i.mpi_permitted = true
  ));
