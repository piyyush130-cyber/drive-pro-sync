-- school_settings.self_cancel_hours (added in 20260807100000) turned out to
-- duplicate an existing, already-admin-editable column:
-- cancellation_notice_hours (added 2026-06-16, default 24, already wired
-- into both the onboarding wizard and Settings — it just had no server-side
-- enforcement anywhere until the student portal's self-cancel logic now
-- reads it). Drop the duplicate rather than carrying two hours-before-
-- cancellation settings that could drift out of sync.
ALTER TABLE public.school_settings DROP COLUMN IF EXISTS self_cancel_hours;
