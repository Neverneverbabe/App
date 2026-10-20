// modules/escape.js
// Escape untrusted text (TMDB titles/overviews, search queries, API error
// messages, user-entered watchlist names) before interpolating it into
// innerHTML. Without this, a title or query containing `"` or `<` can break
// out of an attribute / element and inject markup (XSS) into the page.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
// Attributes are quoted in this codebase, and escapeHtml escapes both quote
// characters, so the same helper is safe for attribute values.
export const escapeAttr = escapeHtml;
