// modules/seenItems.js

import { getCurrentUser, saveUserData, deleteUserData, listenToUserCollection } from '../SignIn/firebase_api.js';
import { showCustomAlert, updateSeenButtonStateInModal, showLoadingIndicator, hideLoadingIndicator, showToast } from '../ui.js';
import { fetchSeasonDetails } from '../api.js';

// Local cache for user's seen items
let localUserSeenItemsCache = [];
let unsubscribeSeenItems = null; // Holds the unsubscribe function for the Firestore listener

/**
 * Initializes the Firestore listener for seen items and loads initial data.
 * This should be called after Firebase auth is ready.
 * @param {function} onUpdateCallback - A callback function to run when seen items are updated (e.g., to re-render UI).
 */
export function initializeSeenItemsListener(onUpdateCallback) {
    // Ensure previous listener is unsubscribed to prevent duplicates
    if (unsubscribeSeenItems) {
        unsubscribeSeenItems();
        unsubscribeSeenItems = null;
    }

    const user = getCurrentUser();
    if (user) {
        // listenToUserCollection now handles getting the Firestore instance internally
        unsubscribeSeenItems = listenToUserCollection('seenItems', (items) => {
            localUserSeenItemsCache = items;
            console.log("Real-time Seen Items update:", localUserSeenItemsCache);
            onUpdateCallback(); // Trigger a UI update
            // Also update the modal if it's open
            const modal = document.getElementById('item-detail-modal');
            if (modal.style.display === 'flex') {
                const currentItemData = modal.querySelector('#toggle-seen-btn')?.dataset;
                if (currentItemData) {
                    updateSeenButtonStateInModal(parseInt(currentItemData.id), currentItemData.type, isItemSeen);
                }
            }
        });
    } else {
        localUserSeenItemsCache = [];
        onUpdateCallback(); // Update UI to reflect no seen items if user signs out
    }
}

/**
 * Returns the current list of seen items from the local cache.
 * @returns {Array} An array of seen item objects.
 */
export function getSeenItems() {
    return localUserSeenItemsCache;
}

export function getSeenItem(itemId) {
    return localUserSeenItemsCache.find(it => String(it.id) === String(itemId)) || null;
}

/**
 * Checks if a specific item is marked as seen by the current user.
 * @param {number} itemId - The ID of the item.
 * @param {string} itemType - The type of the item ('movie' or 'tv').
 * @returns {boolean} True if the item is seen, false otherwise.
 */
export function isItemSeen(itemId, itemType) {
    const seenItems = getSeenItems();
    return seenItems.some(item => String(item.id) === String(itemId) && item.type === itemType);
}

export async function saveSeenEpisodes(showDetails, episodesMap = {}, markAll = false) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert('Info', 'Please sign in to mark episodes as seen.');
        return;
    }
    try {
        showLoadingIndicator('Saving seen episodes...');
        if (markAll) {
            const data = {
                type: 'tv',
                id: showDetails.id,
                title: showDetails.name,
                poster_path: showDetails.poster_path,
                backdrop_path: showDetails.backdrop_path,
                overview: showDetails.overview,
                release_date: showDetails.first_air_date,
                vote_average: showDetails.vote_average,
                addedAt: new Date().toISOString(),
                episodes: 'ALL'
            };
            await saveUserData('seenItems', String(showDetails.id), data);
        } else if (Object.keys(episodesMap).length > 0) {
            const data = {
                type: 'tv',
                id: showDetails.id,
                title: showDetails.name,
                poster_path: showDetails.poster_path,
                backdrop_path: showDetails.backdrop_path,
                overview: showDetails.overview,
                release_date: showDetails.first_air_date,
                vote_average: showDetails.vote_average,
                addedAt: new Date().toISOString(),
                episodes: episodesMap
            };
            await saveUserData('seenItems', String(showDetails.id), data);
        } else {
            await deleteUserData('seenItems', String(showDetails.id));
        }
        showToast('Seen episodes saved.');
    } catch (err) {
        console.error('Error saving seen episodes', err);
        showCustomAlert('Error', `Could not save episodes: ${err.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

export async function openSeenEpisodesModal(showDetails) {
    const overlay = document.getElementById('episode-modal');
    if (!overlay) return;

    let seasonSelect = overlay.querySelector('#episode-season-select');
    let episodeList = overlay.querySelector('#episode-list');
    let saveBtn = overlay.querySelector('#save-episodes-btn');
    let seenAllBtn = overlay.querySelector('#seen-all-btn');
    const titleEl = overlay.querySelector('#episode-modal-title');
    const closeBtn = overlay.querySelector('.close-button');

    if (!saveBtn || !seenAllBtn) {
        const actionsDiv = document.createElement('div');
        actionsDiv.id = 'episode-modal-actions';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.justifyContent = 'flex-end';
        actionsDiv.style.gap = '0.5rem';
        actionsDiv.style.marginTop = '1rem';
        seenAllBtn = document.createElement('button');
        seenAllBtn.id = 'seen-all-btn';
        seenAllBtn.textContent = 'Seen All';
        seenAllBtn.style.padding = '0.5rem 1rem';
        saveBtn = document.createElement('button');
        saveBtn.id = 'save-episodes-btn';
        saveBtn.textContent = 'Save';
        saveBtn.style.padding = '0.5rem 1rem';
        actionsDiv.appendChild(seenAllBtn);
        actionsDiv.appendChild(saveBtn);
        overlay.querySelector('.item-detail-modal-content').appendChild(actionsDiv);
    }

    const newSelect = seasonSelect.cloneNode(false);
    seasonSelect.parentNode.replaceChild(newSelect, seasonSelect);
    seasonSelect = newSelect;

    const newList = episodeList.cloneNode(false);
    episodeList.parentNode.replaceChild(newList, episodeList);
    episodeList = newList;

    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    saveBtn = newSave;

    const newSeenAll = seenAllBtn.cloneNode(true);
    seenAllBtn.parentNode.replaceChild(newSeenAll, seenAllBtn);
    seenAllBtn = newSeenAll;

    const newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);

    const existing = getSeenItem(showDetails.id);
    let selected = {};
    let allSelected = false;
    if (existing) {
        if (existing.episodes === 'ALL') {
            allSelected = true;
        } else if (existing.episodes && typeof existing.episodes === 'object') {
            Object.keys(existing.episodes).forEach(season => {
                selected[season] = new Set(existing.episodes[season]);
            });
        }
    }

    function close() {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    newClose.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    titleEl.textContent = showDetails.name || showDetails.title || 'Select Episodes';

    const seasons = (showDetails.seasons || []).filter(s => s.season_number > 0);
    seasonSelect.innerHTML = seasons.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('');

    async function loadSeason(num) {
        episodeList.innerHTML = '<p style="text-align:center;padding:1rem;">Loading...</p>';
        try {
            const seasonData = await fetchSeasonDetails(showDetails.id, num);
            episodeList.innerHTML = seasonData.episodes.map(ep => {
                const overview = ep.overview ? ep.overview.slice(0, 100) + (ep.overview.length > 100 ? '...' : '') : '';
                const checked = allSelected || (selected[num] && selected[num].has(ep.episode_number));
                return `<label class="episode-item" data-season="${num}" data-episode="${ep.episode_number}" style="display:flex;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--border-color);cursor:pointer;">
                            <input type="checkbox" class="episode-checkbox" ${checked ? 'checked' : ''} style="margin-right:0.5rem;">
                            <div>
                                <strong>E${ep.episode_number} - ${ep.name}</strong>
                                <p style="margin:0.2rem 0 0;font-size:0.9rem;color:var(--text-secondary);">${overview}</p>
                            </div>
                        </label>`;
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

    episodeList.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.episode-checkbox');
        if (!checkbox) return;
        const item = checkbox.closest('.episode-item');
        const seasonNumber = parseInt(item.dataset.season, 10);
        const episodeNumber = parseInt(item.dataset.episode, 10);
        if (!selected[seasonNumber]) selected[seasonNumber] = new Set();
        if (checkbox.checked) {
            selected[seasonNumber].add(episodeNumber);
        } else {
            selected[seasonNumber].delete(episodeNumber);
            if (selected[seasonNumber].size === 0) delete selected[seasonNumber];
        }
        allSelected = false;
    });

    seenAllBtn.addEventListener('click', async () => {
        await saveSeenEpisodes(showDetails, {}, true);
        close();
    });

    saveBtn.addEventListener('click', async () => {
        const data = {};
        Object.keys(selected).forEach(season => {
            data[season] = Array.from(selected[season]);
        });
        await saveSeenEpisodes(showDetails, data, false);
        close();
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

/**
 * Toggles the "seen" status of an item in Firestore.
 * @param {object} itemDetails - The full details object of the item.
 * @param {string} itemType - The type of the item ('movie' or 'tv').
 */
export async function toggleSeenStatus(itemDetails, itemType) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert('Info', "Please sign in to mark items as seen.");
        return;
    }

    const itemId = itemDetails.id;
    const isCurrentlySeen = isItemSeen(itemId, itemType);

    try {
        showLoadingIndicator('Updating seen status...');
        if (isCurrentlySeen) {
            await deleteUserData('seenItems', String(itemId));
            showToast(`"${itemDetails.title || itemDetails.name}" marked as unseen.`);
        } else {
            const seenItemData = {
                type: itemType,
                id: itemId, // Explicitly add id for consistent cache structure if needed
                title: itemDetails.title || itemDetails.name,
                poster_path: itemDetails.poster_path,
                backdrop_path: itemDetails.backdrop_path,
                overview: itemDetails.overview,
                release_date: itemDetails.release_date || itemDetails.first_air_date,
                vote_average: itemDetails.vote_average,
                genre_ids: itemDetails.genre_ids || (itemDetails.genres ? itemDetails.genres.map(g => g.id) : []),
                addedAt: new Date().toISOString()
            };
            await saveUserData('seenItems', String(itemId), seenItemData);
            showToast(`"${itemDetails.title || itemDetails.name}" marked as seen.`);
        }
    } catch (error) {
        console.error("Error toggling seen status in Firestore:", error);
        showCustomAlert('Error', `Error updating seen status: ${error.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Sets up a delegated event listener for seen toggle icons on content cards.
 * This listener is attached to the body and handles clicks on '.seen-toggle-icon'.
 * @param {function} onCardClickCallback - The function to call when a card is clicked (used by contentManager).
 */
export function setupDelegatedSeenToggleListener(onCardClickCallback) {
    document.body.addEventListener('click', async (event) => {
        const seenToggleIcon = event.target.closest('.seen-toggle-icon');
        if (seenToggleIcon) {
            event.stopPropagation(); // Prevent card click if the icon itself was clicked
            const card = seenToggleIcon.closest('.content-card');
            if (!card) return;

            const itemId = parseInt(card.dataset.id);
            const itemType = card.dataset.type;

            if (isNaN(itemId) || !itemType) return;

            try {
                const { fetchItemDetails } = await import('../api.js');
                const details = await fetchItemDetails(itemId, itemType);
                if (itemType === 'tv') {
                    await openSeenEpisodesModal(details);
                } else {
                    await toggleSeenStatus(details, itemType);
                }
            } catch (error) {
                console.error("Error handling seen toggle on card (delegated):", error);
                showCustomAlert('Error', `Could not update seen status: ${error.message}`);
            }
        } else {
            // If it's a card click but not on the seen icon, handle as a normal card click
            const card = event.target.closest('.content-card');
            if (card) {
                const id = parseInt(card.dataset.id);
                const type = card.dataset.type;
                if (!isNaN(id) && type) onCardClickCallback(id, type);
            }
        }
    });
}

/**
 * Populates the 'Seen' tab with seen items.
 * @param {string} currentMediaTypeFilter - Current selected media type filter ('movie', 'tv', or '').
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 */
export function populateSeenTab(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick) {
    const seenContentDiv = document.getElementById('seen-content');
    const seenItems = getSeenItems();
    seenContentDiv.innerHTML = '';

    if (seenItems.length === 0) {
        seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items marked as seen yet.</p>`;
    } else {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'search-results-grid';

    let filteredSeenItems = seenItems;

        if (currentMediaTypeFilter) {
            filteredSeenItems = filteredSeenItems.filter(item => item.type === currentMediaTypeFilter);
        }

        if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
            filteredSeenItems = filteredSeenItems.filter(item => {
                const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
                const genreIds = item.genre_ids || [];
                const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
                return ratingOk && categoryOk;
            });
        }

        if (filteredSeenItems.length === 0 && (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0)) {
            seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No seen items matched the selected filter.</p>`;
        } else {
            // Use createContentCardHtml from ui.js
            import('../ui.js').then(({ createContentCardHtml }) => {
                filteredSeenItems.forEach(item => {
                    const displayItem = { ...item, media_type: item.type, poster_path: item.poster_path }; // Ensure compatibility with createContentCardHtml
                    const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeen);
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = cardHtmlString;
                    const movieCardElement = tempDiv.firstElementChild;
                    if (movieCardElement) {
                         movieCardElement.addEventListener('click', (e) => {
                            if (e.target.closest('.seen-toggle-icon')) return;
                            const id = parseInt(movieCardElement.dataset.id);
                            const type = movieCardElement.dataset.type;
                            if (!isNaN(id) && type) onCardClick(id, type);
                        });
                        gridContainer.appendChild(movieCardElement);
                    }
                });
                seenContentDiv.appendChild(gridContainer);
            });
        }
    }
}
