// App/ui.js
import { TMDB_IMG_BASE_URL, TMDB_BACKDROP_BASE_URL, VIDSRC_PROVIDERS } from './config.js';
import { getCertification, checkRatingCompatibility } from './ratingUtils.js'; // Updated import path

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
 * @param {function} isItemSeenFn - Function from main.js to check if item is currently marked as seen.
 * @returns {string} - The HTML string for the content card.
 */
export function createContentCardHtml(item, isLightMode, isItemSeenFn) {
    const posterPath = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : '';
    const title = item.title || item.name || 'Untitled';
    // Fallback image URL for when poster_path is missing or fails to load
    const fallbackImageUrl = `https://placehold.co/200x300/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=${encodeURIComponent(title)}`;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv'); // Determine type if not explicitly provided
    const certification = getCertification(item); // Get age rating using the new ratingUtils function
    const certificationBadge = certification !== 'N/A' ? `<span class="rating-badge" style="position: absolute; bottom: 8px; left: 8px; background-color: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; z-index: 5;">${certification}</span>` : '';

    // Check if the item is seen using the provided function
    const isSeen = isItemSeenFn(item.id, mediaType);
    const seenIconClass = isSeen ? 'item-is-seen' : ''; // Apply class if seen
    const seenIconTitle = isSeen ? 'Mark as Unseen' : 'Mark as Seen'; // Dynamic title for accessibility

    return `
        <div class="content-card" data-id="${item.id}" data-type="${mediaType}" data-certification="${certification}">
            <div class="image-container">
                <div class="seen-toggle-icon ${seenIconClass}" data-id="${item.id}" data-type="${mediaType}" title="${seenIconTitle}">
                    <i class="fas fa-check"></i>
                </div>
                <img src="${posterPath || fallbackImageUrl}" alt="${title}"
                    onerror="this.onerror=null;this.src='${fallbackImageUrl}';">
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
 * @param {function} isItemSeenFn - Function to check if an item is seen (e.g., main.js's isItemSeen).
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
            // Only create a card if a poster path exists to avoid empty cards
            // Or use a generic placeholder if no poster, but ensure item is renderable.
            if (item.poster_path || item.backdrop_path) { // Allow backdrop_path for display if no poster
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div'); // Create a temporary div to parse HTML string
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild; // Get the actual DOM element

                if (cardElement) {
                    // Add click listener to the whole card, but prevent it if the seen toggle is clicked
                    cardElement.addEventListener('click', (e) => {
                        if (e.target.closest('.seen-toggle-icon')) {
                            // If the click originated from within the seen-toggle-icon, do nothing for the card click
                            return;
                        }
                        const id = parseInt(cardElement.dataset.id);
                        const type = cardElement.dataset.type;
                        if (!isNaN(id) && type) {
                            onCardClick(id, type);
                        }
                    });
                    rowElement.appendChild(cardElement);
                }
            }
        });
    } else {
        // Display a message if no content is found
        rowElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No content found in this category.</p>`;
    }

    // After rendering, re-attach event listeners for seen toggle icons on newly added cards
    if (window.attachSeenToggleListenersToCards) {
        window.attachSeenToggleListenersToCards(rowElement);
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

    // If the grid previously had a "loading message", remove it
    const loadingMessage = gridElement.querySelector('.loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
    // If the grid had a "no content" message, remove it if new items are coming
    if (gridElement.textContent.includes('No items matched') && items.length > 0) {
        gridElement.innerHTML = '';
    }

    if (items && items.length > 0) {
        items.forEach(item => {
            if (item.poster_path || item.backdrop_path) {
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild;

                if (cardElement) {
                    cardElement.addEventListener('click', (e) => {
                        if (e.target.closest('.seen-toggle-icon')) {
                            return;
                        }
                        const id = parseInt(cardElement.dataset.id);
                        const type = cardElement.dataset.type;
                        if (!isNaN(id) && type) {
                            onCardClick(id, type);
                        }
                    });
                    gridElement.appendChild(cardElement);
                }
            }
        });
        if (window.attachSeenToggleListenersToCards) {
            window.attachSeenToggleListenersToCards(gridElement);
        }
    } else if (gridElement.children.length === 0) {
        // If no items were added and the grid is still empty, show a message
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

    container.innerHTML = ''; // Clear previous results

    if (results && results.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'search-results-grid'; // Apply grid styling

        results.forEach(item => {
            // Only display movies and TV shows, and only if they have a poster
            if ((item.media_type === 'movie' || item.media_type === 'tv') && (item.poster_path || item.backdrop_path)) {
                const cardHtml = createContentCardHtml(item, isLightMode, isItemSeenFn);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                const cardElement = tempDiv.firstElementChild;

                if (cardElement) {
                    cardElement.addEventListener('click', (e) => {
                        if (e.target.closest('.seen-toggle-icon')) {
                            return;
                        }
                        const id = parseInt(cardElement.dataset.id);
                        const type = cardElement.dataset.type;
                        if (!isNaN(id) && type) {
                            onCardClick(id, type);
                        }
                    });
                    grid.appendChild(cardElement);
                }
            }
        });
        if (grid.children.length > 0) {
            container.appendChild(grid);
            if (window.attachSeenToggleListenersToCards) {
                window.attachSeenToggleListenersToCards(grid);
            }
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
    console.log("Displaying item details:", detailsObject);

    const title = detailsObject.title || detailsObject.name || 'Title Not Available';
    const overview = detailsObject.overview || 'No overview available for this content.';
    const posterPath = detailsObject.poster_path ? `${TMDB_IMG_BASE_URL}${detailsObject.poster_path}` : '';
    const releaseDate = detailsObject.release_date || detailsObject.first_air_date || 'N/A';
    const voteAverage = detailsObject.vote_average ? detailsObject.vote_average.toFixed(1) : 'N/A';
    const genres = detailsObject.genres && detailsObject.genres.length > 0 ? detailsObject.genres.map(g => g.name).join(', ') : 'N/A';
    const certification = getCertification(detailsObject); // Use the utility function
    const ageRatingHtml = certification !== 'N/A'
        ? `<p><strong>Age Rating:</strong> <span class="rating-badge" style="background-color: var(--science-blue); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">${certification}</span></p>`
        : `<p><strong>Age Rating:</strong> N/A</p>`;

    // Fallback poster image if poster_path is null or fails to load
    const fallbackPoster = `https://placehold.co/300x450/${isLightMode ? 'BBB' : '555'}/${isLightMode ? '333' : 'FFF'}?text=No+Poster`;

    // HTML for the "Mark as Seen" button. Its state (seen/unseen) will be updated by main.js.
    const seenButtonHtml = `
        <button id="toggle-seen-btn" class="seen-action-button" data-id="${detailsObject.id}" data-type="${itemType}" style="padding: 0.5em 1em; font-size: 0.9em; border-radius: 8px; cursor: pointer; height: fit-content; background-color: var(--card-bg); color: var(--text-primary); border: 1px solid var(--text-secondary);">
            Mark as Seen
        </button>`;

    // HTML for the "Add to Watchlist" dropdown. Its options and state will be updated by main.js.
    const folderDropdownHtml = `
        <div class="apple-dropdown" id="add-to-folder-dropdown-modal" style="width: 180px;">
            <div class="dropdown-selected" id="dropdown-selected-text-modal">Add to Watchlist</div>
            <div class="dropdown-list hide-scrollbar" id="dropdown-list-modal" style="display:none; max-height: 200px; overflow-y: auto; border-radius: 10px; margin-top: 4px;"></div>
            <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg); border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
                <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
            </div>
        </div>`;

    // Combines the action buttons for the modal
    const actionsRowHtml = `
        <div class="item-actions-row" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            ${seenButtonHtml}
            ${folderDropdownHtml}
        </div>`;

    // IMDb link, if an IMDb ID is available
    const imdbId = detailsObject.external_ids && detailsObject.external_ids.imdb_id;
    let imdbLinkHtmlSegment;
    if (imdbId) {
        imdbLinkHtmlSegment = `<a href="https://www.imdb.com/title/${imdbId}/" target="_blank" style="color: var(--science-blue); text-decoration: none;">View on IMDb</a>`;
    } else {
        imdbLinkHtmlSegment = `Not Available`;
    }
    const imdbLinkHtml = `<p><strong>IMDb:</strong> ${imdbLinkHtmlSegment}</p>`;

    // Streaming links from VIDSRC_PROVIDERS
    let streamingLinksHtml = '<p style="margin-bottom: 0.5rem;"><strong>Watch On:</strong></p><div class="streaming-links">';
    if (VIDSRC_PROVIDERS && VIDSRC_PROVIDERS.length > 0) {
        VIDSRC_PROVIDERS.forEach(provider => {
            let url = '';
            // Construct URL based on item type and provider's base URLs
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

    // Populate the modal content area with all the generated HTML
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
        </div>
    </div>
    `;
    itemDetailModal.style.display = 'flex'; // Make the modal visible
    document.body.style.overflow = 'hidden'; // Prevent body scrolling when modal is open

    // These functions are called by main.js after displayItemDetails to ensure
    // data from main.js (like seen status and watchlists) is available.
    // updateSeenButtonStateInModal(detailsObject.id, itemType, isItemSeen);
    // renderWatchlistOptionsInModal(detailsObject);
}

/**
 * Updates the state (text and class) of the "Mark as Seen" button in the item detail modal.
 * This function should be called by main.js after its `isItemSeen` status is known.
 * @param {number} itemId - The ID of the item.
 * @param {string} itemType - The type of the item ('movie' or 'tv').
 * @param {function} isItemSeenFn - Reference to the `isItemSeen` function from main.js.
 */
export function updateSeenButtonStateInModal(itemId, itemType, isItemSeenFn) {
    const seenButton = document.getElementById('toggle-seen-btn');
    if (seenButton) {
        // Check if the item is seen using the provided function
        if (isItemSeenFn(itemId, itemType)) {
            seenButton.textContent = 'Seen';
            seenButton.classList.add('is-seen'); // Apply 'is-seen' class for styling
            seenButton.title = 'Mark as Unseen'; // Update tooltip
        } else {
            seenButton.textContent = 'Mark as Seen';
            seenButton.classList.remove('is-seen'); // Remove 'is-seen' class
            seenButton.title = 'Mark as Seen'; // Update tooltip
        }
    }
}


/**
 * Renders and manages the watchlist options dropdown within the item detail modal.
 * This function relies on `window.firestoreWatchlistsCache` and `window.handleAddRemoveItemToFolder`
 * which are exposed globally by `main.js`.
 * @param {object} currentItemDetails - The details object of the item currently displayed in the modal.
 * Must contain `id`, `media_type` (or deduce from `title`).
 */
export function renderWatchlistOptionsInModal(currentItemDetails) {
    const dropdownContainerModal = document.getElementById('add-to-folder-dropdown-modal');
    const dropdownSelectedTextModal = document.getElementById('dropdown-selected-text-modal');
    const dropdownListModal = document.getElementById('dropdown-list-modal');
    const dropdownFooterModal = document.getElementById('dropdown-footer-modal');
    const addNewFolderBtnModal = document.getElementById('add-new-folder-btn-modal');
    const currentItemId = currentItemDetails.id;
    const currentItemType = currentItemDetails.media_type || (currentItemDetails.title ? 'movie' : 'tv');

    /**
     * Determines which folders the current item is in by checking the global Firestore cache.
     * @returns {string[]} An array of folder IDs that contain the current item.
     */
    function getFoldersContainingCurrentItem() {
        // Access window.firestoreWatchlistsCache which is exposed by main.js
        if (!window.firestoreWatchlistsCache) return [];
        return window.firestoreWatchlistsCache.filter(watchlist =>
            watchlist.items.some(item => String(item.tmdb_id) === String(currentItemId) && item.item_type === currentItemType)
        ).map(watchlist => watchlist.id); // Return folder IDs
    }

    let currentlySelectedWatchlistIds = getFoldersContainingCurrentItem(); // Initialize with current state

    /**
     * Updates the HTML display of the dropdown list and the selected text based on current item's watchlist status.
     */
    function updateDropdownDisplay() {
        currentlySelectedWatchlistIds = getFoldersContainingCurrentItem(); // Refresh selection status
        const allWatchlists = window.firestoreWatchlistsCache || []; // Access global cache from main.js

        // Populate the dropdown list with all available watchlists, marking those that contain the current item
        dropdownListModal.innerHTML = allWatchlists.length
            ? allWatchlists.map(watchlist => `
                <div class="dropdown-item ${currentlySelectedWatchlistIds.includes(watchlist.id) ? 'item-selected' : ''}" data-folder-id="${watchlist.id}">
                    ${watchlist.name}
                    <span class="checkmark">✔</span>
                </div>`).join('')
            : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No watchlists yet. Click '+' below.</div>`;

        // Update the text displayed on the dropdown's "selected" button
        if (currentlySelectedWatchlistIds.length === 0) {
            dropdownSelectedTextModal.textContent = 'Add to Watchlist';
        } else if (currentlySelectedWatchlistIds.length === 1) {
            const selectedName = allWatchlists.find(wl => wl.id === currentlySelectedWatchlistIds[0])?.name || 'Selected';
            dropdownSelectedTextModal.textContent = selectedName;
        } else {
            dropdownSelectedTextModal.textContent = `${currentlySelectedWatchlistIds.length} watchlists selected`;
        }
    }

    // Initialize display when the modal opens
    updateDropdownDisplay();

    // Event listener to toggle dropdown visibility
    dropdownSelectedTextModal.onclick = (event) => {
        event.stopPropagation(); // Prevent modal from closing immediately
        const isOpen = dropdownListModal.style.display === 'block';
        dropdownListModal.style.display = isOpen ? 'none' : 'block';
        dropdownFooterModal.style.display = isOpen ? 'none' : 'block';
        if (isOpen) {
            dropdownSelectedTextModal.focus(); // Return focus for accessibility
        }
    };

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


    // Event listener for clicking individual watchlist items in the dropdown
    dropdownListModal.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent click from bubbling up to close modal
        const itemElement = e.target.closest('.dropdown-item');
        if (!itemElement || !itemElement.dataset.folderId) return; // Only process valid watchlist items

        const folderId = itemElement.dataset.folderId;
        // Call the global function exposed by main.js to handle adding/removing item
        if (window.handleAddRemoveItemToFolder) {
            await window.handleAddRemoveItemToFolder(folderId, currentItemDetails, currentItemType);
        }
        // Update dropdown display immediately after action
        updateDropdownDisplay();
    });

    // Event listener for the "Add New Folder" button in the dropdown footer
    addNewFolderBtnModal.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent click from bubbling up
        const newFolderName = prompt("Enter new watchlist name:"); // Use native prompt for simplicity
        if (newFolderName && newFolderName.trim() !== "") {
            // Call the global function exposed by main.js to create a new folder
            if (window.handleCreateLibraryFolder) {
                await window.handleCreateLibraryFolder(newFolderName.trim());
            }
        }
        // Update dropdown display after creation (Firestore listener will also update it)
        updateDropdownDisplay();
    });
}


/**
 * Updates properties of elements based on the current theme mode (light/dark).
 * This includes icon visibility, and fallback image sources.
 * @param {boolean} isLightMode - True if light mode is active.
 */
export function updateThemeDependentElements(isLightMode) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const heroImage = document.getElementById('hero-image-element');

    // Toggle visibility of sun/moon icons
    if (sunIcon && moonIcon) {
        sunIcon.style.display = isLightMode ? 'none' : 'inline-block';
        moonIcon.style.display = isLightMode ? 'inline-block' : 'none';
    }

    // Update fallback image URLs for the hero section if a placeholder is currently shown
    if (heroImage) {
        // Only change if the current src is a placeholder, otherwise respect actual image
        if (heroImage.src.includes('placehold.co')) {
             heroImage.src = isLightMode
                ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show' // Light mode placeholder
                : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show'; // Dark mode placeholder
            // Ensure onerror also reflects the correct theme
            heroImage.onerror = function() {
                this.onerror=null;
                this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
            };
        }
    }
    // Update CSS variables for header/footer background based on theme for consistent blur
    // This allows the rgba background to switch its base color smoothly
    const headerFooterBgBase = isLightMode ? getComputedStyle(document.documentElement).getPropertyValue('--header-footer-bg-light-rgb') : getComputedStyle(document.documentElement).getPropertyValue('--header-footer-bg-dark-rgb');
    document.documentElement.style.setProperty('--header-footer-bg-rgb', headerFooterBgBase.trim());

    // Update custom property for primary text color (used in profile dropdown hover effect)
    const textPrimaryColor = isLightMode ? '0, 0, 0' : '255, 255, 255';
    document.documentElement.style.setProperty('--text-primary-rgb', textPrimaryColor);
}

/**
 * Updates the hero section with details of a featured movie or TV show.
 * Handles cases where no item is provided (displays generic content).
 * @param {object|null} item - The featured item object from TMDB, or null to show generic content.
 * @param {boolean} isLightMode - True if light mode is active, for fallback image colors.
 */
export function updateHeroSection(item, isLightMode) {
    const heroTitle = document.getElementById('hero-title');
    const heroOverview = document.getElementById('hero-overview');
    const heroImageElement = document.getElementById('hero-image-element');

    if (item && heroTitle && heroOverview && heroImageElement) {
        // Set actual item data
        heroTitle.textContent = item.title || item.name || 'Featured Content';
        heroOverview.textContent = item.overview || 'Discover the latest blockbusters and critically acclaimed series.';
        let newHeroImageUrl = '';
        if (item.backdrop_path) {
            newHeroImageUrl = `${TMDB_BACKDROP_BASE_URL}${item.backdrop_path}`;
        } else if (item.poster_path) { // Use poster as fallback for backdrop if available
            newHeroImageUrl = `${TMDB_BACKDROP_BASE_URL}${item.poster_path}`;
        } else {
            // Fallback to a placeholder image if no actual image path
            newHeroImageUrl = isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show';
        }
        heroImageElement.src = newHeroImageUrl;
        // Set onerror to handle cases where the image fails to load
        heroImageElement.onerror = function() {
            this.onerror=null; // Prevent infinite loop if fallback also fails
            this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
        };
    } else if (heroTitle && heroOverview && heroImageElement) {
        // Display generic content if no item is provided (e.g., initial load or error)
        heroTitle.textContent = 'Featured Content';
        heroOverview.textContent = 'Discover the latest blockbusters and critically acclaimed series.';
        heroImageElement.src = isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Featured+Show' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Featured+Show';
        heroImageElement.onerror = function() {
            this.onerror=null;
            this.src= isLightMode ? 'https://placehold.co/1200x600/A0C4FF/1D1D1F?text=Fallback+Image' : 'https://placehold.co/1200x600/3B0764/F3F4F6?text=Fallback+Image';
        };
    }
}
