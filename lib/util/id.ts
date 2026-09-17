/**
 * Ids are only ever generated in event handlers, never during render — a fresh
 * uuid per render pass would differ between the prerender and hydration.
 *
 * crypto.randomUUID needs a secure context and is missing on iOS Safari before
 * 15.4, so it's feature-detected rather than assumed.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
