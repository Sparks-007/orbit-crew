import type { ZodError } from "zod";

/**
 * localStorage key for the non-sensitive active organization slug.
 * Never store session data or credentials here — the session lives in an
 * httpOnly cookie managed by the server.
 */
export const ACTIVE_ORG_SLUG_KEY = "orbit-crew.active-org-slug";

/** Flattens a Zod error into a per-field message map (first issue wins). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/** Normalizes free-text organization names into a slug suggestion. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Two-letter avatar initials from a display name, falling back to email. */
export function initialsOf(name: string | null, email: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return email.slice(0, 2).toUpperCase();
  const letters = trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  return letters.length > 0 ? letters.toUpperCase() : email.slice(0, 2).toUpperCase();
}

/** First word of a display name (may be empty). */
export function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "";
}

/** Formats an ISO timestamp as a short human-readable date. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
