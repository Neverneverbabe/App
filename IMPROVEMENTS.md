# Improvements made (2026-10-20)

A focused, backwards-compatible pass. No features were removed and no
exported function signatures changed, so the rest of the app did not need
to be touched. Everything below is verified with `npm run check` and by
serving the app locally.

## 1. Security — reflected / stored XSS in `innerHTML`
The app builds HTML with template literals and `innerHTML` in ~87 places.
Two of the highest-traffic sinks interpolated *unescaped* data:

- **`modules/search.js`** — your own search query (and the API error
  message) were written straight into `innerHTML`. Typing
  `<img src=x onerror=...>` as a search would have executed in the page.
  Now escaped via the new `escapeHtml()` in **`modules/escape.js`**.
- **`ui.js` `createContentCardHtml()`** — TMDB titles were interpolated
  unescaped into element text, `alt`, `data-title`, and other attributes.
  A title containing `"` or `<` could break the card or inject markup.
  Title, certification, id/type and poster are now escaped.

Note: `escape.js` is the tool to use for the remaining sinks (hero,
modal details, episode lists, watchlist names — including the native
`prompt()` names saved to Firestore). Those render other users'/TMDB
data and should be migrated the same way.

## 2. Service worker — users were stuck on old code forever
The old worker was cache-first for everything, so once cached, a file
was *never* re-fetched until someone manually bumped `CACHE_NAME`. It
also omitted all of `modules/*.js` from the precache, could resolve
`respondWith()` to `undefined` on a network failure, and one bad URL in
`cache.addAll()` failed the whole install.

New worker (`watch-tv-cache-v3`):
- Same-origin shell: **stale-while-revalidate** (instant load, fresh
  copy next visit, `skipWaiting` + `clients.claim`).
- TMDB API and all Firebase/Auth/Firestore traffic: **network-only,
  never cached** (prevents leaking one user's data to the next user on
  a shared device, and preserves real-time updates).
- Precache uses `Promise.allSettled`, includes all modules + `escape.js`.
- Offline fetch always resolves to a real `503` Response.

## 3. Performance — 3.0 MB of logos shown at ~40 px
- `IMDb.png`: 1024×1024, **1,084,808 → 24,081 bytes** (shown at 24–48 px).
- `Sad Face.png`: 1024×1024, **1,958,325 → 109,858 bytes** (header, 2.5 em).
- PWA icons recompressed (~90 KB saved total). Working tree: **3.2 MB → 1.2 MB**.
- Card posters now `loading="lazy" decoding="async" width="200" height="300"`
  (defers off-screen posters, reduces layout shift).
- `index.html`: added `<meta name="description">`, `theme-color`, and
  `preconnect` for `image.tmdb.org` / Google Fonts.

## 4. API layer — `api.js` de-duplicated + cached
All ~10 functions repeated fetch/ok/json boilerplate and threw generic
errors with no status. They now share one `tmdbFetch()` helper that:
- reports endpoint + HTTP status on failure,
- caches GET responses in-memory for 60 s (search excluded),
- de-duplicates concurrent identical requests.
Also fixed `fetchEnoughDiscoveredItems()`, whose `pagesFetched` count
skipped the last page.

## 5. Accessibility — cards were mouse-only
Cards (`<div>`) could not be reached or activated by keyboard, despite
the STYLEGUIDE requiring focusable, labelled actions. Cards now render
with `tabindex="0" role="button" aria-label="<title>"`, and `main.js`
activates a focused card on Enter/Space via the existing delegated
click handler (toggle icons are excluded, so they keep their own action).

## 6. Repo hygiene
- Added `.gitignore` (`node_modules/`, `.env`, `.firebase/`, logs, dist).
- `package.json`: added `npm start` (static server) and `npm run check`
  (syntax-checks every shipped JS module). There were previously no
  scripts at all.

## Not done — deliberately, needs your call
These are real, but changing them unilaterally would be a bigger,
riskier rewrite:
1. **`index.html` is 2,063 lines** with all CSS inline and every module
   also loaded via its own `<script type="module">` tag even though
   `main.js` imports them. Splitting CSS out and loading only `main.js`
   is the next structural step.
2. **Duplicated season/episode UI** in `modules/seenItems.js` and
   `modules/track.js` (~200 near-identical lines) should be one shared
   module.
3. **Remaining `innerHTML` sinks** listed in §1 should be migrated to
   `escapeHtml()` or `textContent`.
4. **`package.json` declares React/Tailwind/Firebase dependencies the
   shipped app doesn't use** (Firebase loads from CDN, React components
   in `react/` are demos). Either adopt a bundler or drop them.
5. **TMDB API key is committed in `config.js`.** That's normal for a
   browser TMDB key, but restrict it by domain in your TMDB account,
   and keep Firebase rules locked down — the Firebase config is public
   by design, so Firestore security rules are your actual protection.
6. No tests or linter. `npm run check` is a start; adding ESLint +
   a smoke test would be next.
