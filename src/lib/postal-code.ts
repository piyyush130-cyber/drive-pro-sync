// Canadian postal code format: A1A 1A1. Only the first 3 characters (the
// Forward Sortation Area) are used for service-area matching — coarse, but
// free, geocoding-free, and good enough for how most small schools already
// think about their coverage area.
export function extractFsa(postalCode: string): string | null {
  const cleaned = postalCode.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^[A-Z]\d[A-Z]/);
  return match ? match[0] : null;
}

export function isValidPostalCode(postalCode: string): boolean {
  const cleaned = postalCode.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned);
}

// An empty/unset service-area list means the school hasn't opted into this
// restriction — every address is serviceable by default, so a school never
// gets restricted just by shipping this feature. Once a list is set, an
// unparseable postal code can't be confirmed serviceable, so it's treated
// as out of area rather than silently let through.
export function isPickupAreaServiced(postalCode: string, serviceAreas: string[]): boolean {
  if (!serviceAreas || serviceAreas.length === 0) return true;
  const fsa = extractFsa(postalCode);
  if (!fsa) return false;
  const normalized = serviceAreas.map((a) => a.trim().toUpperCase());
  return normalized.includes(fsa);
}

// Parses the admin-facing comma-separated input ("R2C, R2G, R2J") into a
// clean, deduped, uppercase FSA list — silently drops anything that
// doesn't look like an FSA rather than rejecting the whole save.
export function normalizeServiceAreaInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z]\d[A-Z]$/.test(s)),
    ),
  );
}
