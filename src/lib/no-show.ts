// Shared between server (booking submission) and client (admin UI badges) —
// no DB column for this, it's derived from bookings.status on read so it
// can never drift out of sync with the actual no-show history.
export const NO_SHOW_ESCALATION_THRESHOLD = 2;

export function countNoShows(bookings: { status: string }[]): number {
  return bookings.filter((b) => b.status === "no_show").length;
}

export function isNoShowFlagged(bookings: { status: string }[]): boolean {
  return countNoShows(bookings) >= NO_SHOW_ESCALATION_THRESHOLD;
}
