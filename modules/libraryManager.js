// modules/libraryManager.js

/**
 * MOVIE LIBRARY LAYOUT STRUCTURE
 *
 * Layout is divided into 3 logical UI tiers:
 *
 * 1. Top Row – Library Folders
 *    - Represents the main user-created folders (broad categories)
 *    - Example: [ New Library + ] [ "Comedy" ] [ "Good" ] [ "Horror" ]
 *    - Clicking a folder filters the view to only show its subfolders and movies
 *
 * 2. Second Row – Subfolders (Watchlists)
 *    - Contextual row based on selected folder from Row 1
 *    - Example (Comedy selected): [ New Watchlist + ] (no subfolders yet)
 *    - Example (Good selected): [ New Watchlist + ] [ "Crier" ] [ "Classic" ]
 *    - Clicking a subfolder filters the movie list to just that subfolder
 *
 * 3. Main Content – Movie List/Grid
 *    - Displays movies based on the selected folder and subfolder
 *    - Examples:
 *       - Comedy (no subfolder selected): shows "Dumb and Dumber", etc.
 *       - Good > Crier selected: shows "Pay It Forward", "Green Book", etc.
 *
 * Behavior Notes:
 * - If only a folder is selected, all movies under that folder display
 * - If a subfolder is selected, only its movies display
 * - Movies can belong to subfolders for better filtering
 * - New Library + and New Watchlist + are buttons to add folders and subfolders
 */

import { getCurrentUser, saveUserData, deleteUserData, listenToUserCollection } from '../SignIn/firebase_api.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, showToast, updateBookmarkIconStates, updateBookmarkIconForItem } from '../ui.js';
import { createContentCardHtml } from '../ui.js'; // Import directly from ui.js
import { fetchItemDetails } from '../api.js';
import { getCertification, checkRatingCompatibility } from '../ratingUtils.js';

// Local cache for user's watchlists
let firestoreWatchlistsCache = [];
let unsubscribeWatchlists = null; // Holds the unsubscribe function for the Firestore listener

// Cache for item details fetched from TMDB to minimize network requests
const itemDetailsCache = {};

async function getItemDetailsCached(id, type) {
    const key = `${type}_${id}`;
    if (!itemDetailsCache[key]) {
        itemDetailsCache[key] = await fetchItemDetails(id, type);
    }
    return itemDetailsCache[key];
}

// State for the currently selected library folder
let currentSelectedLibraryFolder = null;
// Stack representing the current folder navigation path
let libraryFolderStack = [];

/**
 * Gets the current watchlist cache.
 * @returns {Array<object>} The array of watchlist objects.
 */
export function getWatchlistsCache() {
    return firestoreWatchlistsCache;
}

/**
 * Sets the currently selected library folder ID.
 * @param {string|null} folderId - The ID of the folder to select.
 */
export function setCurrentSelectedLibraryFolder(folderId) {
    if (folderId) {
        libraryFolderStack = [folderId];
        currentSelectedLibraryFolder = folderId;
    } else {
        libraryFolderStack = [];
        currentSelectedLibraryFolder = null;
    }
}

/**
 * Gets the currently selected library folder ID.
 * @returns {string|null} The ID of the currently selected folder.
 */
export function getCurrentSelectedLibraryFolder() {
    return currentSelectedLibraryFolder;
}

export function pushFolder(folderId) {
    if (folderId) {
        libraryFolderStack.push(folderId);
        currentSelectedLibraryFolder = folderId;
    }
}

export function popFolder() {
    libraryFolderStack.pop();
    currentSelectedLibraryFolder = libraryFolderStack[libraryFolderStack.length - 1] || null;
}

export function getCurrentParentFolderId() {
    return libraryFolderStack[libraryFolderStack.length - 1] || null;
}

export function getWatchlistFullName(folderId) {
    const folderMap = Object.fromEntries(firestoreWatchlistsCache.map(f => [f.id, f]));
    let parts = [];
    let current = folderMap[folderId];
    while (current) {
        parts.unshift(current.name);
        current = current.parentId ? folderMap[current.parentId] : null;
    }
    return parts.join(' / ');
}

/**
 * Initializes the Firestore listener for user watchlists and loads initial data.
 * This should be called after Firebase auth is ready.
 * @param {function} onUpdateCallback - A callback function to run when watchlists are updated (e.g., to re-render UI).
 * @param {function} renderSelectedFolderCallback - Callback to render movies in selected folder.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClickCallback - Callback for card clicks.
 */
export function initializeLibraryListener(onUpdateCallback, renderSelectedFolderCallback, isItemSeenFn, isLightMode, onCardClickCallback) {
    // Ensure previous listener is unsubscribed to prevent duplicates
    if (unsubscribeWatchlists) {
        unsubscribeWatchlists();
        unsubscribeWatchlists = null;
    }

    const user = getCurrentUser();
    if (user) {
        unsubscribeWatchlists = listenToUserCollection('watchlists', (items) => {
            let needsOrderUpdate = false;
            firestoreWatchlistsCache = items.map((wl, idx) => {
                const normalized = {
                    ...wl,
                    items: Array.isArray(wl.items) ? wl.items : []
                };
                if (typeof normalized.order !== 'number') {
                    normalized.order = idx;
                    needsOrderUpdate = true;
                }
                return normalized;
            });
            if (needsOrderUpdate) {
                firestoreWatchlistsCache.forEach(wl => {
                    saveUserData('watchlists', wl.id, { order: wl.order });
                });
            }
            console.log("Real-time Watchlists update:", firestoreWatchlistsCache);
            onUpdateCallback(isItemSeenFn, isLightMode, onCardClickCallback, getCurrentParentFolderId()); // Trigger folder cards re-render
            updateBookmarkIconStates();
            if (currentSelectedLibraryFolder) {
                renderSelectedFolderCallback(currentSelectedLibraryFolder, isItemSeenFn, isLightMode, onCardClickCallback);
            }
        });
    } else {
        firestoreWatchlistsCache = [];
        onUpdateCallback(isItemSeenFn, isLightMode, onCardClickCallback, null); // Update UI to reflect no watchlists
        renderSelectedFolderCallback(null, isItemSeenFn, isLightMode, onCardClickCallback);
        updateBookmarkIconStates();
    }
}

/**
 * Creates a new watchlist (folder) in Firestore.
 * @param {string} folderName - The name of the new folder.
 */
export async function createLibraryFolder(folderName, parentId = null) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert("Info", "Please sign in to create watchlists.");
        return;
    }
    try {
        showLoadingIndicator(`Creating "${folderName}"...`);
        const docId = `${folderName.replace(/\s+/g, '_')}_${Date.now()}`;
        const siblingCount = firestoreWatchlistsCache.filter(wl => (wl.parentId || null) === parentId).length;
        await saveUserData('watchlists', docId, { name: folderName, items: [], parentId, order: siblingCount });
        showCustomAlert("Success", `Watchlist "${folderName}" created successfully!`);
    } catch (error) {
        console.error("Error creating new folder:", error);
        showCustomAlert("Error", `Failed to create watchlist: ${error.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Deletes a watchlist (folder) from Firestore.
 * @param {string} folderId - The ID of the folder to delete.
 * @param {string} folderName - The name of the folder for confirmation/alert messages.
 */
export async function deleteLibraryFolder(folderId, folderName) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert("Info", "Please sign in to delete watchlists.");
        return;
    }
    // Using custom alert from ui.js for confirmation.
    // In a real app, you'd use a dedicated confirmation modal here.
    const confirmDelete = confirm(`Are you sure you want to delete "${folderName}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
        showLoadingIndicator(`Deleting "${folderName}"...`);
        await deleteUserData('watchlists', folderId);
        showCustomAlert("Success", `Watchlist "${folderName}" deleted.`);
        if (currentSelectedLibraryFolder === folderId) {
            currentSelectedLibraryFolder = null; // Deselect if deleted
        }
    } catch (error) {
        console.error("Error deleting folder:", error);
        showCustomAlert("Error", `Failed to delete watchlist: ${error.message}`);
    } finally {
        hideLoadingIndicator();
    }
}

/**
 * Updates the order field for a specific folder.
 * @param {string} folderId - The ID of the folder.
 * @param {number} newOrder - The new order index.
 */
async function updateFolderOrder(folderId, newOrder) {
    try {
        await saveUserData('watchlists', folderId, { order: newOrder });
    } catch (error) {
        console.error('Error updating folder order', error);
    }
}

/**
 * Adds or removes an item from a specific watchlist folder in Firestore.
 * If the item already exists in the folder it will be removed, otherwise it
 * will be appended. The local cache and UI are updated after the change.
 * @param {string} folderId - The ID of the watchlist folder.
 * @param {object} itemDetails - The item details object.
 * @param {string} itemType - The media type ('movie' or 'tv').
 */
export async function addRemoveItemToFolder(folderId, itemDetails, itemType) {
    const user = getCurrentUser();
    if (!user) {
        showCustomAlert('Info', 'Please sign in to manage watchlists.');
        return;
    }

    try {

        // Find the target watchlist in the current cache
        const targetWatchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
        if (!targetWatchlist) {
            showCustomAlert('Error', 'Watchlist not found in cache.');
            return;
        }

        const normalizedItem = {
            tmdb_id: itemDetails.id, // Ensure TMDB ID is stored as tmdb_id
            item_type: itemType,
            title: itemDetails.title || itemDetails.name,
            poster_path: itemDetails.poster_path
        };

        let itemsArray = Array.isArray(targetWatchlist.items) ? [...targetWatchlist.items] : [];
        const existingIndex = itemsArray.findIndex(i => String(i.tmdb_id) === String(normalizedItem.tmdb_id) && i.item_type === normalizedItem.item_type);

        if (existingIndex > -1) {
            itemsArray.splice(existingIndex, 1);
            showToast(`Removed "${normalizedItem.title}" from "${targetWatchlist.name}"`);
        } else {
            itemsArray.push(normalizedItem);
            showToast(`Added "${normalizedItem.title}" to "${targetWatchlist.name}"`);
        }

        // Update the local cache immediately so UI reflects the change
        targetWatchlist.items = itemsArray;

        updateBookmarkIconForItem(normalizedItem.tmdb_id, normalizedItem.item_type);

        // Save the updated items array back to Firestore
        await saveUserData('watchlists', folderId, {
            name: targetWatchlist.name,
            items: itemsArray
        });

        // The real-time listener will also update firestoreWatchlistsCache,
        // but we update the local object first to avoid dropdown flicker.
    } catch (error) {
        console.error('Error updating watchlist folder:', error);
        showCustomAlert('Error', `Failed to update watchlist: ${error.message}`);
    }
}


/**
 * Renders the library folder (watchlist) cards in the Library tab.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClickCallback - Callback for when a card is clicked.
 */
export function renderLibraryFolderCards(
    isItemSeenFn,
    isLightMode,
    onCardClickCallback,
    currentMediaTypeFilter = '',
    currentAgeRatingFilter = [],
    currentCategoryFilter = [],
    parentFolderId = null
) {
    const libraryFoldersRow = document.getElementById('library-folders-row');
    if (!libraryFoldersRow) return;

    libraryFoldersRow.innerHTML = '';

    if (parentFolderId) {
        const backCard = document.createElement('div');
        backCard.className = 'content-card folder-card';
        backCard.style.cssText = `flex-shrink:0;width:10rem;height:14rem;background-color:var(--card-bg);display:flex;align-items:center;justify-content:center;margin-right:1rem;margin-bottom:1rem;cursor:pointer;border-radius:0.5rem;`;
        backCard.innerHTML = `<i class="fas fa-arrow-left" style="font-size:2rem;color:var(--text-secondary);"></i>`;
        backCard.addEventListener('click', () => {
            popFolder();
            renderLibraryFolderCards(
                isItemSeenFn,
                isLightMode,
                onCardClickCallback,
                currentMediaTypeFilter,
                currentAgeRatingFilter,
                currentCategoryFilter,
                getCurrentParentFolderId()
            );
            renderMoviesInSelectedFolder(
                getCurrentSelectedLibraryFolder(),
                isItemSeenFn,
                isLightMode,
                onCardClickCallback,
                currentMediaTypeFilter,
                currentAgeRatingFilter,
                currentCategoryFilter
            );
        });
        libraryFoldersRow.appendChild(backCard);
    }

    const createNewCard = document.createElement('div');
    createNewCard.className = 'content-card folder-card create-new-folder-card';
    createNewCard.style.cssText = `
        flex-shrink: 0;
        width: 10rem;
        height: 14rem;
        background-color: var(--card-bg);
        border: 2px dashed var(--text-secondary);
        border-radius: 0.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        box-shadow: 0 4px 6px -1px rgba(var(--black-rgb), 0.1);
        margin-right: 1rem;
        margin-bottom: 1rem;
    `;
    createNewCard.innerHTML = `
        <i class="fas fa-plus" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
        <p style="text-align: center; font-size: 0.9em; font-weight: 500; color: var(--text-secondary);">New Watchlist</p>
    `;
    createNewCard.addEventListener('click', async () => {
        const newFolderName = prompt("Enter new watchlist name:"); // Using native prompt for simplicity
        if (newFolderName && newFolderName.trim() !== "") {
            await createLibraryFolder(newFolderName.trim(), parentFolderId);
        }
    });
    libraryFoldersRow.appendChild(createNewCard);

    if (firestoreWatchlistsCache.length === 0) {
        return;
    }

    const foldersToShow = firestoreWatchlistsCache
        .filter(f => (f.parentId || null) === parentFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    foldersToShow.forEach(folder => {
        const firstItemPoster = folder.items && folder.items.length > 0 && folder.items[0].poster_path
            ? (folder.items[0].poster_path.startsWith('http') ? folder.items[0].poster_path : `https://image.tmdb.org/t/p/w200${folder.items[0].poster_path}`)
            : "https://placehold.co/150x225/374151/9CA3AF?text=Folder";

        const card = document.createElement('div');
        card.className = 'content-card folder-card';
        card.draggable = true;
        card.style.position = 'relative';
        card.style.display = 'inline-block';
        card.style.marginRight = '1rem';
        card.style.marginBottom = '1rem';
        card.style.width = '10rem';
        card.dataset.folderId = folder.id;
        card.dataset.folderName = folder.name;

        card.innerHTML = `
            <img src="${firstItemPoster}" alt="Folder: ${folder.name}" style="width:100%; height:14rem; object-fit: cover; border-radius:0.5rem; box-shadow: 0 4px 6px -1px rgba(var(--black-rgb), 0.1);">
            <p style="text-align:center; margin-top:0.5rem; font-size:0.9em; font-weight:500; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name} (${folder.items.length})</p>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑';
        deleteBtn.title = 'Delete Watchlist';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = 'rgba(var(--black-rgb), 0.4)';
        deleteBtn.style.color = 'var(--text-secondary)';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '24px';
        deleteBtn.style.height = '24px';
        deleteBtn.style.fontSize = '14px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await deleteLibraryFolder(folder.id, folder.name);
        };
        card.appendChild(deleteBtn);

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', folder.id);
            card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.style.border = '2px dashed var(--science-blue)';
        });

        card.addEventListener('dragleave', () => {
            card.style.border = '2px solid transparent';
        });

        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            card.style.border = '2px solid transparent';
            const draggedId = e.dataTransfer.getData('text/plain');
            if (!draggedId || draggedId === folder.id) return;
            const list = firestoreWatchlistsCache
                .filter(f => (f.parentId || null) === parentFolderId)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const draggedIndex = list.findIndex(f => f.id === draggedId);
            const targetIndex = list.findIndex(f => f.id === folder.id);
            if (draggedIndex === -1 || targetIndex === -1) return;
            const [moved] = list.splice(draggedIndex, 1);
            list.splice(targetIndex, 0, moved);
            list.forEach((wl, idx) => {
                wl.order = idx;
                const cacheIndex = firestoreWatchlistsCache.findIndex(f => f.id === wl.id);
                if (cacheIndex > -1) firestoreWatchlistsCache[cacheIndex].order = idx;
                updateFolderOrder(wl.id, idx);
            });
            renderLibraryFolderCards(
                isItemSeenFn,
                isLightMode,
                onCardClickCallback,
                currentMediaTypeFilter,
                currentAgeRatingFilter,
                currentCategoryFilter,
                parentFolderId
            );
            if (currentSelectedLibraryFolder) {
                renderMoviesInSelectedFolder(
                    currentSelectedLibraryFolder,
                    isItemSeenFn,
                    isLightMode,
                    onCardClickCallback,
                    currentMediaTypeFilter,
                    currentAgeRatingFilter,
                    currentCategoryFilter
                );
            }
        });

        card.addEventListener('click', (e) => {
            if (e.target === deleteBtn) return;
            pushFolder(folder.id);
            renderLibraryFolderCards(
                isItemSeenFn,
                isLightMode,
                onCardClickCallback,
                currentMediaTypeFilter,
                currentAgeRatingFilter,
                currentCategoryFilter,
                folder.id
            );
            renderMoviesInSelectedFolder(
                folder.id,
                isItemSeenFn,
                isLightMode,
                onCardClickCallback,
                currentMediaTypeFilter,
                currentAgeRatingFilter,
                currentCategoryFilter
            );
            libraryFoldersRow.querySelectorAll('.folder-card').forEach(fc => {
                fc.style.border = '2px solid transparent';
                fc.style.boxShadow = '0 4px 6px -1px rgba(var(--black-rgb), 0.1)';
            });
            card.style.border = `2px solid var(--science-blue)`;
            card.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(var(--black-rgb), 0.1)`;
        });

        libraryFoldersRow.appendChild(card);
    });

    // Reapply highlight to currently selected folder after re-rendering
    if (currentSelectedLibraryFolder) {
        const selectedCard = libraryFoldersRow.querySelector(`.folder-card[data-folder-id="${currentSelectedLibraryFolder}"]`);
        if (selectedCard) {
            selectedCard.style.border = `2px solid var(--science-blue)`;
            selectedCard.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(var(--black-rgb), 0.1)`;
        }
    }
}

/**
 * Renders the movies contained within a selected library folder (watchlist).
 * @param {string|null} folderId - The ID of the selected folder, or null to show a placeholder.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClickCallback - Callback for when a card is clicked.
 */
export async function renderMoviesInSelectedFolder(
    folderId,
    isItemSeenFn,
    isLightMode,
    onCardClickCallback,
    currentMediaTypeFilter = '',
    currentAgeRatingFilter = [],
    currentCategoryFilter = []
) {
    const selectedFolderTitleElement = document.getElementById('selected-folder-title');
    const librarySelectedFolderMoviesRow = document.getElementById('library-selected-folder-movies-row');

    if (!selectedFolderTitleElement || !librarySelectedFolderMoviesRow) return;

    if (!folderId) {
        selectedFolderTitleElement.textContent = 'Items in Folder';
        librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Select a watchlist above to see its contents.</p>`;
        return;
    }

    const selectedWatchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
    if (!selectedWatchlist) {
        selectedFolderTitleElement.textContent = 'Items in Folder';
        librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Watchlist not found or has been deleted.</p>`;
        currentSelectedLibraryFolder = null; // Clear selection if folder is gone
        return;
    }

    selectedFolderTitleElement.textContent = `Items in "${selectedWatchlist.name}"`;
    const items = selectedWatchlist.items;

    if (items.length === 0) {
        librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">This watchlist is empty.</p>`;
    } else {
        librarySelectedFolderMoviesRow.innerHTML = '';
        let added = 0;
        for (const item of items) {
            if (currentMediaTypeFilter && item.item_type !== currentMediaTypeFilter) {
                continue;
            }

            let details = null;
            if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
                try {
                    details = await getItemDetailsCached(item.tmdb_id, item.item_type);
                } catch (err) {
                    console.error('Failed to fetch item details', err);
                }
                if (details) {
                    const ratingOk = currentAgeRatingFilter.length === 0 ||
                        checkRatingCompatibility(getCertification(details), currentAgeRatingFilter);
                    const genreIds = details.genre_ids || (details.genres ? details.genres.map(g => g.id) : []);
                    const categoryOk = currentCategoryFilter.length === 0 ||
                        genreIds.some(id => currentCategoryFilter.includes(String(id)));
                    if (!ratingOk || !categoryOk) continue;
                }
            }

            const displayItem = {
                id: item.tmdb_id,
                media_type: item.item_type,
                title: item.title,
                poster_path: item.poster_path
            };

            const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeenFn);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtmlString;
            const movieCardElement = tempDiv.firstElementChild;

            if (movieCardElement) {
                movieCardElement.addEventListener('click', (e) => {
                    if (e.target.closest('.seen-toggle-icon')) return;
                    if (!isNaN(displayItem.id) && displayItem.media_type) {
                        onCardClickCallback(displayItem.id, displayItem.media_type);
                    }
                });

                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '🗑';
                removeBtn.title = 'Remove from Watchlist';
                removeBtn.style.position = 'absolute';
                removeBtn.style.bottom = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.background = 'rgba(var(--science-blue-rgb), 0.6)';
                removeBtn.style.color = 'var(--white)';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '24px';
                removeBtn.style.height = '24px';
                removeBtn.style.fontSize = '14px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.zIndex = '10';
                removeBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await addRemoveItemToFolder(folderId, displayItem, item.item_type);
                };
                movieCardElement.querySelector('.image-container').appendChild(removeBtn);
                librarySelectedFolderMoviesRow.appendChild(movieCardElement);
                added++;
            }
        }

        if (added === 0) {
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">No items matched your filter.</p>`;
        }
    }
}

/**
 * Populates the 'Library' tab.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback for when a card is clicked.
 */
export async function populateLibraryTab(
    currentMediaTypeFilter,
    currentAgeRatingFilter,
    currentCategoryFilter,
    isItemSeenFn,
    isLightMode,
    onCardClick
) {
    await renderLibraryFolderCards(
        isItemSeenFn,
        isLightMode,
        onCardClick,
        currentMediaTypeFilter,
        currentAgeRatingFilter,
        currentCategoryFilter,
        getCurrentParentFolderId()
    );
    await renderMoviesInSelectedFolder(
        currentSelectedLibraryFolder,
        isItemSeenFn,
        isLightMode,
        onCardClick,
        currentMediaTypeFilter,
        currentAgeRatingFilter,
        currentCategoryFilter
    );
}
