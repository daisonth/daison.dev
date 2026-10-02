/** Formats a Date as e.g. "02 Oct 2026" — used consistently across notes and projects. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
