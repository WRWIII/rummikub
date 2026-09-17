/**
 * Runs a snippet synchronously during HTML parsing, before first paint.
 *
 * `type` flips to text/plain on the client so React doesn't warn about
 * rendering script tags, and so the snippet is inert on soft navigations where
 * the component renders normally instead.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
