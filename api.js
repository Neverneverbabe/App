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
  return tmdbFetch(`/${type}/${id}?append_to_response=release_dates,content_ratings,external_ids`);
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
