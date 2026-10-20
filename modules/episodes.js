// modules/episodes.js
//
// Shared season/episode helpers for modules/seenItems.js and
// modules/track.js. Both modals used to carry near-identical copies of
// the season <option> markup and the fetch/render/fail logic for an
// episode list (~30 lines each); only the row markup differs (checkboxes
// for "seen", click-to-select for "track"), which the caller supplies
// via renderEpisode.
import { fetchSeasonDetails } from '../api.js';

/**
 * @param {Array<{season_number:number}>} seasons
 * @returns {string} HTML for the season <select> options.
 */
export function seasonOptionsHtml(seasons) {
  return seasons.map((s) => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('');
}

/**
 * Load one season's episodes into a container, with loading/error states.
 * @param {object} opts
 * @param {HTMLElement} opts.listEl - Container to render into.
 * @param {number} opts.tvId - TMDB TV id.
 * @param {number} opts.seasonNumber - Season to load.
 * @param {(ep:object)=>string} opts.renderEpisode - Row HTML for one episode.
 */
export async function loadEpisodesInto({ listEl, tvId, seasonNumber, renderEpisode }) {
  listEl.innerHTML = '<p style="text-align:center;padding:1rem;">Loading...</p>';
  try {
    const seasonData = await fetchSeasonDetails(tvId, seasonNumber);
    listEl.innerHTML = (seasonData.episodes || []).map((ep) => renderEpisode(ep)).join('');
  } catch (err) {
    console.error('Error loading episodes', err);
    listEl.innerHTML = '<p style="color:red;text-align:center;">Failed to load episodes.</p>';
  }
}
