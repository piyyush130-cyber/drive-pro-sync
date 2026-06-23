
-- Grant Data API access to all public tables. RLS policies remain in force.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
GRANT INSERT ON public.bookings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_requests TO authenticated;
GRANT ALL ON public.cancellation_requests TO service_role;
GRANT INSERT ON public.cancellation_requests TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_availability TO authenticated;
GRANT ALL ON public.instructor_availability TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_blocked_times TO authenticated;
GRANT ALL ON public.instructor_blocked_times TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_invite_codes TO authenticated;
GRANT ALL ON public.instructor_invite_codes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_types TO authenticated;
GRANT ALL ON public.lesson_types TO service_role;
GRANT SELECT ON public.lesson_types TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;
GRANT SELECT ON public.school_settings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_progress TO authenticated;
GRANT ALL ON public.student_progress TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
