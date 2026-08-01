-- Enables scheduled jobs for the Next Lesson Invitation sweep. The actual
-- cron.schedule(...) call (which embeds the CRON_SECRET used to
-- authenticate the sweep endpoint) is applied directly against the
-- database, not committed here, so the secret never lands in git —
-- see /api/invitation-sweep in src/server.ts for the endpoint it calls.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
