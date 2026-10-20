// App/api.js
import { API_KEY, TMDB_BASE_URL } from './config.js';

// ---------------------------------------------------------------------------
// Central TMDB fetch helper.
//
// Previously every exported function repeated the same fetch / ok-check /
// json boilerplate (~10 copies), threw away the HTTP status in its error
// message, and never cached — so opening the same title repeatedly (hero,
// row, modal, recommendations) re-hit the network every time.
//
// tmdbFetch() keeps the public API of this module identical, but adds:
//  - errors that name the endpoint + HTTP status (much easier to debug)
//  - a short-lived in-memory cache for GET responses (60s), so repeat
//    opens of the same item render instantly
//  - in-flight de-duplication: concurrent calls for the same URL share
//    one request instead of racing several identical ones
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60_000;
const responseCache = new Map(); // url -> { at, data }
const inFlight = new Map();      // url -> Promise<data>

export function clearTmdbCache() {
  responseCache.clear();
}

async function tmdbFetch(path, { cacheTtl = CACHE_TTL_MS } = {}) {
  const url = `${TMDB_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`;
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.at < cacheTtl) return cached.data;
  if (inFlight.has(url)) return inFlight.get(url);

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB request failed (${response.status} ${response.statusText}) for ${path}`);
    }
    const data = await response.json();
    responseCache.set(url, { at: Date.now(), data });
    return data;
  })();

  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}

const withMediaType = (results, mediaType) =>
  (results || []).map((item) => ({ ...item, media_type: mediaType }));

/**
 * Human-readable pricing note for a watch-provider kind.
 * TMDB/JustWatch report HOW a title is offered, not dollar prices (those are
 * set by each service and change constantly), so pricing is shown as the
 * offer type. 'Free' and 'Ads' are genuinely $0 with no subscription/trial.
 */
export function priceNoteForKind(kind) {
  switch (kind) {
    case 'Free': return '$0 — free, no subscription';
    case 'Ads': return '$0 — free with ads, no subscription';
    case 'Stream': return 'Included with subscription';
    case 'Rent': return 'Paid rental — exact price on the service';
    case 'Buy': return 'Paid purchase — exact price on the service';
    default: return '';
  }
}

/**
 * Fetch trending movies or TV shows.
 * @param {'movie'|'tv'} mediaType
 * @param {'day'|'week'} timeWindow
 * @returns {Promise<Array>}
 */
export async function fetchTrendingItems(mediaType = 'movie', timeWindow = 'week') {
  const data = await tmdbFetch(`/trending/${mediaType}/${timeWindow}`);
  return withMediaType(data.results, mediaType);
}

/**
 * Fetch details for a movie or TV show.
 * @param {number} id
 * @param {'movie'|'tv'} type
 * @returns {Promise<Object>}
 */
export async function fetchItemDetails(id, type) {
  return tmdbFetch(`/${type}/${id}?append_to_response=release_dates,content_ratings,external_ids,videos,watch/providers`);
}

/**
 * Fetch search results for a query.
 * @param {string} query
 * @param {'multi'|'movie'|'tv'} type
 * @returns {Promise<Array>}
 */
export async function fetchSearchResults(query, type = 'multi') {
  // Search results go stale fast and are query-specific: don't cache them.
  const data = await tmdbFetch(`/search/${type}?query=${encodeURIComponent(query)}&include_adult=false`, { cacheTtl: 0 });
  return (data.results || []).map((item) => ({
    ...item,
    media_type: item.media_type || (type !== 'multi' ? type : (item.title ? 'movie' : 'tv')),
  }));
}

/**
 * Fetch discovered movies or TV shows based on filters.
 * @param {'movie'|'tv'} mediaType
 * @param {string[]} certificationFilters
 * @param {number} page
 * @returns {Promise<Array>}
 */
export async function fetchDiscoveredItems(mediaType, certificationFilters = [], page = 1, genreFilters = []) {
  let extra = '';
  const validFilters = certificationFilters.filter((f) => f !== '');
  if (validFilters.length > 0) {
    extra += `&certification_country=US&certification=${validFilters.join('|')}`;
  }
  const validGenres = genreFilters.filter((g) => g !== '');
  if (validGenres.length > 0) {
    extra += `&with_genres=${validGenres.join(',')}`;
  }
  const data = await tmdbFetch(
    `/discover/${mediaType}?include_adult=false${extra}&sort_by=popularity.desc&vote_count.gte=100&page=${page}`,
  );
  return withMediaType(data.results, mediaType);
}

/**
 * Fetch discovered items until at least a desired number of results are gathered.
 * @returns {Promise<{items: Array, pagesFetched: number}>}
 */
export async function fetchEnoughDiscoveredItems(mediaType, certificationFilters = [], desiredCount = 20, startPage = 1, genreFilters = []) {
  const results = [];
  let page = startPage;
  let pagesFetched = 0;

  while (results.length < desiredCount) {
    const items = await fetchDiscoveredItems(mediaType, certificationFilters, page, genreFilters);
    pagesFetched++;
    if (items.length === 0) break;
    results.push(...items);
    if (items.length < 20) break;
    page++;
  }

  return { items: results.slice(0, desiredCount), pagesFetched: pagesFetched || 1 };
}

/**
 * Fetch titles that are FREE to watch legally in a region: TMDB discover
 * filtered to the 'free' and 'ads' monetization types (ad-supported services
 * such as Tubi, Pluto TV, The Roku Channel, YouTube free movies). These need
 * no subscription and no trial. Sorted by popularity.
 * @param {'movie'|'tv'} mediaType
 * @param {number} page
 * @param {string} [region='US']
 * @returns {Promise<Array>}
 */
export async function fetchFreeItems(mediaType = 'movie', page = 1, region = 'US') {
  const data = await tmdbFetch(
    `/discover/${mediaType}?include_adult=false&watch_region=${region}&with_watch_monetization_types=free|ads&sort_by=popularity.desc&vote_count.gte=50&page=${page}`,
  );
  return withMediaType(data.results, mediaType);
}

/**
 * Fetch recommended items for a movie or TV show.
 * @returns {Promise<Array>}
 */
export async function fetchRecommendations(id, type) {
  const data = await tmdbFetch(`/${type}/${id}/recommendations`);
  return withMediaType(data.results, type);
}

/**
 * Fetch details for a specific season of a TV show, including episode info.
 * @returns {Promise<Object>}
 */
export async function fetchSeasonDetails(tvId, seasonNumber) {
  return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
}

/**
 * Fetch all movies belonging to a collection.
 * @returns {Promise<Array>}
 */
export async function fetchCollectionItems(collectionId) {
  const data = await tmdbFetch(`/collection/${collectionId}`);
  return data.parts || [];
}

/**
 * Fetch top rated movies or TV shows.
 * @returns {Promise<Array>}
 */
export async function fetchTopRatedItems(mediaType = 'movie', page = 1) {
  const data = await tmdbFetch(`/${mediaType}/top_rated?page=${page}`);
  return withMediaType(data.results, mediaType);
}

/**
 * Fetch classic movies or TV shows released before the year 2000.
 * @returns {Promise<Array>}
 */
export async function fetchClassicItems(mediaType = 'movie', page = 1) {
  const data = await tmdbFetch(
    `/discover/${mediaType}?sort_by=vote_average.desc&vote_count.gte=500&primary_release_date.lte=2000-12-31&page=${page}`,
  );
  return withMediaType(data.results, mediaType);
}

/**
 * Extract legal watch-provider options from a details object returned by
 * fetchItemDetails (which now appends `watch/providers` and `videos`).
 * Pure function — no network call.
 * @param {object} details - TMDB details object.
 * @param {string} [region='US'] - ISO country code key in results.
 * @returns {{link: string, providers: Array<{id:number,name:string,logo:string|null,kind:string}>}}
 *   kind is one of 'Stream' | 'Free' | 'Ads' | 'Rent' | 'Buy'. Providers are
 *   de-duplicated by id, preferring Stream > Free > Ads > Rent > Buy.
 */
export function getWatchProvidersFromDetails(details, region = 'US') {
  const results = details?.['watch/providers']?.results || {};
  const regional = results[region] || results.US || Object.values(results)[0] || {};
  const link = regional.link || '';
  const kinds = [['flatrate', 'Stream'], ['free', 'Free'], ['ads', 'Ads'], ['rent', 'Rent'], ['buy', 'Buy']];
  const byId = new Map();
  for (const [key, label] of kinds) {
    for (const p of regional[key] || []) {
      if (!byId.has(p.provider_id)) {
        byId.set(p.provider_id, {
          id: p.provider_id,
          name: p.provider_name,
          logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
          kind: label,
          priceNote: priceNoteForKind(label),
        });
      }
    }
  }
  return { link, providers: [...byId.values()] };
}

/**
 * Pick the best playable trailer/teaser from a details object
 * (fetchItemDetails appends `videos`). Pure function — no network call.
 * Prefers official YouTube trailers, then any YouTube trailer, teaser, clip.
 * @returns {{key:string, name:string, type:string}|null}
 */
export function getTrailerFromDetails(details) {
  const videos = details?.videos?.results || [];
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key);
  const score = (v) =>
    (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 10 : v.type === 'Clip' ? 20 : 30) + (v.official ? 0 : 5);
  const best = youtube.sort((a, b) => score(a) - score(b))[0];
  return best ? { key: best.key, name: best.name || 'Trailer', type: best.type || 'Trailer' } : null;
}
