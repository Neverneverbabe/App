// modules/contentManager.js

// Imports necessary functions from the API and utilities
import { fetchTrendingItems, fetchDiscoveredItems, fetchEnoughDiscoveredItems, fetchTopRatedItems, fetchClassicItems, fetchRecommendations } from '../api.js';
import { getSeenItems } from './seenItems.js';
import { getCertification, checkRatingCompatibility } from '../ratingUtils.js';
import { showCustomAlert, showLoadingIndicator, hideLoadingIndicator, displayContentRow, appendItemsToGrid, updateHeroSection } from '../ui.js';
import { TMDB_BACKDROP_BASE_URL } from '../config.js';

// Internal caches for content
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedNewReleaseTv = [];
let cachedExploreItems = [];
// Track IDs of items already loaded in Explore to avoid duplicates
const loadedExploreItemIds = new Set();

// State variables for infinite scrolling in the explore tab
let exploreMoviePage = 1;
let exploreTvPage = 1;
let exploreIsLoading = false;
let exploreHasMore = true;
let exploreReachedEnd = false; // Tracks if we've reached the end of available results

/**
 * Initializes the content caches by fetching initial data.
 */
export async function initializeContentCaches() {
    try {
        console.log("Initializing content caches...");
        cachedTrendingMovies = await fetchTrendingItems('movie', 'week');
        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
        cachedNewReleaseTv = await fetchTrendingItems('tv', 'day');
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
export async function populateWatchNowTab(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, isLightMode, onCardClick, isItemSeenFn) {
    const trendingNowRow = document.getElementById('trending-now-row');
    const recommendedRow = document.getElementById('recommended-row');
    const newReleasesRow = document.getElementById('new-releases-row');

    // Display loading messages
    trendingNowRow.innerHTML = '<p class="loading-message">Loading trending movies...</p>';
    recommendedRow.innerHTML = '<p class="loading-message">Loading recommended content...</p>';
    newReleasesRow.innerHTML = '<p class="loading-message">Loading new releases...</p>';

    // Filter content based on age rating
    const filterItems = (items) => {
        return items.filter(item => {
            const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
            const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []);
            const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
            return ratingOk && categoryOk;
        });
    };

    // When filters are applied, fetch new content that respects the rating
    let trendingSource = cachedTrendingMovies;
    let recommendedSource = cachedRecommendedShows;
    let newReleaseSource = cachedNewReleaseMovies;

    let trendingType = 'movie';
    let recommendedType = 'tv';
    let newReleaseType = 'movie';

    if (currentMediaTypeFilter === 'movie') {
        recommendedSource = cachedTrendingMovies;
        recommendedType = 'movie';
    } else if (currentMediaTypeFilter === 'tv') {
        trendingSource = cachedRecommendedShows;
        trendingType = 'tv';
        recommendedType = 'tv';
        newReleaseSource = cachedNewReleaseTv;
        newReleaseType = 'tv';
    }

    if (currentAgeRatingFilter.length > 0 || currentMediaTypeFilter !== '' || currentCategoryFilter.length > 0) {
        try {
            const desiredCount = cachedTrendingMovies.length || 20;
            const trendingData = await fetchEnoughDiscoveredItems(trendingType, currentAgeRatingFilter, desiredCount, 1, currentCategoryFilter);
            trendingSource = trendingData.items;
            const recommendedData = await fetchEnoughDiscoveredItems(recommendedType, currentAgeRatingFilter, desiredCount, 1, currentCategoryFilter);
            recommendedSource = recommendedData.items;
            const newReleaseData = await fetchEnoughDiscoveredItems(newReleaseType, currentAgeRatingFilter, desiredCount, 1, currentCategoryFilter);
            newReleaseSource = newReleaseData.items;
        } catch (err) {
            console.error('Error fetching filtered watch now content:', err);
        }
    }

    try {
        // Trending Movies
        const filteredTrending = filterItems(trendingSource);
        displayContentRow('trending-now-row', filteredTrending, isLightMode, onCardClick, isItemSeenFn);
        if (filteredTrending.length === 0 && (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0)) {
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
            updateHeroSection(heroImageUrl, heroTitle, heroOverview, heroItem);
        } else {
            updateHeroSection('', 'Content Not Available', 'Please check back later or try different filters.');
        }

        // Recommended TV Shows
        const filteredRecommended = filterItems(recommendedSource);
        displayContentRow('recommended-row', filteredRecommended, isLightMode, onCardClick, isItemSeenFn);
        if (filteredRecommended.length === 0 && (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0)) {
            recommendedRow.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
        }

        // New Releases (Daily Trending Movies)
        const filteredNewReleases = filterItems(newReleaseSource);
        displayContentRow('new-releases-row', filteredNewReleases, isLightMode, onCardClick, isItemSeenFn);
        if (filteredNewReleases.length === 0 && (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0)) {
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
export async function populateExploreTab(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, exploreCategory, isLightMode, onCardClick, isItemSeenFn) {
    const exploreGrid = document.getElementById('explore-grid-container');
    if (exploreMoviePage === 1 && exploreTvPage === 1 && exploreGrid.innerHTML.trim() === "") {
        exploreGrid.innerHTML = '<p class="loading-message">Loading movies and shows for you...</p>';
        exploreHasMore = true;
        exploreIsLoading = false;
        await loadMoreExploreItems(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, exploreCategory, isLightMode, onCardClick, isItemSeenFn);
    } else {
        let filteredExploreItems = cachedExploreItems;
        if (currentMediaTypeFilter) {
            filteredExploreItems = filteredExploreItems.filter(item => (item.media_type || (item.title ? 'movie' : 'tv')) === currentMediaTypeFilter);
        }
        if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
            filteredExploreItems = filteredExploreItems.filter(item => {
                const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
                const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []);
                const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
                return ratingOk && categoryOk;
            });
        }
        exploreGrid.innerHTML = ''; // Clear before re-appending filtered items
        appendItemsToGrid(exploreGrid, filteredExploreItems, isLightMode, onCardClick, isItemSeenFn);
        if (filteredExploreItems.length === 0 && (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0)) {
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
export async function loadMoreExploreItems(currentMediaTypeFilter, currentAgeRatingFilter, currentCategoryFilter, exploreCategory, isLightMode, onCardClick, isItemSeenFn) {
    if (exploreIsLoading) return;

    // Restart from the beginning if we've previously reached the end
    if (exploreReachedEnd) {
        exploreMoviePage = 1;
        exploreTvPage = 1;
        exploreReachedEnd = false;
    }

    exploreIsLoading = true;
    const loadingIndicator = document.getElementById('explore-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    const exploreGridContainer = document.getElementById('explore-grid-container');

    try {
        const desiredCount = 20;
        let newItems = [];
        let moviePages = 0;
        let tvPages = 0;

        if (exploreCategory === 'trending') {
            if (currentMediaTypeFilter === 'movie') {
                newItems = await fetchTrendingItems('movie', 'week');
                moviePages = 1;
            } else if (currentMediaTypeFilter === 'tv') {
                newItems = await fetchTrendingItems('tv', 'week');
                tvPages = 1;
            } else {
                const movies = await fetchTrendingItems('movie', 'week');
                const shows = await fetchTrendingItems('tv', 'week');
                newItems = movies.concat(shows).sort((a,b) => (b.popularity||0)-(a.popularity||0));
                moviePages = 1;
                tvPages = 1;
            }
            exploreReachedEnd = true;
        } else if (exploreCategory === 'favorites') {
            if (currentMediaTypeFilter === 'movie') {
                newItems = await fetchTopRatedItems('movie', exploreMoviePage);
                moviePages = 1;
            } else if (currentMediaTypeFilter === 'tv') {
                newItems = await fetchTopRatedItems('tv', exploreTvPage);
                tvPages = 1;
            } else {
                const movies = await fetchTopRatedItems('movie', exploreMoviePage);
                const shows = await fetchTopRatedItems('tv', exploreTvPage);
                newItems = movies.concat(shows).sort((a,b) => (b.vote_average||0)-(a.vote_average||0));
                moviePages = 1;
                tvPages = 1;
            }
        } else if (exploreCategory === 'classics') {
            if (currentMediaTypeFilter === 'movie') {
                newItems = await fetchClassicItems('movie', exploreMoviePage);
                moviePages = 1;
            } else if (currentMediaTypeFilter === 'tv') {
                newItems = await fetchClassicItems('tv', exploreTvPage);
                tvPages = 1;
            } else {
                const movies = await fetchClassicItems('movie', exploreMoviePage);
                const shows = await fetchClassicItems('tv', exploreTvPage);
                newItems = movies.concat(shows).sort((a,b)=>(b.vote_average||0)-(a.vote_average||0));
                moviePages = 1;
                tvPages = 1;
            }
        } else if (exploreCategory === 'recommended') {
            newItems = [];
            const seen = getSeenItems();
            if (seen && seen.length > 0) {
                const base = seen[Math.floor(Math.random() * seen.length)];
                newItems = await fetchRecommendations(base.id, base.type);
            } else {
                const movies = await fetchTrendingItems('movie', 'week');
                const shows = await fetchTrendingItems('tv', 'week');
                newItems = movies.concat(shows).sort((a,b)=>(b.popularity||0)-(a.popularity||0));
            }
            exploreReachedEnd = true;
            moviePages = 1;
            tvPages = 1;
        } else {
            if (currentMediaTypeFilter === 'movie') {
                const { items, pagesFetched } = await fetchEnoughDiscoveredItems('movie', currentAgeRatingFilter, desiredCount, exploreMoviePage, currentCategoryFilter);
                newItems = items;
                moviePages = pagesFetched;
            } else if (currentMediaTypeFilter === 'tv') {
                const { items, pagesFetched } = await fetchEnoughDiscoveredItems('tv', currentAgeRatingFilter, desiredCount, exploreTvPage, currentCategoryFilter);
                newItems = items;
                tvPages = pagesFetched;
            } else {
                const movieCount = Math.ceil(desiredCount / 2);
                const tvCount = desiredCount - movieCount;

                let { items: movieItems, pagesFetched: mPages } = await fetchEnoughDiscoveredItems('movie', currentAgeRatingFilter, movieCount, exploreMoviePage, currentCategoryFilter);
                let { items: tvItems, pagesFetched: tPages } = await fetchEnoughDiscoveredItems('tv', currentAgeRatingFilter, tvCount, exploreTvPage, currentCategoryFilter);

                const fetchedTotal = movieItems.length + tvItems.length;

                if (fetchedTotal < desiredCount) {
                    const remaining = desiredCount - fetchedTotal;
                    if (movieItems.length < movieCount) {
                        const { items: extraTvItems, pagesFetched: extraTvPages } = await fetchEnoughDiscoveredItems('tv', currentAgeRatingFilter, remaining, exploreTvPage + tPages, currentCategoryFilter);
                        tvItems = tvItems.concat(extraTvItems);
                        tPages += extraTvPages;
                    } else if (tvItems.length < tvCount) {
                        const { items: extraMovieItems, pagesFetched: extraMoviePages } = await fetchEnoughDiscoveredItems('movie', currentAgeRatingFilter, remaining, exploreMoviePage + mPages, currentCategoryFilter);
                        movieItems = movieItems.concat(extraMovieItems);
                        mPages += extraMoviePages;
                    }
                }

                newItems = movieItems.concat(tvItems).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                moviePages = mPages;
                tvPages = tPages;
            }
        }

        const rawFetchedCount = newItems.length;
        // Remove duplicates based on media type and ID
        newItems = newItems.filter(item => {
            const key = `${item.media_type || (item.title ? 'movie' : 'tv')}_${item.id}`;
            return !loadedExploreItemIds.has(key);
        });
        newItems.forEach(item => {
            const key = `${item.media_type || (item.title ? 'movie' : 'tv')}_${item.id}`;
            loadedExploreItemIds.add(key);
        });

        cachedExploreItems = cachedExploreItems.concat(newItems);

        if (newItems.length > 0) {
            let itemsToDisplay = newItems;
            if (currentAgeRatingFilter.length > 0 || currentCategoryFilter.length > 0) {
                itemsToDisplay = itemsToDisplay.filter(item => {
                    const ratingOk = currentAgeRatingFilter.length === 0 || checkRatingCompatibility(getCertification(item), currentAgeRatingFilter);
                    const genreIds = item.genre_ids || (item.genres ? item.genres.map(g => g.id) : []);
                    const categoryOk = currentCategoryFilter.length === 0 || genreIds.some(id => currentCategoryFilter.includes(String(id)));
                    return ratingOk && categoryOk;
                });
            }

            appendItemsToGrid(exploreGridContainer, itemsToDisplay, isLightMode, onCardClick, isItemSeenFn);
            exploreMoviePage += moviePages;
            exploreTvPage += tvPages;
            if (rawFetchedCount < desiredCount && newItems.length === itemsToDisplay.length) {
                exploreReachedEnd = true;
            }
        } else {
            exploreMoviePage += moviePages;
            exploreTvPage += tvPages;
            if (rawFetchedCount < desiredCount) {
                exploreReachedEnd = true;
            }
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
    exploreMoviePage = 1;
    exploreTvPage = 1;
    exploreIsLoading = false;
    exploreHasMore = true;
    exploreReachedEnd = false;
    cachedExploreItems = [];
    loadedExploreItemIds.clear();
    const exploreGrid = document.getElementById('explore-grid-container');
    if (exploreGrid) {
        exploreGrid.innerHTML = '';
    }
}
