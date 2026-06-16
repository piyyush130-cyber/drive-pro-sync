
This is a very large request (design system overhaul + 4 new feature areas + DB schema + role rules). To keep it shippable and high-quality, I'll deliver it in **4 sequenced phases**, each independently usable. You can approve the whole plan, or tell me to ship only specific phases.

---

## Phase 1 — Dark luxury design system (foundation)

Apply the new palette across **every** page so later phases inherit it automatically.

- Rewrite `src/styles.css` tokens: navy `#0A0F1E` background, surface `#111827`, border `#1E2D4A`, electric blue `#3B82F6`, accent `#60A5FA`, gold `#D4AF37`, success/warning/danger, slate text.
- Add Inter (display + body) and JetBrains Mono (data) via `<link>` in `__root.tsx`.
- Rewrite shared utilities: `card-premium`, `btn-primary/secondary/danger`, `input-premium`, `badge-*` (pill, 15% opacity bg + matching text), `ambient-glow` (top-corner radial), `stat-card` (top 2px blue border).
- Update `AppSidebar` to dark panel (`#0D1424`, 240px, collapsible) + top bar with school name, user, avatar initial, **notification bell** (wired in Phase 4).
- Recolor public booking page (`/`), `/auth`, `/dashboard`, `/bookings`, `/calendar`, `/students`, `/instructors`, `/services`, `/payments`, `/settings`, `/instructor`, `/cancel` to the new tokens. No new layouts — only restyle.

## Phase 2 — Instructor invite + approval flow

**DB migration:**
- `instructor_invite_codes` (code, is_active, expires_at, max_uses, used_count, created_by).
- Add columns to `instructors`: `status` enum (`pending_approval | active | deactivated | rejected`), `approved_by`, `approved_at`, `invite_code_used`.
- RLS: admins manage codes & instructors; instructors read own row only.

**Server functions** (`src/lib/staff.functions.ts`):
- `generateInviteCode` (admin only)
- `deactivateInviteCode` (admin only)
- `signupWithInviteCode` (public — validates code, creates auth user via admin client, inserts pending instructor)
- `approveInstructor`, `rejectInstructor`, `deactivateInstructor`, `reactivateInstructor` (admin only)

**Routes / UI:**
- `/staff-signup?code=XXXX` — public page, prefilled code, friendly confirmation screen.
- `/login` already exists → add status-aware routing in `auth.tsx`: pending → waiting screen, rejected/deactivated → access denied, active instructor → `/instructor`, admin → `/dashboard`.
- `_authenticated/instructors.tsx`: add **Invite Codes** card (generate / copy code / copy link / deactivate / usage count) + **Pending Approvals** tab + status badges + actions.

## Phase 3 — Instructor portal expansion + lesson notes + availability requests

**DB migration:**
- `instructor_availability_requests` (request_type, date, start/end_time, reason, status, reviewed_by/at).
- `lesson_notes` (lesson_id, instructor_id, student_id, note, practiced_skills jsonb, next_focus, road_test_readiness enum).
- RLS: instructor can CRUD own notes/requests; admin reviews requests.

**Routes:**
- `/instructor` rebuilt with sidebar tabs: **Today / Upcoming / Availability / My Students**.
- Today: large time, student name, copy phone, pickup/dropoff, payment readonly, actions (Completed, No-Show, Add note, Update progress).
- Upcoming: grouped Tomorrow / This week / Later.
- Availability: view current schedule + submit time-off/vacation/hours-change requests, status badges.
- My Students: only assigned students, lesson history, notes, readiness, lightweight skills checklist.

**Admin side:** new **Availability Requests** panel in admin instructors page (approve/reject).

## Phase 4 — Student portal + admin notifications

**DB migration:**
- `notifications` (school_id, type, message, related_id, is_read).
- Add `access_token` (uuid) to `students` for magic-link portal.
- Trigger: on `bookings` insert → notification; on `instructors` insert (pending) → notification; on `instructor_availability_requests` insert → notification.

**Server functions:**
- `getStudentPortal(token)` — public, returns student's lessons, instructor names, readiness, reminders, lessons remaining.
- `listNotifications`, `markNotificationRead` (admin).

**Routes:**
- `/student/$token` — client-facing personal status card: upcoming lesson, history, readiness, reminders, lessons remaining. Read-only. Same dark theme, calmer layout.
- Bell icon in admin top bar with unread badge → popover panel listing recent notifications with deep links.

**Booking flow updates:** when a public booking is created, generate the student `access_token` and (later) surface the magic link in admin booking detail for SMS/email sharing.

---

## Out of scope (call out so we don't silently skip)

- **Real SMS/email delivery** of the magic link — I'll generate the link and show it in the admin booking detail for copy/share. Wiring Twilio/Resend is a follow-up.
- **Multi-school isolation (`school_id` everywhere)**: current schema is single-school. I'll keep it single-school for now and add `school_id` only on the new tables as nullable, ready for future multi-tenant.
- **Optional invite code expiry/max-uses UI** is included; enforcement is in the signup server fn.

---

## Suggested shipping order

1. **Phase 1** first (foundation — touches everything visually).
2. **Phase 2** next (unblocks real instructor onboarding).
3. **Phases 3 + 4** after that.

**Reply with one of:**
- "Ship all phases" — I'll execute end-to-end across multiple turns.
- "Ship phase 1 only" (or 1+2, etc.) — I'll stop after that phase so you can review.
- Edits to the plan — tell me what to change.
