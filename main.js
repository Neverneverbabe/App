// App/main.js
import { fetchTrendingItems, fetchItemDetails, fetchSearchResults, fetchDiscoveredItems } from './api.js';
// Corrected import path for Firebase functions from the now-nested SignIn folder
import { signUp, signIn, signOutUser, onAuthChange, getCurrentUser, saveUserData } from './SignIn/firebase_api.js';
// Updated import path for ratingUtils.js
import { getCertification, checkRatingCompatibility } from './ratingUtils.js';

// Explicitly import each UI function used from ui.js as a named import
import {
    displayContentRow,
    displayItemDetails,
    updateThemeDependentElements,
    updateHeroSection,
    displaySearchResults,
    createContentCardHtml,
    appendItemsToGrid,
    showCustomAlert,
    hideCustomAlert,
    showLoadingIndicator,
    hideLoadingIndicator,
    updateSeenButtonStateInModal,
    renderWatchlistOptionsInModal
} from './ui.js';

// Import constants from config.js
import { TMDB_BACKDROP_BASE_URL } from './config.js';

// Import auth-related functions from auth.js
import { initAuthRefs, handleAuthStateChanged } from './SignIn/auth.js'; // Added handleAuthStateChanged

// --- Global variables to store fetched data for re-filtering without new API calls ---
let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedSearchResults = [];
let cachedExploreItems = []; // Cache for items fetched in the Explore tab
let localUserSeenItemsCache = []; // Cache for seen items for the current user
let firestoreWatchlistsCache = []; // Global cache for Firestore watchlists

// --- Global variable for current filter state ---
let currentAgeRatingFilter = []; // Default to no filter (empty array means 'All Ratings')
let currentSelectedLibraryFolder = null; // To keep track of the selected folder in the Library tab

// --- Explore Tab State ---
let exploreCurrentPage = 1;
let exploreIsLoading = false;
let exploreHasMore = true;

// Debounce timer for search input
let searchTimer = null;
const SEARCH_DEBOUNCE_DELAY = 500; // milliseconds

document.addEventListener('DOMContentLoaded', async () => {
    // PWA: Service Worker registration for offline capabilities
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // --- DOM Element References ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const filterButton = document.getElementById('filter-button');
    const filterOptionsList = document.getElementById('filter-options-list');
    const filterOptionsItemsContainer = document.getElementById('filter-options-items-container');
    const filterApplyBtn = document.getElementById('filter-apply-btn');
    const filterClearBtn = document.getElementById('filter-clear-btn');
    const body = document.body;
    const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
    const sidebarToggleIcon = sidebarToggleButton ? sidebarToggleButton.querySelector('i') : null; // Get the icon element
    const currentTabNameDisplay = document.getElementById('current-tab-name-display');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mainNav = document.getElementById('main-nav'); // This is the sidebar
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResultsContainer = document.getElementById('search-results-container');
    // Mobile Sidebar Button Elements
    const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
    const filterButtonMobile = document.getElementById('filter-button-mobile');
    const searchButtonMobile = document.getElementById('search-button-mobile');
    const profileButtonMobile = document.getElementById('profile-button-mobile');

    // Secondary Sidebar Elements
    const secondarySidebarButton = document.getElementById('secondary-sidebar-button');
    const secondarySidebar = document.getElementById('secondary-sidebar');
    const closeSecondarySidebarButton = secondarySidebar ? secondarySidebar.querySelector('.close-secondary-sidebar') : null;

    const libraryFoldersRow = document.getElementById('library-folders-row');
    const selectedFolderTitleElement = document.getElementById('selected-folder-title');
    const librarySelectedFolderMoviesRow = document.getElementById('library-selected-folder-movies-row');

    // New Auth UI Elements
    const profileMenuContainer = document.getElementById('profile-menu-container');
    const profileMenuButton = document.getElementById('profile-menu-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileStatus = document.getElementById('profile-status');
    const profileSignInBtn = document.getElementById('profile-signin-btn');
    const profileSignUpBtn = document.getElementById('profile-signup-btn');
    const profileSignOutBtn = document.getElementById('profile-signout-btn');

    const authModal = document.getElementById('auth-modal');
    const authModalCloseButton = authModal.querySelector('.close-button');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authForm = document.getElementById('auth-form');
    const nameInputGroup = document.getElementById('signup-name-group');
    const nameInput = document.getElementById('name-input');
    const authEmailInput = document.getElementById('auth-email-input');
    const authPasswordInput = document.getElementById('auth-password-input');
    const confirmPasswordGroup = document.getElementById('signup-confirm-password-group');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const authSubmitButton = document.getElementById('auth-submit-button');
    const authSwitchLink = document.getElementById('auth-switch-link');

    // Initialize auth.js with necessary UI elements and the showCustomAlert function from ui.js
    initAuthRefs({
        authDropdownMenu: profileDropdown,
    }, null, showCustomAlert); // Pass showCustomAlert directly to auth.js

    // Set the current year in the footer dynamically
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup: checks if light mode is active, then updates UI elements
    let isLightMode = false; // Default to dark mode
    updateThemeDependentElements(isLightMode); // Direct access via named import

    // --- Firebase Auth State Change Listener ---
    // This listener updates UI based on user sign-in/out status and triggers data loads.
    onAuthChange(async (user) => {
        // Delegate UI updates for auth state changes to auth.js's handleAuthStateChanged function
        await handleAuthStateChanged(user);

        // Continue with main.js specific logic that depends on auth state
        if (user) {
            console.log("Auth state changed: User signed in - UID:", user.uid, "Display Name:", user.displayName);
            await loadUserSeenItems(); // Load seen items from Firestore for the signed-in user
            await loadUserFirestoreWatchlists(); // Load watchlists from Firestore for the signed-in user
            // If the auth modal is open, close it after successful sign-in
            if (authModal.style.display === 'flex') {
                hideCustomAlert(); // Use main's hideCustomAlert from ui.js
            }
        } else {
            console.log("Auth state changed: User signed out");
            // Clear local caches if user signs out
            localUserSeenItemsCache = [];
            firestoreWatchlistsCache = [];
            // Ensure window.firestoreWatchlistsCache is also cleared when user signs out
            window.firestoreWatchlistsCache = [];
        }
        // Re-populate the currently active tab content to reflect auth state changes (e.g., seen status)
        populateCurrentTabContent();
    });

    // --- Core Functions ---

    /**
     * Handles the click event on a content card, fetching and displaying item details in a modal.
     * @param {number} id - The ID of the movie or TV show.
     * @param {'movie'|'tv'} type - The media type ('movie' or 'tv').
     */
    const onCardClick = async (id, type) => {
        try {
            showLoadingIndicator('Fetching item details...'); // Direct access via named import
            console.log(`Fetching details for ID: ${id}, Type: ${type}`);
            const details = await fetchItemDetails(id, type); // Fetch detailed information
            console.log("Fetched details:", details);
            displayItemDetails(details, type, isLightMode); // Direct access via named import
            // Update the "Mark as Seen" button state and watchlist options in the modal after content is displayed
            updateSeenButtonStateInModal(details.id, type, isItemSeen); // Direct access via named import
            renderWatchlistOptionsInModal(details); // Direct access via named import
        } catch (error) {
            console.error("Error fetching item details for modal:", error);
            showCustomAlert('Error', `Could not load item details. Please check your network connection and TMDB API key. Error: ${error.message}`); // Direct access via named import
        } finally {
            hideLoadingIndicator(); // Direct access via named import
        }
    };

    /**
     * Switches the active tab in the main content area.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'watch-now-tab').
     */
    function switchToTab(tabId) { // Renamed to match provided code
        console.log(`[DEBUG] switchTab called with: ${tabId}`); // New log

        // Remove 'active-tab' class from all tab content sections
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        // Add 'active-tab' class to the target tab content section
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active-tab');
            console.log(`[DEBUG] Added active-tab to: ${tabId}`); // New log
            // Update tab name display
            const label = document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.textContent || '';
            if (currentTabNameDisplay) currentTabNameDisplay.textContent = label;
            } else {
            console.error(`[DEBUG] Could not find tab content element with ID: ${tabId}`); // New log
            return; // Exit if tab content not found
        }

        // Update active navigation link styling
        mainNav.querySelectorAll('a.tab-link').forEach(link => link.classList.remove('active-nav-link'));
        const activeNavLink = document.querySelector(`#main-nav a[data-tab="${tabId}"]`);
        if (activeNavLink) {
            activeNavLink.classList.add('active-nav-link');
            console.log(`[DEBUG] Added active-nav-link to link for: ${tabId}`); // New log
        } else {
            console.warn(`[DEBUG] Could not find nav link to style for tab: ${tabId}`); // New log
        }

        // Toggle visibility of the hero section based on the active tab
        const watchNowTabElement = document.getElementById('watch-now-tab'); // Renamed to avoid conflict
        if (watchNowTabElement) {
            const heroSection = watchNowTabElement.querySelector('.hero-section');
            if (tabId === 'watch-now-tab') {
                if (heroSection) heroSection.style.display = 'flex'; // Show hero section for 'Watch TV+' tab
            } else {
                if (heroSection) heroSection.style.display = 'none'; // Hide for other tabs
            }
        }

        // Re-populate content for the newly active tab
        console.log(`[DEBUG] Calling populateCurrentTabContent for ${tabId}`); // New log
        populateCurrentTabContent();

        // Close sidebar after tab selection
        mainNav?.classList.remove('sidebar-open');
        secondarySidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('active');
        if (mainNav?.classList.contains('sidebar-open') === false) updateSidebarButtonState(false); // Ensure icon updates
        console.log(`[DEBUG] switchTab for ${tabId} finished.`); // New log
    }

    /**
     * Attaches event listeners to the seen toggle icons on all content cards within a given container.
     * This function is made global so that ui.js can call it after rendering cards.
     * @param {HTMLElement} containerElement - The DOM element whose children contain content cards.
     */
    window.attachSeenToggleListenersToCards = (containerElement) => {
        containerElement.querySelectorAll('.seen-toggle-icon').forEach(icon => {
            // Clone and replace the node to remove any old event listeners
            const newIcon = icon.cloneNode(true);
            icon.parentNode.replaceChild(newIcon, icon);

            newIcon.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent the card click event from firing
                const card = newIcon.closest('.content-card');
                const itemId = parseInt(card.dataset.id);
                const itemType = card.dataset.type;

                try {
                    // Fetch full details before toggling, as toggleSeenStatus expects it
                    const details = await fetchItemDetails(itemId, itemType);
                    await toggleSeenStatus(details, itemType); // Toggle status in Firestore
                    const newSeenStatus = isItemSeen(itemId, itemType); // Check new status
                    newIcon.classList.toggle('item-is-seen', newSeenStatus); // Update icon styling
                    newIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen'; // Update tooltip
                } catch (error) {
                    console.error("Error fetching details for seen toggle on card:", error);
                    showCustomAlert('Error', `Could not update seen status: ${error.message}`); // Direct access via named import
                }
            });
        });
    };

    /**
     * Populates the content of the currently active tab.
     * This function orchestrates data fetching and display based on the active tab and current filters.
     */
    async function populateCurrentTabContent() {
        console.log("%c[DEBUG] populateCurrentTabContent called", "background: #222; color: #bada55");
        const activeTabElement = document.querySelector('.tab-content.active-tab');
        if (!activeTabElement) {
            console.error("%c[CRITICAL_ERROR] No active tab element found in populateCurrentTabContent. Page will be blank.", "color: red; font-weight: bold;");
            return;
        }

        const activeTabId = activeTabElement.id;

        try {
            switch (activeTabId) {
                case 'watch-now-tab':
                    // Display loading messages initially for each row
                    document.getElementById('trending-now-row').innerHTML = '<p class="loading-message">Loading trending movies...</p>';
                    document.getElementById('recommended-row').innerHTML = '<p class="loading-message">Loading recommended content...</p>';
                    document.getElementById('new-releases-row').innerHTML = '<p class="loading-message">Loading new releases...</p>';

                    // Fetch trending movies if not cached
                    if (cachedTrendingMovies.length === 0) {
                        console.log("Fetching trending movies...");
                        cachedTrendingMovies = await fetchTrendingItems('movie', 'week');
                        console.log("Trending Movies fetched:", cachedTrendingMovies);
                    }
                    // Filter trending movies based on current age rating filter
                    const filteredTrending = currentAgeRatingFilter.length > 0
                        ? cachedTrendingMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedTrendingMovies;
                    // Display filtered trending movies
                    displayContentRow('trending-now-row', filteredTrending, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                    if (filteredTrending.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('trending-now-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

                    // Update the hero section with the first trending item or a placeholder
                    const heroSourceList = (filteredTrending.length > 0) ? filteredTrending : cachedTrendingMovies;
                    if (heroSourceList.length > 0) {
                        const heroItem = heroSourceList[0];
                        const heroImageUrl = (typeof heroItem.backdrop_path === 'string' && heroItem.backdrop_path)
                            ? `${TMDB_BACKDROP_BASE_URL}${heroItem.backdrop_path}`
                            : '';
                        const heroTitle = heroItem.title || heroItem.name || 'Featured Content';
                        const heroOverview = heroItem.overview || 'No description available.';
                        updateHeroSection(heroImageUrl, heroTitle, heroOverview);
                    } else {
                        // Display a default hero state if no items are available
                        updateHeroSection('', 'Content Not Available', 'Please check back later or try different filters.');
                    }
                    // Fetch trending TV shows if not cached (used for "Because You Watched...")
                    if (cachedRecommendedShows.length === 0) {
                        console.log("Fetching trending TV shows...");
                        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
                        console.log("Recommended Shows fetched:", cachedRecommendedShows);
                    }
                    // Filter recommended shows
                    const filteredRecommended = currentAgeRatingFilter.length > 0
                        ? cachedRecommendedShows.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedRecommendedShows;
                    displayContentRow('recommended-row', filteredRecommended, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                    if (filteredRecommended.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('recommended-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

                    // Fetch daily trending movies (for "New Releases")
                    if (cachedNewReleaseMovies.length === 0) {
                        console.log("Fetching daily trending movies...");
                        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
                        console.log("New Releases fetched:", cachedNewReleaseMovies);
                    }
                    // Filter new releases
                    const filteredNewReleases = currentAgeRatingFilter.length > 0
                        ? cachedNewReleaseMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedNewReleaseMovies;
                    displayContentRow('new-releases-row', filteredNewReleases, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                    if (filteredNewReleases.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('new-releases-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

                    // Attach seen toggle listeners to all cards in the watch-now tab
                    // These are exposed globally by ui.js, so direct call is fine
                    window.attachSeenToggleListenersToCards(document.getElementById('trending-now-row'));
                    window.attachSeenToggleListenersToCards(document.getElementById('recommended-row'));
                    window.attachSeenToggleListenersToCards(document.getElementById('new-releases-row'));
                    break;

                case 'explore-tab':
                    const exploreGrid = document.getElementById('explore-grid-container');
                    // Only load new items if it's the first page load or if cleared
                    if (exploreCurrentPage === 1 && exploreGrid.innerHTML.trim() === "") {
                        exploreGrid.innerHTML = '<p class="loading-message">Loading movies for you...</p>';
                        exploreHasMore = true;
                        exploreIsLoading = false; // Reset loading state
                        await loadMoreExploreItems();
                    } else {
                        // If items are already loaded, just re-render with the current filter
                        const filteredExploreItems = currentAgeRatingFilter.length > 0
                            ? cachedExploreItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                            : cachedExploreItems;
                        // Clear the grid and re-append
                        exploreGrid.innerHTML = '';
                        appendItemsToGrid(exploreGrid, filteredExploreItems, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                        if (filteredExploreItems.length === 0 && currentAgeRatingFilter.length > 0) {
                            exploreGrid.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                        }
                    }
                    break;

                case 'library-tab':
                    // Render folders and then movies in the selected folder
                    await renderLibraryFolderCards();
                    await renderMoviesInSelectedFolder(currentSelectedLibraryFolder);
                    break;

                case 'seen-tab':
                    const seenContentDiv = document.getElementById('seen-content');
                    const seenItems = getSeenItems(); // Get seen items from the cache
                    seenContentDiv.innerHTML = ''; // Clear existing content

                    if (seenItems.length === 0) {
                        seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items marked as seen yet.</p>`;
                    } else {
                        const gridContainer = document.createElement('div');
                        gridContainer.className = 'search-results-grid'; // Use the same grid styling as search results

                        // Filter seen items based on current age rating filter
                        const filteredSeenItems = currentAgeRatingFilter.length > 0
                            ? seenItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                            : seenItems;

                        if (filteredSeenItems.length === 0 && currentAgeRatingFilter.length > 0) {
                            seenContentDiv.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No seen items matched the selected filter.</p>`;
                        } else {
                            // Render each filtered seen item as a content card
                            filteredSeenItems.forEach(item => {
                                // Adapt stored item data to match createContentCardHtml expectations
                                const displayItem = { ...item, media_type: item.type, poster_path: item.poster_path };
                                gridContainer.innerHTML += createContentCardHtml(displayItem, isLightMode, isItemSeen); // Direct access via named import
                            });
                            seenContentDiv.appendChild(gridContainer);
                            // Attach seen toggle listeners to cards in the seen tab
                            // These are exposed globally by ui.js, so direct call is fine
                            window.attachSeenToggleListenersToCards(gridContainer);
                        }
                    }
                    break;

                case 'search-tab':
                    // If search input has enough characters and results are cached, re-render with filters
                    if (searchInput.value.trim().length >= 3 && cachedSearchResults.length > 0) {
                        performSearch(true); // Re-render only
                    } else {
                        searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Start typing to find movies and TV shows!</p>`;
                    }
                    break;

                default:
                    console.log('Unknown tab:', activeTabId);
            }
        } catch (error) {
            console.error("Error populating active tab content:", error);
            // Display a user-friendly error message on the tab
            const contentContainer = activeTabElement;
            contentContainer.innerHTML = `
                <section class="content-section" style="text-align: center; margin-top: 50px; padding: 20px; border-radius: 10px; background-color: var(--card-bg); box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    <h3 style="color: var(--text-primary); font-size: 1.875rem; margin-bottom: 1rem;">Content Loading Error</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">We couldn't load content for this tab. This might be due to:</p>
                    <ul style="list-style-type: disc; text-align: left; display: inline-block; color: var(--text-secondary);">
                        <li>An incorrect TMDB API key.</li>
                        <li>Network issues preventing connection to the TMDB API or Firebase.</li>
                        <li>API rate limits being exceeded (try again in a minute).</li>
                    </ul>
                    <p style="color: red; margin-top: 1rem;"><strong>Detailed Error:</strong> ${error.message}</p>
                </section>
            `;
            // Hide the hero section if an error occurs on the watch-now tab
            const heroSection = activeTabElement.querySelector('.hero-section');
            if (heroSection) heroSection.style.display = 'none';
        }
    }

    /**
     * Updates the sidebar toggle button's ARIA attribute and icon.
     * @param {boolean} isOpen - True if the sidebar is to be shown as open, false otherwise.
     */
    function updateSidebarButtonState(isOpen) {
        if (sidebarToggleButton && sidebarToggleIcon) {
            sidebarToggleButton.setAttribute('aria-expanded', isOpen);
            if (isOpen) {
                sidebarToggleIcon.classList.remove('fa-bars');
                sidebarToggleIcon.classList.add('fa-times');
            } else {
                sidebarToggleIcon.classList.remove('fa-times');
                sidebarToggleIcon.classList.add('fa-bars');
            }
        }
    }

    // --- Event Listeners ---

    // Sidebar Toggle Button
    sidebarToggleButton?.addEventListener('click', () => {
        sidebarToggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = mainNav?.classList.toggle('sidebar-open');
            sidebarOverlay?.classList.toggle('active', isOpen); // Sync overlay with sidebar state
            updateSidebarButtonState(isOpen);
        });
    });

    // Helper function to close the right sidebar
    function closeRightSidebar() { // This function is good, let's keep it
        if (secondarySidebar && secondarySidebar.classList.contains('open')) {
            secondarySidebar.classList.remove('open');
            // If the main (left) sidebar is also closed, then deactivate the overlay
            if (!mainNav.classList.contains('sidebar-open')) {
                sidebarOverlay.classList.remove('active');
            }
        }
    }

    // Secondary Sidebar Button (right sidebar)
    secondarySidebarButton?.addEventListener('click', () => {
        secondarySidebarButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (secondarySidebar) {
                secondarySidebar.classList.add('open');
                sidebarOverlay?.classList.add('active');
            }
        });
    });

    // Close button for Secondary Sidebar
    closeSecondarySidebarButton?.addEventListener('click', () => {
        closeSecondarySidebarButton.addEventListener('click', () => {
            if (secondarySidebar) {
                secondarySidebar.classList.remove('open');
                if (!mainNav?.classList.contains('sidebar-open')) {
                    sidebarOverlay?.classList.remove('active');
                }
            }
        });
    });

    // Sidebar Overlay Click to Close
    overlay?.addEventListener('click', () => {
        sidebarOverlay.addEventListener('click', () => {
            if (mainNav?.classList.contains('sidebar-open')) {
                mainNav.classList.remove('sidebar-open');
                updateSidebarButtonState(false); // Update main sidebar button
            }
            if (secondarySidebar && secondarySidebar.classList.contains('open')) {
                secondarySidebar.classList.remove('open');
            }
            sidebarOverlay?.classList.remove('active'); // Deactivate overlay
        });
    });

    // Sidebar Navigation tab clicks
    document.querySelectorAll('#main-nav .tab-link').forEach(link => { // Target links within #main-nav
        link.addEventListener('click', event => {
            event.preventDefault();
            const targetTab = link.getAttribute('data-tab');
            if (targetTab) switchToTab(targetTab);
        });
    });


    
    // Set initial tab name display
    const initialActiveNavLink = mainNav.querySelector('a.tab-link.active-nav-link');
    if (initialActiveNavLink) currentTabNameDisplay.textContent = initialActiveNavLink.textContent.trim();

    // --- Mobile Secondary Sidebar Button Event Listeners ---
    themeToggleMobileBtn?.addEventListener('click', () => {
        themeToggleMobileBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            isLightMode = body.classList.contains('light-mode');
            updateThemeDependentElements(isLightMode);
            populateCurrentTabContent();
            closeRightSidebar(); // Use the existing helper
        });
    });

    if (filterButtonMobile) {
        filterButtonMobile.addEventListener('click', () => {
            closeRightSidebar();
            // Programmatically open the main filter dropdown
            if (filterButton && filterOptionsList && filterOptionsItemsContainer) {
                const isOpen = filterOptionsList.style.display === 'block';
                if (!isOpen) {
                    tempSelectedFilters = currentAgeRatingFilter.length === 0 ? [""] : [...currentAgeRatingFilter];
                    renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters);
                    filterOptionsList.style.display = 'block';
                    positionPopup(filterButton, filterOptionsList); // Position relative to the main filter button
                } else {
                    // If it was somehow already open, ensure it's correctly positioned or just leave it.
                    // For simplicity, we'll assume it wasn't open or that re-positioning is fine.
                    positionPopup(filterButton, filterOptionsList);
                }
            }
        });
    }

    searchButtonMobile?.addEventListener('click', () => {
        searchButtonMobile.addEventListener('click', () => {
            switchToTab('search-tab'); // switchToTab now handles closing both sidebars
            // closeRightSidebar(); // No longer needed here as switchToTab handles it
        });
    });

    profileButtonMobile?.addEventListener('click', () => {
        profileButtonMobile.addEventListener('click', () => {
            const user = getCurrentUser();
            if (user) {
                // Toggle the main profile dropdown if user is signed in
                if (profileDropdown) {
                    profileDropdown.classList.toggle('show');
                }
            } else {
                // Open sign-in modal if user is not signed in
                openAuthModal('signin');
            }
            closeRightSidebar(); // Use the existing helper
        });
    });

    // Header search button click (also switches to search tab)
    const headerSearchButton = document.querySelector('.icon-buttons button[data-tab="search-tab"]');
    if (headerSearchButton) {
        headerSearchButton.addEventListener('click', (event) => {
            event.preventDefault();
            const tabId = headerSearchButton.dataset.tab;
            if (tabId) switchToTab(tabId);
        });
    }

    // Theme toggle button click
    themeToggleBtn?.addEventListener('click', () => {
        body.classList.toggle('light-mode'); // Toggle 'light-mode' class on the body
        isLightMode = body.classList.contains('light-mode'); // Update state variable
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark'); // Save theme preference
        updateThemeDependentElements(isLightMode); // Direct access via named import
        populateCurrentTabContent(); // Re-populate content to update card/image styling
    });

    // --- Filter Dropdown Logic & State ---
    let tempSelectedFilters = []; // Temporary array to hold selections before 'Apply'

    // Load saved theme preference on DOMContentLoaded
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' && !body.classList.contains('light-mode')) {
        body.classList.add('light-mode');
        isLightMode = true;
        updateThemeDependentElements(isLightMode);
    }

    /**
     * Renders filter options in the dropdown, marking currently selected ones.
     * @param {HTMLElement} container - The container element for filter items.
     * @param {string[]} selectedFilters - Array of currently selected filter values.
     */
    function renderFilterDropdownOptions(container, selectedFilters) {
        // Static list of age rating options
        container.innerHTML = `
            <div class="dropdown-item filter-option-item" data-rating="">All Ratings <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="G">G <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG">PG <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG-13">PG-13 <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="R">R <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="NC-17">NC-17 <span class="checkmark">✔</span></div>
        `;
        // Add 'item-selected' class to items that are in the selectedFilters array
        container.querySelectorAll('.filter-option-item').forEach(item => {
            const ratingValue = item.dataset.rating;
            if (selectedFilters.includes(ratingValue) || (selectedFilters.length === 0 && ratingValue === "")) {
                item.classList.add('item-selected');
            } else {
                item.classList.remove('item-selected');
            }
        });
    }

    // Function to position popup correctly (e.g., filter dropdown)
    function positionPopup(anchorElement, popupElement) {
        const rect = anchorElement.getBoundingClientRect();
        // Position popup to the right and below the anchor, aligning its right edge with the anchor's right edge
        popupElement.style.top = `${rect.bottom + 5}px`; // 5px below the button
        popupElement.style.right = '0px'; // Align right edges
        // Adjust width if needed, or let CSS control it
        // popupElement.style.width = `${rect.width}px`;
    }

    // Filter button click handler
    if (filterButton && filterOptionsList && filterOptionsItemsContainer && filterApplyBtn && filterClearBtn) {
        filterButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click listener from immediately closing it
            const isOpen = filterOptionsList.style.display === 'block';
            if (!isOpen) {
                // When opening, initialize temp filters with current filters (or "All Ratings")
                tempSelectedFilters = currentAgeRatingFilter.length === 0 ? [""] : [...currentAgeRatingFilter];
                renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters);
                filterOptionsList.style.display = 'block'; // Show the dropdown
                positionPopup(filterButton, filterOptionsList); // Position it relative to the button
            } else {
                filterOptionsList.style.display = 'none'; // Hide if already open
            }
        });

        // Click handler for individual filter options
        filterOptionsItemsContainer.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent closing dropdown immediately
            const target = event.target.closest('.filter-option-item');
            if (!target || target.dataset.rating === undefined) return;

            const ratingValue = target.dataset.rating;

            if (ratingValue === "") { // If "All Ratings" is clicked
                tempSelectedFilters = [""]; // Select only "All Ratings"
            } else {
                // Remove "All Ratings" if any specific rating is selected
                const allRatingsIndex = tempSelectedFilters.indexOf("");
                if (allRatingsIndex > -1) {
                    tempSelectedFilters.splice(allRatingsIndex, 1);
                }
                const index = tempSelectedFilters.indexOf(ratingValue);
                if (index > -1) {
                    tempSelectedFilters.splice(index, 1); // Deselect if already selected
                } else {
                    tempSelectedFilters.push(ratingValue); // Select if not selected
                }
                // If all specific ratings are deselected, default back to "All Ratings"
                if (tempSelectedFilters.length === 0) {
                    tempSelectedFilters = [""];
                }
            }
            renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters); // Re-render with new selections
        });

        // Apply filters button click handler
        filterApplyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // If "All Ratings" is selected or no specific ratings are selected, clear the filter
            if (tempSelectedFilters.includes("") || tempSelectedFilters.length === 0) {
                currentAgeRatingFilter = [];
            } else {
                currentAgeRatingFilter = [...tempSelectedFilters]; // Apply temp selections
            }
            filterOptionsList.style.display = 'none'; // Hide dropdown
            // Add/remove 'filter-active' class to the filter button for visual feedback
            filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0);
            populateCurrentTabContent(); // Re-populate content with new filter applied
        });

        // Clear filters button click handler
        filterClearBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            tempSelectedFilters = [""]; // Reset temp selections to "All Ratings"
            renderFilterDropdownOptions(filterOptionsItemsContainer, tempSelectedFilters); // Update dropdown display
        });

        // Close dropdown when clicking anywhere outside of it
        document.addEventListener('click', (event) => {
            if (filterOptionsList.style.display === 'block' && !filterOptionsList.contains(event.target) && event.target !== filterButton && !filterButton.contains(event.target)) {
                filterOptionsList.style.display = 'none';
            }
        });
    }

    // Initial check to set filter button active state if any filter is already applied
    if (filterButton) {
        filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0);
    }

    // --- Explore Tab Infinite Scroll ---
    const exploreGridContainer = document.getElementById('explore-grid-container');

    /**
     * Loads more items for the Explore tab using infinite scrolling.
     */
    async function loadMoreExploreItems() {
        if (exploreIsLoading || !exploreHasMore) return; // Prevent multiple simultaneous loads or loading if no more items

        exploreIsLoading = true;
        const loadingIndicator = document.getElementById('explore-loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block'; // Show loading indicator

        try {
            // Fetch discovered movies (using 'movie' for general explore content)
            const items = await fetchDiscoveredItems('movie', currentAgeRatingFilter, exploreCurrentPage);
            cachedExploreItems = cachedExploreItems.concat(items); // Add new items to cache

            if (items.length > 0) {
                // Filter newly fetched items based on current age rating filter before appending
                const itemsToDisplay = currentAgeRatingFilter.length > 0
                    ? items.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedExploreItems;
                appendItemsToGrid(exploreGridContainer, itemsToDisplay, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                exploreCurrentPage++; // Increment page for next fetch
                // If fewer items than expected are returned, assume no more pages
                if (items.length < 20) { // Assuming 20 items per page from TMDB discover API
                    exploreHasMore = false;
                }
            } else {
                exploreHasMore = false; // No more items to load
            }
        } catch (error) {
            console.error("Error loading more explore items:", error);
            showCustomAlert('Error', `Failed to load more content for Explore: ${error.message}`); // Direct access via named import
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide loading indicator
            exploreIsLoading = false; // Reset loading state
        }
    }

    // Event listener for infinite scroll on the window
    window.addEventListener('scroll', () => {
        const exploreTab = document.getElementById('explore-tab');
        // Only trigger if on the explore tab and near the bottom of the page
        if (!exploreTab || !exploreTab.classList.contains('active-tab')) return;

        // Check if user has scrolled near the bottom (300px from the end)
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 300) {
            loadMoreExploreItems(); // Load more items
        }
    });

    // --- Profile Menu and Auth Modal Logic ---

    // Toggle profile dropdown visibility
    profileMenuButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent document click from closing it immediately
        profileDropdown.classList.toggle('show');
    });

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!profileMenuContainer.contains(event.target) && profileDropdown.classList.contains('show')) {
            profileDropdown.classList.remove('show');
        }
    });

    /**
     * Updates the text and button visibility within the profile dropdown based on user authentication status.
     * @param {object|null} user - The Firebase User object, or null if no user is signed in.
     */
    function updateProfileMenuUI(user) {
        if (user) {
            profileStatus.textContent = `Signed in as ${user.displayName || user.email}`;
            profileSignInBtn.style.display = 'none';
            profileSignUpBtn.style.display = 'none';
            profileSignOutBtn.style.display = 'block';
        } else {
            profileStatus.textContent = 'Not Signed In';
            profileSignInBtn.style.display = 'block';
            profileSignUpBtn.style.display = 'block';
            profileSignOutBtn.style.display = 'none';
        }
    }

    /**
     * Opens the authentication modal in either 'signin' or 'signup' mode.
     * @param {'signin'|'signup'} mode - The mode to open the modal in.
     */
    function openAuthModal(mode) {
        authModal.style.display = 'flex'; // Make modal visible
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        setAuthModalMode(mode); // Configure modal for sign-in or sign-up
    }

    /**
     * Closes the authentication modal.
     */
    function closeAuthModal() {
        authModal.style.display = 'none'; // Hide modal
        document.body.style.overflow = ''; // Restore background scrolling
        authForm.reset(); // Clear form fields
    }

    /**
     * Configures the authentication modal UI for either sign-in or sign-up.
     * @param {'signin'|'signup'} mode - The desired mode.
     */
    function setAuthModalMode(mode) {
        if (mode === 'signup') {
            authModalTitle.textContent = 'Sign Up';
            nameInputGroup.style.display = 'block'; // Show name input group
            confirmPasswordGroup.style.display = 'block'; // Show confirm password group
            authSubmitButton.textContent = 'Sign Up';
            authSwitchLink.textContent = "Already have an account? Sign In";
            nameInput.setAttribute('required', 'true'); // Make name required
            confirmPasswordInput.setAttribute('required', 'true'); // Make confirm password required
        } else { // 'signin'
            authModalTitle.textContent = 'Sign In';
            nameInputGroup.style.display = 'none'; // Hide name input group
            confirmPasswordGroup.style.display = 'none'; // Hide confirm password group
            authSubmitButton.textContent = 'Sign In';
            authSwitchLink.textContent = "Don't have an account? Sign Up";
            nameInput.removeAttribute('required'); // Remove required attribute
            confirmPasswordInput.removeAttribute('required'); // Remove required attribute
        }
    }

    // Event listeners for profile dropdown buttons and auth modal
    profileSignInBtn.addEventListener('click', () => openAuthModal('signin'));
    profileSignUpBtn.addEventListener('click', () => openAuthModal('signup'));
    profileSignOutBtn.addEventListener('click', async () => {
        try {
            showLoadingIndicator('Signing out...'); // Direct access via named import
            await signOutUser(); // Call Firebase signOut function
            profileDropdown.classList.remove('show'); // Hide dropdown
            showCustomAlert('Success', 'You have been signed out.'); // Direct access via named import
        } catch (error) {
            console.error("Error signing out:", error);
            showCustomAlert('Error', `Sign out failed: ${error.message}`); // Direct access via named import
        } finally {
            hideLoadingIndicator(); // Direct access via named import
        }
    });

    authModalCloseButton.addEventListener('click', closeAuthModal);
    // Close auth modal if click outside content area
    authModal.addEventListener('click', (event) => {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });

    // Toggle between sign-in and sign-up forms
    authSwitchLink.addEventListener('click', () => {
        const currentMode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        setAuthModalMode(currentMode === 'signin' ? 'signup' : 'signin');
        authForm.reset(); // Reset form when switching modes
    });

    // Handle authentication form submission (sign in or sign up)
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission
        const mode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        let name = nameInput.value;
        const confirmPassword = confirmPasswordInput.value;

        showLoadingIndicator('Processing...'); // Direct access via named import
        try {
            if (mode === 'signup') {
                if (!name.trim()) {
                    showCustomAlert('Error', 'Please enter your full name.'); // Direct access via named import
                    return; // Stop execution if name is missing
                }
                if (password !== confirmPassword) {
                    showCustomAlert('Error', 'Passwords do not match.'); // Direct access via named import
                    return; // Stop execution if passwords don't match
                }
                await signUp(name, email, password); // Call Firebase signUp function
                showCustomAlert('Success', 'Account created successfully! You are now signed in.'); // Direct access via named import
            } else { // signin
                await signIn(email, password); // Call Firebase signIn function
                showCustomAlert('Success', 'Signed in successfully!'); // Direct access via named import
            }
            closeAuthModal(); // Close modal on success
        } catch (error) {
            console.error("Authentication error:", error);
            let errorMessage = "An unknown error occurred.";
            // Provide more specific error messages for common Firebase auth errors
            if (error.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use': errorMessage = 'The email address is already in use by another account.'; break;
                    case 'auth/invalid-email': errorMessage = 'The email address is not valid.'; break;
                    case 'auth/operation-not-allowed': errorMessage = 'Email/password accounts are not enabled. Contact support.'; break;
                    case 'auth/weak-password': errorMessage = 'The password is too weak. Please use at least 6 characters.'; break;
                    case 'auth/user-disabled': errorMessage = 'This user account has been disabled.'; break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password': errorMessage = 'Invalid email or password.'; break;
                    case 'auth/network-request-failed': errorMessage = 'Network error. Please check your internet connection.'; break;
                    default: errorMessage = `Authentication failed: ${error.message}`;
                }
            } else {
                errorMessage = error.message;
            }
            showCustomAlert('Error', errorMessage); // Direct access via named import
        } finally {
            hideLoadingIndicator(); // Direct access via named import
        }
    });

    // --- Search Functionality ---

    /**
     * Performs a search for movies/TV shows based on the input query.
     * @param {boolean} reRenderOnly - If true, only re-renders existing cached results with current filters;
     * if false, fetches new results from the API.
     */
    async function performSearch(reRenderOnly = false) {
        console.log(`performSearch called. reRenderOnly: ${reRenderOnly}, Query: "${searchInput.value.trim()}"`);
        const query = searchInput.value.trim();

        // If not re-rendering and query is too short, clear results and return
        if (!reRenderOnly && query.length < 3) {
            searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Please enter at least 3 characters to search.</p>`;
            cachedSearchResults = [];
            return;
        }

        // If re-rendering and results are cached, just apply filters and display
        if (reRenderOnly && cachedSearchResults.length > 0) {
            const filteredResults = currentAgeRatingFilter.length > 0
                ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                : cachedSearchResults;
            displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen); // Direct access via named import
            if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search matched the selected filter.</p>`;
            }
            return;
        } else if (!reRenderOnly) {
            // If not re-rendering, show loading and fetch new results
            searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
            try {
                showLoadingIndicator('Searching...'); // Direct access via named import
                console.log(`Fetching search results for query: "${query}"`);
                const results = await fetchSearchResults(query, 'multi'); // Fetch results from TMDB
                cachedSearchResults = results; // Cache the results
                console.log("Search results fetched:", cachedSearchResults);

                // Apply current age rating filter to fetched results
                const filteredResults = currentAgeRatingFilter.length > 0
                    ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedSearchResults;

                displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen); // Direct access via named import
                if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                    searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search for "${query}" matched the selected filter.</p>`;
                } else if (results.length === 0) {
                    searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No results found for "${query}".</p>`;
                }
            } catch (error) {
                console.error("Error performing search:", error);
                searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Error searching for content. Please try again. Error: ${error.message}</p>`;
            } finally {
                hideLoadingIndicator(); // Direct access via named import
            }
        }
    }

    // Debounce search input to avoid excessive API calls
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer); // Clear previous timer
        searchTimer = setTimeout(() => {
            performSearch(false); // Perform search after delay
        }, SEARCH_DEBOUNCE_DELAY);
    });

    // Trigger search immediately on button click
    searchButton.addEventListener('click', () => {
        clearTimeout(searchTimer); // Clear any pending debounced search
        performSearch(false); // Perform search immediately
    });

    // --- Seen Items Logic ---
    let unsubscribeSeenItems = null; // Holds the Firestore unsubscribe function

    // Listen for authentication state changes to manage seen items listener
    onAuthChange((user) => {
        // If a previous listener exists, unsubscribe from it
        if (unsubscribeSeenItems) {
            unsubscribeSeenItems();
            unsubscribeSeenItems = null;
        }

        if (user) {
            // If user is signed in, set up a real-time listener for 'seenItems' collection
            unsubscribeSeenItems = listenToUserCollection('seenItems', (items) => {
                localUserSeenItemsCache = items; // Update local cache with real-time data
                console.log("Real-time Seen Items update:", localUserSeenItemsCache);
                // If on the seen tab, re-populate to reflect changes instantly
                if (document.getElementById('seen-tab').classList.contains('active-tab')) {
                    populateCurrentTabContent();
                }
                // If item detail modal is open, update its seen button state
                const modal = document.getElementById('item-detail-modal');
                if (modal.style.display === 'flex') {
                    const currentItemData = modal.querySelector('#toggle-seen-btn')?.dataset;
                    if (currentItemData) {
                        updateSeenButtonStateInModal(parseInt(currentItemData.id), currentItemData.type, isItemSeen); // Direct access via named import
                    }
                }
                // Update seen icons on all visible content cards
                document.querySelectorAll('.content-card').forEach(card => {
                    const itemId = parseInt(card.dataset.id);
                    const itemType = card.dataset.type;
                    const seenIcon = card.querySelector('.seen-toggle-icon');
                    if (seenIcon) {
                        const newSeenStatus = isItemSeen(itemId, itemType);
                        seenIcon.classList.toggle('item-is-seen', newSeenStatus);
                        seenIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
                    }
                });
            });
        } else {
            localUserSeenItemsCache = []; // Clear cache if user signs out
        }
    });

    /**
     * Loads user's seen items from Firestore into local cache upon initial sign-in.
     */
    async function loadUserSeenItems() {
        const user = getCurrentUser(); // Get current authenticated user
        // Only load if user is signed in and cache is empty
        if (user && localUserSeenItemsCache.length === 0) {
             try {
                const items = await getUserCollection('seenItems'); // Fetch from Firestore
                localUserSeenItemsCache = items;
                console.log("Initial load: User seen items from Firestore:", localUserSeenItemsCache);
            } catch (error) {
                console.error("Error initial loading seen items from Firestore:", error);
                localUserSeenItemsCache = []; // Clear cache on error
            }
        } else if (!user) {
            localUserSeenItemsCache = []; // Ensure cache is empty if no user
        }
    }

    /**
     * Returns the current list of seen items from the local cache.
     * @returns {Array} An array of seen item objects.
     */
    function getSeenItems() {
        return localUserSeenItemsCache;
    }

    /**
     * Checks if a specific item is marked as seen by the current user.
     * @param {number} itemId - The ID of the item.
     * @param {string} itemType - The type of the item ('movie' or 'tv').
     * @returns {boolean} True if the item is seen, false otherwise.
     */
    function isItemSeen(itemId, itemType) {
        const seenItems = getSeenItems();
        // Compare ID and type (ensure ID comparison is string-based to match Firestore IDs)
        return seenItems.some(item => String(item.id) === String(itemId) && item.type === itemType);
    }

    /**
     * Toggles the "seen" status of an item in Firestore.
     * @param {object} itemDetails - The full details object of the item.
     * @param {string} itemType - The type of the item ('movie' or 'tv').
     */
    async function toggleSeenStatus(itemDetails, itemType) {
        const user = getCurrentUser();
        if (!user) {
            showCustomAlert('Info', "Please sign in to mark items as seen."); // Direct access via named import
            return;
        }

        const itemId = itemDetails.id;
        const isCurrentlySeen = isItemSeen(itemId, itemType);

        try {
            showLoadingIndicator('Updating seen status...'); // Direct access via named import
            if (isCurrentlySeen) {
                await deleteUserData( 'seenItems', String(itemId)); // Delete from seen collection
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as unseen.`); // Direct access via named import
            } else {
                // Prepare data for the seen item
                const seenItemData = {
                    type: itemType,
                    title: itemDetails.title || itemDetails.name,
                    poster_path: itemDetails.poster_path,
                    backdrop_path: itemDetails.backdrop_path,
                    overview: itemDetails.overview,
                    release_date: itemDetails.release_date || itemDetails.first_air_date, // Use first_air_date for TV
                    vote_average: itemDetails.vote_average,
                    addedAt: new Date().toISOString() // Store timestamp
                };
                await saveUserData('seenItems', String(itemId), seenItemData); // Save to seen collection
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as seen.`); // Direct access via named import
            }
        } catch (error) {
            console.error("Error toggling seen status in Firestore:", error);
            showCustomAlert('Error', `Error updating seen status: ${error.message}`); // Direct access via named import
        } finally {
            hideLoadingIndicator(); // Direct access via named import
        }
    }

    // Expose toggleSeenStatus globally for ui.js to use in modal
    window.toggleSeenStatus = toggleSeenStatus;

    /**
     * Adds or removes an item from a watchlist (folder) in Firestore.
     * Called by the modal dropdown in ui.js.
     * @param {string} folderId - The Firestore watchlist/folder ID.
     * @param {object} itemDetails - The TMDB item details object.
     * @param {'movie'|'tv'} itemType - The type of the item.
     */
    async function handleAddRemoveItemToFolder(folderId, itemDetails, itemType) {
        try {
            // Find the watchlist in the cache
            const watchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
            if (!watchlist) {
                showCustomAlert("Error", "Watchlist not found.", "error");
                return;
            }
            // Check if item is already in the watchlist
            const exists = watchlist.items.some(
                item => String(item.tmdb_id) === String(itemDetails.id) && item.item_type === itemType
            );
            let updatedItems;
            if (exists) {
                // Remove item
                updatedItems = watchlist.items.filter(
                    item => !(String(item.tmdb_id) === String(itemDetails.id) && item.item_type === itemType)
                );
            } else {
                // Add item
                updatedItems = [
                    ...watchlist.items,
                    {
                        tmdb_id: String(itemDetails.id),
                        item_type: itemType,
                        title: itemDetails.title || itemDetails.name || "",
                        poster_path: itemDetails.poster_path || "",
                        added_at: Date.now()
                    }
                ];
            }
            // Save to Firestore (replace with your Firestore update function)
            await window.saveUserData("watchlists", folderId, { items: updatedItems });
            showCustomAlert("Success", exists ? "Removed from watchlist." : "Added to watchlist.", "success");
        } catch (err) {
            showCustomAlert("Error", "Failed to update watchlist.", "error");
            console.error(err);
        }
    }

    // Expose these functions globally so ui.js can call them from the modal
    window.handleAddRemoveItemToFolder = handleAddRemoveItemToFolder;
    // Expose firestoreWatchlistsCache globally for ui.js to access watchlist data in modal
    window.firestoreWatchlistsCache = firestoreWatchlistsCache;

    /**
     * Renders the library folder (watchlist) cards in the Library tab.
     */
    async function renderLibraryFolderCards() {
        if (!libraryFoldersRow) return;

        libraryFoldersRow.innerHTML = ''; // Clear existing cards

        // Create the "Add New Watchlist" card
        const createNewCard = document.createElement('div');
        createNewCard.className = 'content-card folder-card create-new-folder-card';
        createNewCard.style.cssText = `
            flex-shrink: 0;
            width: 10rem;
            height: 14rem; /* Match content card height */
            background-color: var(--card-bg);
            border: 2px dashed var(--text-secondary);
            border-radius: 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-right: 1rem; /* Consistent spacing */
            margin-bottom: 1rem; /* Consistent spacing */
        `;
        createNewCard.innerHTML = `
            <i class="fas fa-plus" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
            <p style="text-align: center; font-size: 0.9em; font-weight: 500; color: var(--text-secondary);">New Watchlist</p>
        `;
        createNewCard.addEventListener('click', async () => {
            const newFolderName = prompt("Enter new watchlist name:");
            if (newFolderName && newFolderName.trim() !== "") {
                await handleCreateLibraryFolder(newFolderName.trim());
            }
        });
        libraryFoldersRow.appendChild(createNewCard);

        // If no watchlists exist (beyond the "create new" card), display a message
        if (firestoreWatchlistsCache.length === 0) {
            // No need for a separate message, the "New Watchlist" card will be prominent
            return;
        }

        // Render each watchlist as a folder card
        firestoreWatchlistsCache.forEach(folder => {
            // Use the poster of the first item in the folder, or a generic placeholder
            const firstItemPoster = folder.items && folder.items.length > 0 && folder.items[0].poster_path
                ? (folder.items[0].poster_path.startsWith('http') ? folder.items[0].poster_path : `https://image.tmdb.org/t/p/w200${folder.items[0].poster_path}`)
                : "https://placehold.co/150x225/374151/9CA3AF?text=Folder"; // Placeholder for empty or missing poster

            const card = document.createElement('div');
            card.className = 'content-card folder-card'; // Add 'folder-card' class for specific styling
            // Inline styles for basic layout, could be moved to CSS
            card.style.position = 'relative';
            card.style.display = 'inline-block';
            card.style.marginRight = '1rem';
            card.style.marginBottom = '1rem';
            card.style.width = '10rem';
            card.dataset.folderId = folder.id;
            card.dataset.folderName = folder.name; // Store folder name for display/deletion confirmation

            card.innerHTML = `
                <img src="${firstItemPoster}" alt="Folder: ${folder.name}" style="width:100%; height:14rem; object-fit: cover; border-radius:0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <p style="text-align:center; margin-top:0.5rem; font-size:0.9em; font-weight:500; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name} (${folder.items.length})</p>
            `;

            // Add a delete button to each folder card
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑'; // Trash can icon
            deleteBtn.title = 'Delete Watchlist';
            // Styling for the delete button
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '5px';
            deleteBtn.style.right = '5px';
            deleteBtn.style.background = 'rgba(0,0,0,0.4)';
            deleteBtn.style.color = 'white';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '24px';
            deleteBtn.style.height = '24px';
            deleteBtn.style.fontSize = '14px';
            deleteBtn.style.cursor = 'pointer';
            // Attach delete handler
            deleteBtn.onclick = async (e) => {
                e.stopPropagation(); // Prevent the card's click event
                await handleDeleteLibraryFolder(folder.id, folder.name);
            };
            card.appendChild(deleteBtn);

            // Add click listener to select the folder and display its contents
            card.addEventListener('click', (e) => {
                if (e.target === deleteBtn) return; // Ignore if delete button was clicked
                currentSelectedLibraryFolder = folder.id; // Set current selected folder
                renderMoviesInSelectedFolder(folder.id); // Render movies for this folder
                // Add visual highlight to the selected folder card
                libraryFoldersRow.querySelectorAll('.folder-card').forEach(fc => {
                    fc.style.border = '2px solid transparent';
                    fc.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; // Corrected
                });
                card.style.border = `2px solid var(--science-blue)`;
                card.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`; // Corrected
            });

            libraryFoldersRow.appendChild(card);
        });

        // Re-apply highlight to the previously selected folder if it still exists
        if (currentSelectedLibraryFolder) {
            const selectedCard = libraryFoldersRow.querySelector(`.folder-card[data-folder-id="${currentSelectedLibraryFolder}"]`);
            if (selectedCard) {
                selectedCard.style.border = `2px solid var(--science-blue)`;
                selectedCard.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`; // Corrected
            }
        }
    }

    /**
     * Renders the movies contained within a selected library folder (watchlist).
     * @param {string|null} folderId - The ID of the selected folder, or null to show a placeholder.
     */
    async function renderMoviesInSelectedFolder(folderId) {
        if (!selectedFolderTitleElement || !librarySelectedFolderMoviesRow) return;

        if (!folderId) {
            selectedFolderTitleElement.textContent = 'Items in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Select a watchlist above to see its contents.</p>`;
            return;
        }

        // Find the selected watchlist from the cached watchlists
        const selectedWatchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
        if (!selectedWatchlist) {
            selectedFolderTitleElement.textContent = 'Items in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Watchlist not found or has been deleted.</p>`;
            currentSelectedLibraryFolder = null; // Reset selection
            return;
        }

        selectedFolderTitleElement.textContent = `Items in "${selectedWatchlist.name}"`;
        const items = selectedWatchlist.items; // Get items array from the watchlist

        if (items.length === 0) {
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">This watchlist is empty.</p>`;
        } else {
            librarySelectedFolderMoviesRow.innerHTML = ''; // Clear previous content
            // Render each item in the watchlist as a content card
            items.forEach(item => {
                // Adapt stored item data to match createContentCardHtml expectations
                const displayItem = {
                    id: item.tmdb_id,
                    media_type: item.item_type,
                    title: item.title,
                    poster_path: item.poster_path
                };
                const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeen); // Direct access via named import
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtmlString;
                const movieCardElement = tempDiv.firstElementChild;

                // Add click listener to open item details when card is clicked
                movieCardElement.addEventListener('click', () => onCardClick(item.tmdb_id, item.item_type));

                // Add a remove button to each movie card in the folder
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '🗑';
                removeBtn.title = 'Remove from Watchlist';
                removeBtn.style.position = 'absolute';
                removeBtn.style.bottom = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.background = 'rgba(255, 0, 0, 0.6)'; // Red background for delete
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '24px';
                removeBtn.style.height = '24px';
                removeBtn.style.fontSize = '14px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.zIndex = '10'; // Ensure it's above other elements
                removeBtn.onclick = async (e) => {
                    e.stopPropagation(); // Prevent card click event
                    await handleAddRemoveItemToFolder(folderId, displayItem, item.item_type);
                };
                movieCardElement.querySelector('.image-container').appendChild(removeBtn);

                librarySelectedFolderMoviesRow.appendChild(movieCardElement);
            });
            // Attach seen toggle listeners to all cards in the selected folder
            // These are exposed globally by ui.js, so direct call is fine
            window.attachSeenToggleListenersToCards(librarySelectedFolderMoviesRow);
        }
    }
});