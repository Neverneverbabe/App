// modules/seenItems.js

import { getCurrentUser, saveUserData, deleteUserData, listenToUserCollection } from '../SignIn/firebase_api.js';
import { showCustomAlert, updateSeenButtonStateInModal, showLoadingIndicator, hideLoadingIndicator } from '../ui.js';

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
            showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as unseen.`);
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
                addedAt: new Date().toISOString()
            };
            await saveUserData('seenItems', String(itemId), seenItemData);
            showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as seen.`);
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
                // Fetch details as toggleSeenStatus expects the full itemDetails object
                // This is a small redundancy but ensures the toggle function has full context.
                const { fetchItemDetails } = await import('../api.js'); // Dynamically import to avoid circular dependency with main.js/ui.js
                const details = await fetchItemDetails(itemId, itemType);
                await toggleSeenStatus(details, itemType);

                // UI update will be handled by the real-time listener, no need to manually toggle class here.
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
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 */
export function populateSeenTab(currentAgeRatingFilter, isLightMode, onCardClick) {
    const seenContentDiv = document.getElementById('seen-content');
    const seenItems = getSeenItems();
    seenContentDiv.innerHTML = '';

    if (seenItems.length === 0) {
        seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items marked as seen yet.</p>`;
    } else {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'search-results-grid';

        const filteredSeenItems = currentAgeRatingFilter.length > 0
            ? seenItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
            : seenItems;

        if (filteredSeenItems.length === 0 && currentAgeRatingFilter.length > 0) {
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
