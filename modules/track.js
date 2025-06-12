// modules/track.js
import { getCurrentUser, saveUserData, deleteUserData, listenToUserCollection } from '../SignIn/firebase_api.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, showToast } from '../ui.js';

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

export function renderTrackSectionInModal(showDetails) {
    const container = document.getElementById('track-progress-container');
    if (!container) return;
    const tracked = getTrackedShow(showDetails.id);
    const seasonVal = tracked ? tracked.season : '';
    const episodeVal = tracked ? tracked.episode : '';
    container.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center;">
            <input type="number" id="track-season-input" placeholder="Season" min="1" style="width:60px" value="${seasonVal}">
            <input type="number" id="track-episode-input" placeholder="Episode" min="1" style="width:70px" value="${episodeVal}">
            <button id="track-save-btn" style="padding:0.3em 0.8em;">Save</button>
        </div>
    `;
    document.getElementById('track-save-btn').onclick = async () => {
        const s = parseInt(document.getElementById('track-season-input').value) || 1;
        const e = parseInt(document.getElementById('track-episode-input').value) || 1;
        await addOrUpdateTrackedShow(showDetails, s, e);
    };
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
                    progressTag.style.backgroundColor = 'rgba(0,0,0,0.7)';
                    progressTag.style.color = '#fff';
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

