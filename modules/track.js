// modules/track.js
import { getCurrentUser, saveUserData, deleteUserData, listenToUserCollection } from '../SignIn/firebase_api.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, showToast } from '../ui.js';
import { fetchSeasonDetails } from '../api.js';

let trackedShowsCache = [];
let unsubscribeTrack = null;

export function initializeTrackListener(onUpdateCallback) {
    if (unsubscribeTrack) {
        unsubscribeTrack();
        unsubscribeTrack = null;
    }
    const user = getCurrentUser();
    if (user) {
        unsubscribeTrack = listenToUserCollection('trackedShows', (items) => {
            trackedShowsCache = items;
            onUpdateCallback();
        });
    } else {
        trackedShowsCache = [];
        onUpdateCallback();
    }
}

export function getTrackedShows() {
    return trackedShowsCache;
}

export function getTrackedShow(showId) {
    return trackedShowsCache.find(item => String(item.id) === String(showId)) || null;
}

export async function addOrUpdateTrackedShow(showDetails, season, episode) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert('Info', 'Please sign in to track progress.');
        return;
    }
    try {
        showLoadingIndicator('Saving progress...');
        const data = {
            id: showDetails.id,
            title: showDetails.name || showDetails.title,
            poster_path: showDetails.poster_path,
            season,
            episode,
            updatedAt: new Date().toISOString()
        };
        await saveUserData('trackedShows', String(showDetails.id), data);
        showToast('Progress saved.');
    } catch (error) {
        console.error('Error saving tracked show:', error);
        showCustomAlert('Error', `Could not save progress: ${error.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

export async function removeTrackedShow(showId) {
    try {
        await deleteUserData('trackedShows', String(showId));
        showToast('Progress removed.');
    } catch (error) {
        console.error('Error removing tracked show:', error);
        showCustomAlert('Error', `Could not remove progress: ${error.message}`);
    }
}

export async function openEpisodeModal(showDetails) {
    const overlay = document.getElementById('episode-modal');
    if (!overlay) return;

    let seasonSelect = overlay.querySelector('#episode-season-select');
    let episodeList = overlay.querySelector('#episode-list');
    let saveBtn = overlay.querySelector('#save-episodes-btn');
    const titleEl = overlay.querySelector('#episode-modal-title');
    const closeBtn = overlay.querySelector('.close-button');

    const newSelect = seasonSelect.cloneNode(false);
    seasonSelect.parentNode.replaceChild(newSelect, seasonSelect);
    seasonSelect = newSelect;

    const newList = episodeList.cloneNode(false);
    episodeList.parentNode.replaceChild(newList, episodeList);
    episodeList = newList;

    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    saveBtn = newSave;

    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);

    let selectedSeason = null;
    let selectedEpisode = null;

    function close() {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    newClose.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    titleEl.textContent = showDetails.name || showDetails.title || 'Select Episode';

    const seasons = (showDetails.seasons || []).filter(s => s.season_number > 0);
    seasonSelect.innerHTML = seasons.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('');

    async function loadSeason(num) {
        episodeList.innerHTML = '<p style="text-align:center;padding:1rem;">Loading...</p>';
        try {
            const seasonData = await fetchSeasonDetails(showDetails.id, num);
            episodeList.innerHTML = seasonData.episodes.map(ep => {
                const overview = ep.overview ? ep.overview.slice(0, 100) + (ep.overview.length > 100 ? '...' : '') : '';
                const selClass = (selectedSeason === num && selectedEpisode === ep.episode_number) ? 'selected' : '';
                return `<div class="episode-item ${selClass}" data-season="${num}" data-episode="${ep.episode_number}" style="padding:0.5rem 0;border-bottom:1px solid var(--border-color);cursor:pointer;">
                            <strong>E${ep.episode_number} - ${ep.name}</strong>
                            <p style="margin:0.2rem 0 0;font-size:0.9rem;color:var(--text-secondary);">${overview}</p>
                        </div>`;
            }).join('');
        } catch (err) {
            console.error('Error loading episodes', err);
            episodeList.innerHTML = '<p style="color:red;text-align:center;">Failed to load episodes.</p>';
        }
    }

    seasonSelect.addEventListener('change', () => {
        const val = parseInt(seasonSelect.value, 10);
        if (!isNaN(val)) loadSeason(val);
    });

    episodeList.addEventListener('click', (e) => {
        const item = e.target.closest('.episode-item');
        if (!item) return;
        selectedSeason = parseInt(item.dataset.season, 10);
        selectedEpisode = parseInt(item.dataset.episode, 10);
        episodeList.querySelectorAll('.episode-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
    });

    saveBtn.addEventListener('click', async () => {
        if (selectedSeason && selectedEpisode) {
            await addOrUpdateTrackedShow(showDetails, selectedSeason, selectedEpisode);
            close();
            const container = document.getElementById('track-progress-container');
            if (container) renderTrackSectionInModal(showDetails);
        }
    });

    if (seasons.length > 0) {
        seasonSelect.value = seasons[0].season_number;
        loadSeason(seasons[0].season_number);
    } else {
        episodeList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">No seasons available.</p>';
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

export function renderTrackSectionInModal(showDetails) {
    const container = document.getElementById('track-progress-container');
    if (!container) return;
    const tracked = getTrackedShow(showDetails.id);
    const progressText = tracked ? `Season ${tracked.season}, Episode ${tracked.episode}` : 'No progress saved';
    container.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center;">
            <span style="flex:1;">${progressText}</span>
            <button id="track-select-episode-btn" style="padding:0.3em 0.8em;">Choose Episode</button>
            ${tracked ? '<button id="track-remove-btn" style="padding:0.3em 0.8em;">Remove</button>' : ''}
        </div>
    `;
    document.getElementById('track-select-episode-btn').onclick = () => {
        openEpisodeModal(showDetails);
    };
    if (tracked) {
        document.getElementById('track-remove-btn').onclick = async () => {
            await removeTrackedShow(showDetails.id);
            renderTrackSectionInModal(showDetails);
        };
    }
}

export function populateTrackTab(isLightMode, onCardClick) {
    const container = document.getElementById('track-content');
    const items = getTrackedShows();
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<p style="padding:1rem;color:var(--text-secondary);">No tracked shows yet.</p>';
    } else {
        const grid = document.createElement('div');
        grid.className = 'search-results-grid';
        import('../ui.js').then(({ createContentCardHtml }) => {
            items.forEach(item => {
                const displayItem = { id: item.id, name: item.title, poster_path: item.poster_path, media_type: 'tv' };
                const temp = document.createElement('div');
                temp.innerHTML = createContentCardHtml(displayItem, isLightMode, () => false);
                const card = temp.firstElementChild;
                if (card) {
                    const progressTag = document.createElement('div');
                    progressTag.textContent = `S${item.season}:E${item.episode}`;
                    progressTag.style.position = 'absolute';
                    progressTag.style.bottom = '8px';
                    progressTag.style.right = '8px';
                    progressTag.style.backgroundColor = 'rgba(var(--black-rgb), 0.7)';
                    progressTag.style.color = 'var(--white)';
                    progressTag.style.padding = '2px 6px';
                    progressTag.style.borderRadius = '4px';
                    progressTag.style.fontSize = '0.75rem';
                    card.querySelector('.image-container').appendChild(progressTag);
                    card.addEventListener('click', (e) => {
                        if (e.target.closest('.seen-toggle-icon')) return;
                        const id = parseInt(card.dataset.id);
                        if (!isNaN(id)) onCardClick(id, 'tv');
                    });
                    grid.appendChild(card);
                }
            });
            container.appendChild(grid);
        });
    }
}

