-- Free-text incident/complaint note field on the student record. No
-- workflow (statuses, resolution tracking) yet — just a durable place for
-- admins to record something that happened, visible on the student's page.
ALTER TABLE public.students
  ADD COLUMN incident_notes TEXT;
