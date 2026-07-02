// SPEC §7 text normalization (CHECK-01). Copied verbatim from 01-RESEARCH.md Code Examples.
// Lossless transforms ONLY — no fuzzy/edit-distance matching (Anti-Pattern).
export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // collapseSpaces
    .replace(/[.!?,;:]+$/, ""); // stripFinalPunctuation (trailing only)
}
