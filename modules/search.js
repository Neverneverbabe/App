// modules/search.js

import { fetchSearchResults } from '../api.js';
import { getCertification, checkRatingCompatibility } from '../ratingUtils.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, displaySearchResults } from '../ui.js';

// Cache for search results
let cachedSearchResults = [];

// Search debounce timer
let searchTimer = null;
const SEARCH_DEBOUNCE_DELAY = 500;

/**
 * Performs a search for movies/TV shows based on the input query.
 * @param {string} query - The search query.
 * @param {boolean} reRenderOnly - If true, only re-renders existing cached results with current filters;
 * if false, fetches new results from the API.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export async function performSearch(query, reRenderOnly, currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn) {
    const searchResultsContainer = document.getElementById('search-results-container');

    if (!reRenderOnly && query.length < 3) {
        searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Please enter at least 3 characters to search.</p>`;
        cachedSearchResults = [];
        return;
    }

    if (reRenderOnly && cachedSearchResults.length > 0) {
        let filteredResults = cachedSearchResults;
        if (currentMediaTypeFilter) {
            filteredResults = filteredResults.filter(item => (item.media_type || (item.title ? 'movie' : 'tv')) === currentMediaTypeFilter);
        }
        if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
            filteredResults = filteredResults.filter(item => {
                const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
                const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []);
                const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
                return ratingOk && categoryOk;
            });
        }
        displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeenFn);
        if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
            searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search matched the selected filter.</p>`;
        }
        return;
    } else if (!reRenderOnly) {
        searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
        try {
            showLoadingIndicator('Searching...');
            const searchType = currentMediaTypeFilter === '' ? 'multi' : currentMediaTypeFilter;
            const results = await fetchSearchResults(query, searchType);
            cachedSearchResults = results;

            let filteredResults = cachedSearchResults;
            if (currentMediaTypeFilter) {
                filteredResults = filteredResults.filter(item => (item.media_type || (item.title ? 'movie' : 'tv')) === currentMediaTypeFilter);
            }
            if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
                filteredResults = filteredResults.filter(item => {
                    const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
                    const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []);
                    const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
                    return ratingOk && categoryOk;
                });
            }

            displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeenFn);
            if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search for "${query}" matched the selected filter.</p>`;
            } else if (results.length === 0) {
                searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found for "${query}".</p>`;
            }
        } catch (error) {
            console.error("Error performing search:", error);
            searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Error searching for content. Please try again. Error: ${error.message}</p>`;
        } finally {
            hideLoadingIndicator();
        }
    }
}

/**
 * Sets up a debounced search listener for the input field.
 * @param {HTMLInputElement} searchInput - The search input DOM element.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function setupSearchListeners(searchInput, currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn) {
    // Debounce search input to avoid excessive API calls
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            performSearch(searchInput.value.trim(), false, currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn);
        }, SEARCH_DEBOUNCE_DELAY);
    });

    // Trigger search immediately on button click
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            clearTimeout(searchTimer);
            performSearch(searchInput.value.trim(), false, currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn);
        });
    }
}

/**
 * Populates the search tab, potentially re-rendering existing results.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export function populateSearchTab(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn) {
    const searchInput = document.getElementById('search-input');
    if (searchInput.value.trim().length >= 3 && cachedSearchResults.length > 0) {
        performSearch(searchInput.value.trim(), true, currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn);
    } else {
        const searchResultsContainer = document.getElementById('search-results-container');
        searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Start typing to find movies and TV shows!</p>`;
    }
}
