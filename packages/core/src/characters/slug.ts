import { nanoid } from "nanoid";

/** Derive a URL-safe slug from a display name; fall back to a short id. */
export function slugify(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `char-${nanoid(8)}`;
}
