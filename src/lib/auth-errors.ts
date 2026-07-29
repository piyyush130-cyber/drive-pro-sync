export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) {
    return "Please confirm your email before signing in — check your inbox for the link.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email or password isn't right. Double-check and try again.";
  }
  if (
    m.includes("user already registered") ||
    (m.includes("email") && m.includes("already") && m.includes("registered"))
  ) {
    return "An account with that email already exists — try signing in instead.";
  }
  if (m.includes("email address") && m.includes("already")) {
    return "That email is already in use by another account.";
  }
  if (m.includes("password") && m.includes("at least")) {
    return "Password must be at least 6 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "You've requested that too many times — wait a few minutes and try again.";
  }
  if (m.includes("network") || m.includes("fetch failed") || m.includes("failed to fetch")) {
    return "Couldn't reach the server — check your connection and try again.";
  }
  return message;
}
