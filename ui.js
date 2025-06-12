// App/ui.js
import { TMDB_IMG_BASE_URL, TMDB_BACKDROP_BASE_URL, VIDSRC_PROVIDERS } from './config.js';
import { getCertification, checkRatingCompatibility } from './ratingUtils.js';
import { getWatchlistsCache } from './modules/libraryManager.js';

// --- Global DOM References ---
const itemDetailModal = document.getElementById('item-detail-modal');
const modalContentArea = document.getElementById('modal-content-area');
const closeModalButton = itemDetailModal.querySelector('.close-button');

// Custom Alert/Loading Modal (replacing native alert/confirm)
const customAlertModal = document.createElement('div');
customAlertModal.id = 'custom-alert-modal';
customAlertModal.className = 'item-detail-modal'; // Reuse modal styling
customAlertModal.innerHTML = `
    <div class="item-detail-modal-content" style="max-width: 350px; text-align: center; padding: 1.5rem;">
        <h3 id="custom-alert-title" style="margin-bottom: 0.8rem; font-size: 1.4rem; color: var(--text-primary);">Alert</h3>
        <p id="custom-alert-message" style="margin-bottom: 1.5rem; color: var(--text-secondary);"></p>
        <button id="custom-alert-ok-btn" class="auth-submit-button" style="margin-top: 0; width: auto; padding: 0.6em 1.5em; border-radius: 8px;">OK</button>
    </div>
`;
document.body.appendChild(customAlertModal);
const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');


// Loading Indicator Modal
const loadingIndicatorModal = document.createElement('div');
loadingIndicatorModal.id = 'loading-indicator-modal';
loadingIndicatorModal.className = 'item-detail-modal'; // Reuse modal styling
loadingIndicatorModal.innerHTML = `
    <div class="item-detail-modal-content" style="max-width: 250px; text-align: center; padding: 1.5rem;">
        <div class="spinner" style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid var(--science-blue); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
        <p id="loading-message" style="color: var(--text-primary);">Loading...</p>
    </div>
`;
document.body.appendChild(loadingIndicatorModal);

// --- Custom Alert Functions ---
/**
 * Displays a custom alert modal to the user.
 * @param {string} title - The title of the alert.
 * @param {string} message - The message content of the alert.
 * @param {'info'|'success'|'error'} [type='info'] - The type of alert to determine text color.
 */
export function showCustomAlert(title, message, type = 'info') {
    document.getElementById('custom-alert-title').textContent = title;
    document.getElementById('custom-alert-message').textContent = message;

    // Set title color based on type
    const titleElement = document.getElementById('custom-alert-title');
    if (type === 'error') {
        titleElement.style.color = 'red';
    } else if (type === 'success') {
        titleElement.style.color = 'green';
    } else {
        titleElement.style.color = 'var(--science-blue)';
    }

    customAlertModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scrolling on body
}

/**
 * Hides the custom alert modal.
 */
export function hideCustomAlert() {
    customAlertModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling on body
}

customAlertOkBtn.addEventListener('click', hideCustomAlert);
// Close modal if user clicks outside the content area
customAlertModal.addEventListener('click', (event) => {
    if (event.target === customAlertModal) {
        hideCustomAlert();
    }
});


// --- Loading Indicator Functions ---
/**
 * Displays a loading indicator modal with an optional message.
 * @param {string} [message='Loading...'] - The message to display under the spinner.
 */
export function showLoadingIndicator(message = 'Loading...') {
    document.getElementById('loading-message').textContent = message;
    loadingIndicatorModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scrolling on body
}

/**
 * Hides the loading indicator modal.
 */
export function hideLoadingIndicator() {
    loadingIndicatorModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling on body
}


// --- Modal Event Listeners (Item Detail Modal) ---
closeModalButton.addEventListener('click', () => {
    itemDetailModal.style.display = 'none';
    modalContentArea.innerHTML = ''; // Clear content when closing
    document.body.style.overflow = ''; // Restore scrolling
});

itemDetailModal.addEventListener('click', (event) => {
    if (event.target === itemDetailModal) {
        itemDetailModal.style.display = 'none';
        modalContentArea.innerHTML = ''; // Clear content when closing
        document.body.style.overflow = ''; // Restore scrolling
    }
});


/**
 * Creates the HTML string for a single content card (movie/show).
 * Includes poster, title, play overlay, and a seen toggle icon.
 * @param {object} item - The movie/TV show object from TMDB. Must have id, title/name, poster_path, media_type.
 * @param {boolean} isLightMode - True if light mode is active, for fallback image colors.
 * @param {function} isItemSeenFn - Function from main.js (now seenItems.js) to check if item is currently marked as seen.
 * @returns {string} - The HTML string for the content card.
 */
export function createContentCardHtml(item, isLightMode, isItemSeenFn) {
    const posterPath = (typeof item.poster_path === 'string' && item.poster_path)
        ? `${TMDB_IMG_BASE_URL}${item.poster_path}`
        : '';
    const title = item.title || item.name || 'Untitled';
    const fallbackImageUrl = `https://placehold.co/200x300/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=${encodeURIComponent(title)}`;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const certification = getCertification(item);
    const certificationBadge = certification !== 'N/A'
        ? `<span class="rating-badge" style="position: absolute; bottom: 8px; left: 8px; background-color: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; z-index: 5;">${certification}</span>`
        : '';

    const isSeen = isItemSeenFn(item.id, mediaType);
    const seenIconClass = isSeen ? 'item-is-seen' : '';
    const seenIconTitle = isSeen ? 'Mark as Unseen' : 'Mark as Seen';

    return `
        <div class="content-card" data-id="${item.id}" data-type="${mediaType}" data-certification="${certification}">
            <div class="image-container">
                <div class="seen-toggle-icon ${seenIconClass}" data-id="${item.id}" data-type="${mediaType}" title="${seenIconTitle}">
                    <i class="fas fa-check"></i>
                </div>
                <img src="${posterPath || fallbackImageUrl}" alt="${title}"
                    onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}"
                    data-fallback="${fallbackImageUrl}">
                ${certificationBadge}
                <div class="overlay">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
            <p>${title}</p>
        </div>
    `;
}

/**
 * Populates a content row HTML element with an array of movie/TV show items.
 * Each item will be rendered as a content card.
 * @param {string} elementId - The ID of the HTML element (e.g., 'trending-now-row') where cards will be appended.
 * @param {Array<object>} items - An array of movie/TV show objects from TMDB.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function to be executed when a content card is clicked (excluding seen toggle).
 * @param {function} isItemSeenFn - Function to check if an item is seen (e.g., seenItems.js's isItemSeen).
 */
export function displayContentRow(elementId, items, isLightMode, onCardClick, isItemSeenFn) {
    const rowElement = document.getElementById(elementId);
    if (!rowElement) {
        console.error(`Element with ID '${elementId}' not found.`);
        return;
    }

    rowElement.innerHTML = ''; // Clear existing content

    if (items && items.length > 0) {
        items.forEach(item => {
            const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            const cardElement = tempDiv.firstElementChild;

            if (cardElement) {
                // Event listener for the card itself will be handled by the delegated listener in main.js
                rowElement.appendChild(cardElement);
            }
        });
    } else {
        rowElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
    }
}

/**
 * Appends new items to an existing grid container, typically used for infinite scrolling.
 * @param {HTMLElement} gridElement - The HTML element representing the grid container.
 * @param {Array<object>} items - An array of movie/TV show objects to append.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function when a card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function appendItemsToGrid(gridElement, items, isLightMode, onCardClick, isItemSeenFn) {
    if (!gridElement) {
        console.error("Grid element not found for appending items.");
        return;
    }
    const loadingMessage = gridElement.querySelector('.loading-message');
    if (loadingMessage) loadingMessage.remove();
    if (gridElement.textContent.includes('No items matched') && items.length > 0) gridElement.innerHTML = '';

    if (items && items.length > 0) {
        items.forEach(item => {
            const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml;
            const cardElement = tempDiv.firstElementChild;

            if (cardElement) {
                // Event listener for the card itself will be handled by the delegated listener in main.js
                gridElement.appendChild(cardElement);
            }
        });
    } else if (gridElement.children.length === 0) {
        gridElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No more content to load.</p>`;
    }
}


/**
 * Displays search results in a grid format.
 * @param {string} elementId - The ID of the container element for search results.
 * @param {Array<object>} results - An array of search result objects.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for card clicks.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function displaySearchResults(elementId, results, isLightMode, onCardClick, isItemSeenFn) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`Container with ID '${elementId}' not found.`);
        return;
    }
    container.innerHTML = '';
    if (results && results.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'search-results-grid';
        results.forEach(item => {
            if (item.media_type === 'movie' || item.media_type === 'tv') {
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild;
                if (cardElement) {
                    // Event listener for the card itself will be handled by the delegated listener in main.js
                    grid.appendChild(cardElement);
                }
            }
        });
        if (grid.children.length > 0) {
            container.appendChild(grid);
        } else {
            container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No movies or TV shows found matching your criteria.</p>`;
        }
    } else {
        container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found.</p>`;
    }
}

/**
 * Displays detailed information about a selected movie or TV show in a modal.
 * @param {object} detailsObject - The detailed movie/TV show object from TMDB API.
 * @param {'movie'|'tv'} itemType - The type of the item ('movie' or 'tv').
 * @param {boolean} isLightMode - True if light mode is active, for fallback image colors.
 */
export function displayItemDetails(detailsObject, itemType, isLightMode) {
    const title = detailsObject.title || detailsObject.name || 'Title Not Available';
    const overview = detailsObject.overview || 'No overview available for this content.';
    const posterPath = detailsObject.poster_path ? `${TMDB_IMG_BASE_URL}${detailsObject.poster_path}` : '';
    const releaseDate = detailsObject.release_date || detailsObject.first_air_date || 'N/A';
    const voteAverage = detailsObject.vote_average ? detailsObject.vote_average.toFixed(1) : 'N/A';
    const genres = detailsObject.genres && detailsObject.genres.length > 0 ? detailsObject.genres.map(g => g.name).join(', ') : 'N/A';
    const certification = getCertification(detailsObject);
    const ageRatingHtml = certification !== 'N/A'
        ? `<p><strong>Age Rating:</strong> <span class="rating-badge" style="background-color: var(--science-blue); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${certification}</span></p>`
        : `<p><strong>Age Rating:</strong> N/A</p>`;

    const fallbackPoster = `https://placehold.co/300x450/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=No+Poster`;

    const seenButtonHtml = `
        <button id="toggle-seen-btn" class="seen-action-button" data-id="${detailsObject.id}" data-type="${itemType}" style="padding: 0.5em 1em; font-size: 0.9em; border-radius: 8px; cursor: pointer; height: fit-content; background-color: var(--card-bg); color: var(--text-primary); border: 1px solid var(--text-secondary);">
            Mark as Seen
        </button>`;

    const folderDropdownHtml = `
        <div class="apple-dropdown" id="add-to-folder-dropdown-modal" style="width: 180px;">
            <div class="dropdown-selected" id="dropdown-selected-text-modal">Add to Watchlist</div>
            <div class="dropdown-list hide-scrollbar" id="dropdown-list-modal" style="display:none; max-height: 200px; overflow-y: auto; border-radius: 10px; margin-top: 4px;"></div>
            <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg); border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
                <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
            </div>
        </div>`;

    const actionsRowHtml = `
        <div class="item-actions-row" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            ${seenButtonHtml}
            ${folderDropdownHtml}
        </div>`;

    const imdbId = detailsObject.external_ids && detailsObject.external_ids.imdb_id;
    let imdbLinkHtmlSegment;
    if (imdbId) {
        imdbLinkHtmlSegment = `<a href="https://www.imdb.com/title/${imdbId}/" target="_blank" style="color: var(--science-blue); text-decoration: none;">View on IMDb</a>`;
    } else {
        imdbLinkHtmlSegment = `Not Available`;
    }
    const imdbLinkHtml = `<p><strong>IMDb:</strong> ${imdbLinkHtmlSegment}</p>`;

    let streamingLinksHtml = '<p style="margin-bottom: 0.5rem;"><strong>Watch On:</strong></p><div class="streaming-links">';
    if (VIDSRC_PROVIDERS && VIDSRC_PROVIDERS.length > 0) {
        VIDSRC_PROVIDERS.forEach(provider => {
            let url = '';
            if (itemType === 'movie') url = `${provider.movieUrl}${detailsObject.id}`;
            else if (itemType === 'tv') url = `${provider.tvUrl}${detailsObject.id}`;
            if (url) {
                streamingLinksHtml += `<a href="${url}" target="_blank" style="display: block; margin-bottom: 0.5rem; color: var(--science-blue); text-decoration: none;">${provider.name}${itemType === 'tv' ? ' (TV Series)' : ''}</a>`;
            }
        });
    } else {
        streamingLinksHtml += '<p style="color: var(--text-secondary); margin-left: 0;">No streaming providers configured.</p>';
    }
    streamingLinksHtml += '</div>';

    modalContentArea.innerHTML = `
    <div class="details-grid">
        <div class="poster-container" style="display: flex; justify-content: center; align-items: flex-start;">
            <img src="${posterPath || fallbackPoster}" alt="${title} Poster" class="poster"
                onerror="this.onerror=null;this.src='${fallbackPoster}';">
        </div>
        <div class="details-info" style="display: flex; flex-direction: column;">
            <h2>${title}</h2>
            ${actionsRowHtml}
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Overview:</strong> ${overview}</p>
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Release Date:</strong> ${releaseDate}</p>
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Rating:</strong> ${voteAverage} / 10</p>
            ${ageRatingHtml}
            <p style="margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.5;"><strong>Genres:</strong> ${genres}</p>
            ${imdbLinkHtml}
            ${streamingLinksHtml}
            ${itemType === 'tv' ? '<div id="track-progress-container" style="margin-top:1rem;"></div>' : ''}
        </div>
    </div>
    `;
    itemDetailModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Updates the state (text and class) of the "Mark as Seen" button in the item detail modal.
 * @param {number} itemId - The ID of the item.
 * @param {string} itemType - The type of the item ('movie' or 'tv').
 * @param {function} isItemSeenFn - Reference to the `isItemSeen` function (from seenItems.js).
 */
export function updateSeenButtonStateInModal(itemId, itemType, isItemSeenFn) {
    const seenButton = document.getElementById('toggle-seen-btn');
    if (seenButton) {
        seenButton.onclick = async () => {
            // Dynamically import toggleSeenStatus to avoid circular dependency
            const { toggleSeenStatus } = await import('./modules/seenItems.js');
            toggleSeenStatus({ id: itemId, media_type: itemType }, itemType);
            // The actual UI update will be handled by the Firestore listener in seenItems.js
            // which will trigger a re-render including this modal's button state.
        };

        if (isItemSeenFn(itemId, itemType)) {
            seenButton.textContent = 'Seen';
            seenButton.classList.add('is-seen');
            seenButton.title = 'Mark as Unseen';
        } else {
            seenButton.textContent = 'Mark as Seen';
            seenButton.classList.remove('is-seen');
            seenButton.title = 'Mark as Seen';
        }
    }
}

/**
 * Renders and manages the watchlist options dropdown within the item detail modal.
 * This function now takes the necessary data and functions as parameters.
 * @param {object} currentItemDetails - The details object of the item currently displayed in the modal.
 * @param {Array<object>} watchlistsCache - The current cache of user watchlists.
 * @param {function} addRemoveItemToFolderFn - The function to add/remove an item from a folder.
 * @param {function} createLibraryFolderFn - The function to create a new library folder.
 */
export function renderWatchlistOptionsInModal(currentItemDetails, watchlistsCache, addRemoveItemToFolderFn, createLibraryFolderFn) {
    const dropdownContainerModal = document.getElementById('add-to-folder-dropdown-modal');
    let dropdownSelectedTextModal = document.getElementById('dropdown-selected-text-modal');
    let dropdownListModal = document.getElementById('dropdown-list-modal');
    const dropdownFooterModal = document.getElementById('dropdown-footer-modal');
    let addNewFolderBtnModal = document.getElementById('add-new-folder-btn-modal');
    const currentItemId = currentItemDetails.id;
    const currentItemType = currentItemDetails.media_type || (currentItemDetails.title ? 'movie' : 'tv');

    // Ensure we always start with the most up-to-date watchlist cache
    watchlistsCache = getWatchlistsCache();

    /**
     * Determines which folders the current item is in.
     * @returns {string[]} An array of folder IDs that contain the current item.
     */
    function getFoldersContainingCurrentItem() {
        return watchlistsCache.filter(watchlist =>
            watchlist.items.some(item => String(item.tmdb_id) === String(currentItemId) && item.item_type === currentItemType)
        ).map(watchlist => watchlist.id);
    }

    let currentlySelectedWatchlistIds = getFoldersContainingCurrentItem(); // Initialize with current state

    /**
     * Updates the HTML display of the dropdown list and the selected text based on current item's watchlist status.
     */
    function updateDropdownDisplay() {
        watchlistsCache = getWatchlistsCache(); // Ensure we have the latest cache
        currentlySelectedWatchlistIds = getFoldersContainingCurrentItem(); // Refresh selection status
        const allWatchlists = watchlistsCache || [];

        dropdownListModal.innerHTML = allWatchlists.length
            ? allWatchlists.map(watchlist => `
                <div class="dropdown-item ${currentlySelectedWatchlistIds.includes(watchlist.id) ? 'item-selected' : ''}" data-folder-id="${watchlist.id}">
                    ${watchlist.name}
                    <span class="checkmark">✔</span>
                </div>`).join('')
            : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No watchlists yet. Click '+' below.</div>`;

        if (currentlySelectedWatchlistIds.length === 0) {
            dropdownSelectedTextModal.textContent = 'Add to Watchlist';
        } else if (currentlySelectedWatchlistIds.length === 1) {
            const selectedName = allWatchlists.find(wl => wl.id === currentlySelectedWatchlistIds[0])?.name || 'Selected';
            dropdownSelectedTextModal.textContent = selectedName;
        } else {
            dropdownSelectedTextModal.textContent = `${currentlySelectedWatchlistIds.length} watchlists selected`;
        }
    }

    updateDropdownDisplay(); // Initial display update when modal opens

    // Ensure listeners are added only once or properly managed
    // Remove existing listeners to prevent duplicates before adding new ones
    const oldDropdownSelectedTextModal = dropdownSelectedTextModal.cloneNode(true);
    dropdownSelectedTextModal.parentNode.replaceChild(oldDropdownSelectedTextModal, dropdownSelectedTextModal);
    dropdownSelectedTextModal = oldDropdownSelectedTextModal;
    const newDropdownSelectedTextModal = dropdownSelectedTextModal;

    newDropdownSelectedTextModal.onclick = (event) => {
        event.stopPropagation();
        const isOpen = dropdownListModal.style.display === 'block';
        dropdownListModal.style.display = isOpen ? 'none' : 'block';
        dropdownFooterModal.style.display = isOpen ? 'none' : 'block';
        if (isOpen) {
            newDropdownSelectedTextModal.focus();
        }
        updateDropdownDisplay();
    };

    // Remove existing listener for dropdown list to prevent duplicates
    const oldDropdownListModal = dropdownListModal.cloneNode(true);
    dropdownListModal.parentNode.replaceChild(oldDropdownListModal, dropdownListModal);
    dropdownListModal = oldDropdownListModal;
    const newDropdownListModal = dropdownListModal;

    newDropdownListModal.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemElement = e.target.closest('.dropdown-item');
        if (!itemElement || !itemElement.dataset.folderId) return;

        const folderId = itemElement.dataset.folderId;
        if (addRemoveItemToFolderFn) {
            await addRemoveItemToFolderFn(folderId, currentItemDetails, currentItemType);
        }
        updateDropdownDisplay();
    });

    // Remove existing listener for add new folder button to prevent duplicates
    const oldAddNewFolderBtnModal = addNewFolderBtnModal.cloneNode(true);
    addNewFolderBtnModal.parentNode.replaceChild(oldAddNewFolderBtnModal, addNewFolderBtnModal);
    addNewFolderBtnModal = oldAddNewFolderBtnModal;
    const newAddNewFolderBtnModal = addNewFolderBtnModal;

    newAddNewFolderBtnModal.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newFolderName = prompt("Enter new watchlist name:");
        if (newFolderName && newFolderName.trim() !== "") {
            if (createLibraryFolderFn) {
                await createLibraryFolderFn(newFolderName.trim());
            }
        }
        updateDropdownDisplay();
    });

    // Event listener to close dropdown when clicking outside
    const dropdownOutsideClickListener = (event) => {
        if (!dropdownContainerModal.contains(event.target) && dropdownListModal.style.display === 'block') {
            dropdownListModal.style.display = 'none';
            dropdownFooterModal.style.display = 'none';
        }
    };
    // Ensure only one listener is active to prevent duplicates
    document.removeEventListener('click', dropdownOutsideClickListener);
    document.addEventListener('click', dropdownOutsideClickListener);
}


/**
 * Updates the hero section with a new image, title, and description.
 * @param {string|object} imageUrl - The URL of the hero image (should be a string).
 * @param {string} title - The title to display.
 * @param {string} description - The description to display.
 */
export function updateHeroSection(imageUrl, title, description) {
    const heroImage = document.getElementById('hero-image-element');
    const heroContent = document.querySelector('.hero-section .content');
    heroImage.src = (typeof imageUrl === 'string') ? imageUrl : '';
    if (heroContent) {
        heroContent.innerHTML = `
            <h2>${title || ''}</h2>
            <p>${description || ''}</p>
        `;
    }
}

/**
 * Updates all theme-dependent UI elements (icons, backgrounds, etc.) for dark/light mode.
 * @param {boolean} isLightMode - True if light mode is active.
 */
export function updateThemeDependentElements(isLightMode) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
        if (isLightMode) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = '';
        } else {
            sunIcon.style.display = '';
            moonIcon.style.display = 'none';
        }
    }

    document.querySelectorAll('.apple-dropdown, .dropdown-selected, .dropdown-list, .dropdown-footer').forEach(el => {
        if (isLightMode) {
            el.classList.add('light-mode');
        } else {
            el.classList.remove('light-mode');
        }
    });

    document.querySelectorAll('.item-detail-modal-content').forEach(el => {
        if (isLightMode) {
            el.style.backgroundColor = '#f5f5f7';
            el.style.color = '#1d1d1f';
        } else {
            el.style.backgroundColor = '';
            el.style.color = '';
        }
    });
}

// --- Toast Notification ---
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
toastContainer.style.position = 'fixed';
toastContainer.style.bottom = '20px';
toastContainer.style.left = '50%';
toastContainer.style.transform = 'translateX(-50%)';
toastContainer.style.zIndex = '1000';
document.body.appendChild(toastContainer);

/**
 * Shows a temporary toast notification.
 * @param {string} message - Message to display.
 * @param {number} [duration=2000] - Duration in ms.
 */
export function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.background = 'rgba(0, 0, 0, 0.85)';
    toast.style.color = '#fff';
    toast.style.padding = '0.5rem 1rem';
    toast.style.marginTop = '0.5rem';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}
