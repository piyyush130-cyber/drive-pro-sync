import { randomBytes, createHash } from "node:crypto";

// The raw token only ever exists in memory and in the outgoing email/SMS —
// only its hash is ever written to the database, so a DB dump/backup leak
// can't be used to replay a login link or session directly.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
