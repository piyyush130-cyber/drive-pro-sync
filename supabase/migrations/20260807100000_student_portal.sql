-- Student portal: magic-link login + long-lived session, deliberately NOT
-- using students.profile_id / real Supabase Auth. See the plan discussion —
-- Supabase's admin generateLink() only supports email (not phone) magic
-- links, and wiring up profile_id would mean building a brand new RLS
-- surface from zero for a role touching sensitive student PII. Instead this
-- extends the same proven pattern already used by lesson_invitations /
-- next-lesson.$token: server-validated opaque tokens, all access through
-- supabaseAdmin, zero client-facing RLS policies.
--
-- students.profile_id remains intentionally unused by the portal — do not
-- merge these two auth mechanisms later.

CREATE TABLE public.student_login_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('email', 'sms')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX idx_sll_token_hash ON public.student_login_links(token_hash);
CREATE INDEX idx_sll_student ON public.student_login_links(student_id);

CREATE TABLE public.student_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_ss_token_hash ON public.student_sessions(token_hash);
CREATE INDEX idx_ss_student ON public.student_sessions(student_id);

-- Both tables are service-role only — the portal never queries them as
-- anon/authenticated, only via supabaseAdmin after manual token validation
-- in server functions, matching lesson_invitations' li_admin_all-only shape
-- (except here there isn't even an admin-read case, since these are purely
-- internal auth-plumbing tables an admin never needs to browse).
GRANT ALL ON public.student_login_links TO service_role;
GRANT ALL ON public.student_sessions TO service_role;
ALTER TABLE public.student_login_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;

-- Admin-configurable self-service cancellation window. NULL/0 disables
-- self-service cancellation entirely (falls back to request-only, today's
-- behavior for public/admin-initiated cancellations).
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS self_cancel_hours INT DEFAULT 24;
