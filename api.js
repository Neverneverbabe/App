// App/api.js
import { API_KEY, TMDB_BASE_URL } from './config.js';

/**
 * Fetch trending movies or TV shows.
 * @param {'movie'|'tv'} mediaType
 * @param {'day'|'week'} timeWindow
 * @returns {Promise<Array>}
 */
export async function fetchTrendingItems(mediaType = 'movie', timeWindow = 'week') {
    const url = `${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}?api_key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trending items');
    const data = await response.json();
    return (data.results || []).map(item => ({ ...item, media_type: mediaType }));
}

/**
 * Fetch details for a movie or TV show.
 * @param {number} id
 * @param {'movie'|'tv'} type
 * @returns {Promise<Object>}
 */
export async function fetchItemDetails(id, type) {
    const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=release_dates,content_ratings,external_ids`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch item details');
    return await response.json();
}

/**
 * Fetch search results for a query.
 * @param {string} query
 * @param {'multi'|'movie'|'tv'} type
 * @returns {Promise<Array>}
 */
export async function fetchSearchResults(query, type = 'multi') {
    const url = `${TMDB_BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch search results');
    const data = await response.json();
    return (data.results || []).map(item => ({ ...item, media_type: item.media_type || (type !== 'multi' ? type : (item.title ? 'movie' : 'tv')) }));
}

/**
 * Fetch discovered movies or TV shows based on filters.
 * @param {'movie'|'tv'} mediaType
 * @param {string[]} certificationFilters - Array of selected certification codes (e.g., ['PG', 'R']).
 * @param {number} page - The page number to fetch.
 * @returns {Promise<Array>}
 */
export async function fetchDiscoveredItems(mediaType, certificationFilters = [], page = 1) {
    let certQueryParam = '';
    if (certificationFilters.length > 0) {
        const validFilters = certificationFilters.filter(f => f !== ""); // Exclude "All Ratings" placeholder
        if (validFilters.length > 0) {
            certQueryParam = `&certification_country=US&certification=${validFilters.join('|')}`;
        }
    }
    const url = `${TMDB_BASE_URL}/discover/${mediaType}?api_key=${API_KEY}&include_adult=false${certQueryParam}&sort_by=popularity.desc&vote_count.gte=100&page=${page}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch discovered ${mediaType} items`);
    const data = await response.json();
    return (data.results || []).map(item => ({ ...item, media_type: mediaType }));
}

/**
 * Fetch discovered items until at least a desired number of results are gathered.
 * This is useful when filters reduce the amount of content returned by a single page.
 * @param {'movie'|'tv'} mediaType
 * @param {string[]} certificationFilters
 * @param {number} desiredCount - Minimum number of items desired.
 * @param {number} [startPage=1] - Page number to start fetching from.
 * @returns {Promise<{items: Array, pagesFetched: number}>}
 */
export async function fetchEnoughDiscoveredItems(mediaType, certificationFilters = [], desiredCount = 20, startPage = 1) {
    let results = [];
    let page = startPage;
    let pagesFetched = 0;

    while (results.length < desiredCount) {
        const items = await fetchDiscoveredItems(mediaType, certificationFilters, page);
        if (items.length === 0) break;
        results = results.concat(items);
        if (items.length < 20) break; // Reached end of available items
        page++;
        pagesFetched++;
    }

    return { items: results.slice(0, desiredCount), pagesFetched: pagesFetched || 1 };
}
