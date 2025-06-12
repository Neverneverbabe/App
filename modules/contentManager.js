// modules/contentManager.js

// Imports necessary functions from the API and utilities
import { fetchTrendingItems, fetchDiscoveredItems, fetchEnoughDiscoveredItems } from '../api.js';
import { getCertification, checkRatingCompatibility } from '../ratingUtils.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, displayContentRow, appendItemsToGrid, updateHeroSection } from '../ui.js';
import { TMDB_BACKDROP_BASE_URL } from '../config.js';

// Internal caches for content
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedExploreItems = [];

// State variables for infinite scrolling in the explore tab
let exploreCurrentPage = 1;
let exploreIsLoading = false;
let exploreHasMore = true;

/**
 * Initializes the content caches by fetching initial data.
 */
export async function initializeContentCaches() {
    try {
        console.log("Initializing content caches...");
        cachedTrendingMovies = await fetchTrendingItems('movie', 'week');
        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
        console.log("Content caches initialized.");
    } catch (error) {
        console.error("Error initializing content caches:", error);
        showCustomAlert('Error', `Failed to load initial content: ${error.message}`);
    }
}

/**
 * Populates the content of the 'Watch Now' tab.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export async function populateWatchNowTab(currentAgeRatingFilter, isLightMode, onCardClick, isItemSeenFn) {
    const trendingNowRow = document.getElementById('trending-now-row');
    const recommendedRow = document.getElementById('recommended-row');
    const newReleasesRow = document.getElementById('new-releases-row');

    // Display loading messages
    trendingNowRow.innerHTML = '<p class="loading-message">Loading trending movies...</p>';
    recommendedRow.innerHTML = '<p class="loading-message">Loading recommended content...</p>';
    newReleasesRow.innerHTML = '<p class="loading-message">Loading new releases...</p>';

    // Filter content based on age rating
    const filterItems = (items) => {
        if (currentAgeRatingFilter.length === 0) return items;
        return items.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter));
    };

    // When filters are applied, fetch new content that respects the rating
    let trendingSource = cachedTrendingMovies;
    let recommendedSource = cachedRecommendedShows;
    let newReleaseSource = cachedNewReleaseMovies;

    if (currentAgeRatingFilter.length > 0) {
        try {
            const desiredCount = cachedTrendingMovies.length || 20;
            const trendingData = await fetchEnoughDiscoveredItems('movie', currentAgeRatingFilter, desiredCount);
            trendingSource = trendingData.items;
            const recommendedData = await fetchEnoughDiscoveredItems('tv', currentAgeRatingFilter, desiredCount);
            recommendedSource = recommendedData.items;
            const newReleaseData = await fetchEnoughDiscoveredItems('movie', currentAgeRatingFilter, desiredCount);
            newReleaseSource = newReleaseData.items;
        } catch (err) {
            console.error('Error fetching filtered watch now content:', err);
        }
    }

    try {
        // Trending Movies
        const filteredTrending = filterItems(trendingSource);
        displayContentRow('trending-now-row', filteredTrending, isLightMode, onCardClick, isItemSeenFn);
        if (filteredTrending.length === 0 && currentAgeRatingFilter.length > 0) {
            trendingNowRow.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
        }

        // Update Hero Section with the first trending item
        const heroSourceList = (filteredTrending.length > 0) ? filteredTrending : trendingSource;
        if (heroSourceList.length > 0) {
            const heroItem = heroSourceList[0];
            const heroImageUrl = (typeof heroItem.backdrop_path === 'string' && heroItem.backdrop_path)
                ? `${TMDB_BACKDROP_BASE_URL}${heroItem.backdrop_path}`
                : '';
            const heroTitle = heroItem.title || heroItem.name || 'Featured Content';
            const heroOverview = heroItem.overview || 'No description available.';
            updateHeroSection(heroImageUrl, heroTitle, heroOverview);
        } else {
            updateHeroSection('', 'Content Not Available', 'Please check back later or try different filters.');
        }

        // Recommended TV Shows
        const filteredRecommended = filterItems(recommendedSource);
        displayContentRow('recommended-row', filteredRecommended, isLightMode, onCardClick, isItemSeenFn);
        if (filteredRecommended.length === 0 && currentAgeRatingFilter.length > 0) {
            recommendedRow.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
        }

        // New Releases (Daily Trending Movies)
        const filteredNewReleases = filterItems(newReleaseSource);
        displayContentRow('new-releases-row', filteredNewReleases, isLightMode, onCardClick, isItemSeenFn);
        if (filteredNewReleases.length === 0 && currentAgeRatingFilter.length > 0) {
            newReleasesRow.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
        }
    } catch (error) {
        console.error("Error populating Watch Now tab:", error);
        showCustomAlert('Error', `Could not load content for Watch Now. Error: ${error.message}`);
    }
}

/**
 * Populates the content of the 'Explore' tab.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export async function populateExploreTab(currentAgeRatingFilter, currentTypeFilter, isLightMode, onCardClick, isItemSeenFn) {
    const exploreGrid = document.getElementById('explore-grid-container');
    if (exploreCurrentPage === 1 && exploreGrid.innerHTML.trim() === "") {
        exploreGrid.innerHTML = '<p class="loading-message">Loading movies for you...</p>';
        exploreHasMore = true;
        exploreIsLoading = false;
        await loadMoreExploreItems(currentAgeRatingFilter, currentTypeFilter, isLightMode, onCardClick, isItemSeenFn);
    } else {
        let filteredExploreItems = cachedExploreItems;
        if (currentTypeFilter) {
            filteredExploreItems = filteredExploreItems.filter(item => item.media_type === currentTypeFilter);
        }
        if (currentAgeRatingFilter.length > 0) {
            filteredExploreItems = filteredExploreItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter));
        }
        exploreGrid.innerHTML = ''; // Clear before re-appending filtered items
        appendItemsToGrid(exploreGrid, filteredExploreItems, isLightMode, onCardClick, isItemSeenFn);
        if (filteredExploreItems.length === 0 && currentAgeRatingFilter.length > 0) {
            exploreGrid.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
        }
    }
}

/**
 * Loads more items for the Explore tab using infinite scrolling.
 * @param {string[]} currentAgeRatingFilter - Array of selected age rating filters.
 * @param {boolean} isLightMode - True if light mode is active.
 * @param {function} onCardClick - Callback function for when a content card is clicked.
 * @param {function} isItemSeenFn - Function to check if an item is seen.
 */
export async function loadMoreExploreItems(currentAgeRatingFilter, isLightMode, onCardClick, isItemSeenFn) {
    if (exploreIsLoading || !exploreHasMore) return;

    exploreIsLoading = true;
    const loadingIndicator = document.getElementById('explore-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    const exploreGridContainer = document.getElementById('explore-grid-container');

    try {
        const desiredCount = 20;
        const mediaType = currentTypeFilter || 'movie';
        const { items: newItems, pagesFetched } = await fetchEnoughDiscoveredItems(mediaType, currentAgeRatingFilter, desiredCount, exploreCurrentPage);
        cachedExploreItems = cachedExploreItems.concat(newItems);

        if (newItems.length > 0) {
            let itemsToDisplay = newItems;
            if (currentAgeRatingFilter.length > 0) {
                itemsToDisplay = itemsToDisplay.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter));
            }

            appendItemsToGrid(exploreGridContainer, itemsToDisplay, isLightMode, onCardClick, isItemSeenFn);
            exploreCurrentPage += pagesFetched;
            if (newItems.length < desiredCount) {
                exploreHasMore = false;
            }
        } else {
            exploreHasMore = false;
        }
    } catch (error) {
        console.error("Error loading more explore items:", error);
        showCustomAlert('Error', `Failed to load more content for Explore: ${error.message}`);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        exploreIsLoading = false;
    }
}

/**
 * Resets the explore tab's pagination and cache.
 */
export function resetExploreState() {
    exploreCurrentPage = 1;
    exploreIsLoading = false;
    exploreHasMore = true;
    cachedExploreItems = [];
    const exploreGrid = document.getElementById('explore-grid-container');
    if (exploreGrid) {
        exploreGrid.innerHTML = '';
    }
}
