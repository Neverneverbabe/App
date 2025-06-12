// App/main.js
import { fetchTrendingItems, fetchItemDetails, fetchSearchResults, fetchDiscoveredItems } from './api.js';
import { signUp, signIn, signOutUser, onAuthChange, getCurrentUser, saveUserData, getUserCollection, deleteUserData, listenToUserCollection } from './SignIn/firebase_api.js';
import { getCertification, checkRatingCompatibility } from './ratingUtils.js';

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

import { TMDB_BACKDROP_BASE_URL } from './config.js';

import { initAuthRefs, handleAuthStateChanged, getFirebaseUserId, canvasSignIn } from './SignIn/auth.js';
import { initializeFirebaseServices, getFirebaseAuth, getFirebaseFirestore } from './SignIn/firebase.js';

let cachedTrendingMovies = [];
let cachedRecommendedShows = [];
let cachedNewReleaseMovies = [];
let cachedSearchResults = [];
let cachedExploreItems = [];
let localUserSeenItemsCache = [];
let firestoreWatchlistsCache = [];

let currentAgeRatingFilter = [];
let currentSelectedLibraryFolder = null;

let exploreCurrentPage = 1;
let exploreIsLoading = false;
let exploreHasMore = true;

let searchTimer = null;
const SEARCH_DEBOUNCE_DELAY = 500;

// Shift the main initialization logic to window.onload
window.onload = async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // --- Firebase Initialization and Auth Setup (Guaranteed availability with polling on window.onload) ---
    // Poll for Firebase configuration. __initial_auth_token may be absent when
    // running outside of Canvas, so only wait for the config itself.
    const pollForFirebaseGlobals = setInterval(async () => {
        if (typeof window.__firebase_config !== 'undefined' || typeof window.firebaseConfig !== 'undefined') {
            clearInterval(pollForFirebaseGlobals); // Stop polling once config is available
            await initializeAndAuthFirebase();
        } else {
            // console.warn("Firebase config not yet available. Waiting on window.onload..."); // Keep commented to reduce noise
        }
    }, 100); // Check every 100ms

    async function initializeAndAuthFirebase() {
        let firebaseConfig;
        if (typeof window.__firebase_config !== 'undefined') {
            try {
                firebaseConfig = JSON.parse(window.__firebase_config);
            } catch (e) {
                console.error('Failed to parse __firebase_config', e);
            }
        }

        if (!firebaseConfig && typeof window.firebaseConfig !== 'undefined') {
            firebaseConfig = window.firebaseConfig;
        }

        const initialAuthToken = window.__initial_auth_token;

        if (!firebaseConfig) {
            console.error('Firebase configuration is not available.');
            showCustomAlert('Error', 'Firebase must be configured before using this application. Please update firebase-config.js with your project details.', 'error');
            return;
        }

        initializeFirebaseServices(firebaseConfig);
        const auth = getFirebaseAuth();
        const db = getFirebaseFirestore();

        if (!auth || !db) {
            console.error("Firebase Auth or Firestore failed to initialize. Check Firebase config.");
            showCustomAlert('Error', 'Firebase services failed to initialize. Please check console for details.', 'error');
            return;
        }

        // Perform initial Canvas sign-in using a custom token if provided
        await canvasSignIn(auth, initialAuthToken);

        // After successful Firebase init and auth, set up the auth state listener
        onAuthChange(async (user) => {
            await handleAuthStateChanged(user);
            if (user) {
                console.log("Auth state changed: User signed in - UID:", user.uid, "Display Name:", user.displayName);
                await loadUserSeenItems();
                await loadUserFirestoreWatchlists();
                // authModal is defined later in window.onload, so check for its existence
                const authModalElement = document.getElementById('auth-modal');
                if (authModalElement && authModalElement.style.display === 'flex') {
                    hideCustomAlert();
                }
            } else {
                console.log("Auth state changed: User signed out");
                localUserSeenItemsCache = [];
                firestoreWatchlistsCache = [];
                window.firestoreWatchlistsCache = []; // Ensure global cache is also cleared on sign out
            }
            populateCurrentTabContent();
        });

        // Initial content population if already authenticated (e.g., after a quick reload)
        // or if a user was previously signed in.
        populateCurrentTabContent();

        setupDelegatedSeenToggleListener();
    }

    /**
     * Sets up a delegated event listener for seen toggle icons on content cards.
     * This listener is attached to the body and handles clicks on '.seen-toggle-icon'.
     */
    function setupDelegatedSeenToggleListener() {
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
                    const details = await fetchItemDetails(itemId, itemType);
                    await toggleSeenStatus(details, itemType); // toggleSeenStatus is globally available

                    const newSeenStatus = isItemSeen(itemId, itemType);
                    seenToggleIcon.classList.toggle('item-is-seen', newSeenStatus);
                    seenToggleIcon.title = newSeenStatus ? 'Mark as Unseen' : 'Mark as Seen';
                } catch (error) {
                    console.error("Error handling seen toggle on card (delegated):", error);
                    showCustomAlert('Error', `Could not update seen status: ${error.message}`);
                }
            }
        });
    }

    // --- DOM Element References (rest of window.onload) ---
    // Moved these inside window.onload as well to ensure they are available
    // when Firebase initialization might trigger subsequent DOM manipulations.
    const themeToggleBtn = document.getElementById('theme-toggle');
    const filterButton = document.getElementById('filter-button');
    const body = document.body;
    const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
    const sidebarToggleIcon = sidebarToggleButton ? sidebarToggleButton.querySelector('i') : null;
    const currentTabNameDisplay = document.getElementById('current-tab-name-display');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mainNav = document.getElementById('main-nav');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResultsContainer = document.getElementById('search-results-container');
    const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
    const filterButtonMobile = document.getElementById('filter-button-mobile');
    const searchButtonMobile = document.getElementById('search-button-mobile');
    const profileButtonMobile = document.getElementById('profile-button-mobile');
    const secondarySidebarButton = document.getElementById('secondary-sidebar-button');
    const secondarySidebar = document.getElementById('secondary-sidebar');
    const closeSecondarySidebarButton = secondarySidebar ? secondarySidebar.querySelector('.close-secondary-sidebar') : null;
    const libraryFoldersRow = document.getElementById('library-folders-row');
    const selectedFolderTitleElement = document.getElementById('selected-folder-title');
    const librarySelectedFolderMoviesRow = document.getElementById('library-selected-folder-movies-row');
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
    const filterModal = document.getElementById('filter-modal');
    const filterModalCloseButton = filterModal.querySelector('.close-button');
    const filterOptionsItemsContainerModal = document.getElementById('filter-options-items-container-modal');
    const filterApplyBtnModal = document.getElementById('filter-apply-btn-modal');
    const filterClearBtnModal = document.getElementById('filter-clear-btn-modal');


    // Initialize auth.js with necessary UI elements and the showCustomAlert function from ui.js
    initAuthRefs({
        authDropdownMenu: profileDropdown,
    }, showCustomAlert);

    // Set the current year in the footer dynamically
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup: checks if light mode is active, then updates UI elements
    let isLightMode = false;
    updateThemeDependentElements(isLightMode);


    // --- Core Functions ---

    /**
     * Handles the click event on a content card, fetching and displaying item details in a modal.
     * @param {number} id - The ID of the movie or TV show.
     * @param {'movie'|'tv'} type - The media type ('movie' or 'tv').
     */
    const onCardClick = async (id, type) => {
        try {
            showLoadingIndicator('Fetching item details...');
            console.log(`Fetching details for ID: ${id}, Type: ${type}`);
            const details = await fetchItemDetails(id, type);
            console.log("Fetched details:", details);
            displayItemDetails(details, type, isLightMode);
            updateSeenButtonStateInModal(details.id, type, isItemSeen);
            renderWatchlistOptionsInModal(details);
        }
        catch (error) {
            console.error("Error fetching item details for modal:", error);
            showCustomAlert('Error', `Could not load item details. Please check your network connection and TMDB API key. Error: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    };

    /**
     * Switches the active tab in the main content area.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'watch-now-tab').
     */
    function switchToTab(tabId) {
        console.log(`[DEBUG] switchTab called with: ${tabId}`);

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active-tab');
            console.log(`[DEBUG] Added active-tab to: ${tabId}`);
            const label = document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.textContent || '';
            if (currentTabNameDisplay) currentTabNameDisplay.textContent = label;
        } else {
            console.error(`[DEBUG] Could not find tab content element with ID: ${tabId}`);
            return;
        }

        mainNav.querySelectorAll('a.tab-link').forEach(link => link.classList.remove('active-nav-link'));
        const activeNavLink = document.querySelector(`#main-nav a[data-tab="${tabId}"]`);
        if (activeNavLink) {
            activeNavLink.classList.add('active-nav-link');
            console.log(`[DEBUG] Added active-nav-link to link for: ${tabId}`);
        } else {
            console.warn(`[DEBUG] Could not find nav link to style for tab: ${tabId}`);
        }

        const watchNowTabElement = document.getElementById('watch-now-tab');
        if (watchNowTabElement) {
            const heroSection = watchNowTabElement.querySelector('.hero-section');
            if (tabId === 'watch-now-tab') {
                if (heroSection) heroSection.style.display = 'flex';
            } else {
                if (heroSection) heroSection.style.display = 'none';
            }
        }

        console.log(`[DEBUG] Calling populateCurrentTabContent for ${tabId}`);
        populateCurrentTabContent();

        mainNav?.classList.remove('sidebar-open');
        secondarySidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = '';
        if (mainNav?.classList.contains('sidebar-open') === false) updateSidebarButtonState(false);
        console.log(`[DEBUG] switchTab for ${tabId} finished.`);
    }

    /**
     * Populates the content of the currently active tab.
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
                    document.getElementById('trending-now-row').innerHTML = '<p class="loading-message">Loading trending movies...</p>';
                    document.getElementById('recommended-row').innerHTML = '<p class="loading-message">Loading recommended content...</p>';
                    document.getElementById('new-releases-row').innerHTML = '<p class="loading-message">Loading new releases...</p>';

                    if (cachedTrendingMovies.length === 0) {
                        console.log("Fetching trending movies...");
                        cachedTrendingMovies = await fetchTrendingItems('movie', 'week');
                        console.log("Trending Movies fetched:", cachedTrendingMovies);
                    }
                    const filteredTrending = currentAgeRatingFilter.length > 0
                        ? cachedTrendingMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedTrendingMovies;
                    displayContentRow('trending-now-row', filteredTrending, isLightMode, onCardClick, isItemSeen);
                    if (filteredTrending.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('trending-now-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

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
                        updateHeroSection('', 'Content Not Available', 'Please check back later or try different filters.');
                    }
                    if (cachedRecommendedShows.length === 0) {
                        console.log("Fetching trending TV shows...");
                        cachedRecommendedShows = await fetchTrendingItems('tv', 'week');
                        console.log("Recommended Shows fetched:", cachedRecommendedShows);
                    }
                    const filteredRecommended = currentAgeRatingFilter.length > 0
                        ? cachedRecommendedShows.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedRecommendedShows;
                    displayContentRow('recommended-row', filteredRecommended, isLightMode, onCardClick, isItemSeen);
                    if (filteredRecommended.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('recommended-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }

                    if (cachedNewReleaseMovies.length === 0) {
                        console.log("Fetching daily trending movies...");
                        cachedNewReleaseMovies = await fetchTrendingItems('movie', 'day');
                        console.log("New Releases fetched:", cachedNewReleaseMovies);
                    }
                    const filteredNewReleases = currentAgeRatingFilter.length > 0
                        ? cachedNewReleaseMovies.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                        : cachedNewReleaseMovies;
                    displayContentRow('new-releases-row', filteredNewReleases, isLightMode, onCardClick, isItemSeen);
                    if (filteredNewReleases.length === 0 && currentAgeRatingFilter.length > 0) {
                        document.getElementById('new-releases-row').innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                    }
                    break;

                case 'explore-tab':
                    const exploreGrid = document.getElementById('explore-grid-container');
                    if (exploreCurrentPage === 1 && exploreGrid.innerHTML.trim() === "") {
                        exploreGrid.innerHTML = '<p class="loading-message">Loading movies for you...</p>';
                        exploreHasMore = true;
                        exploreIsLoading = false;
                        await loadMoreExploreItems();
                    } else {
                        const filteredExploreItems = currentAgeRatingFilter.length > 0
                            ? cachedExploreItems.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                            : cachedExploreItems;
                        exploreGrid.innerHTML = '';
                        appendItemsToGrid(exploreGrid, filteredExploreItems, isLightMode, onCardClick, isItemSeen);
                        if (filteredExploreItems.length === 0 && currentAgeRatingFilter.length > 0) {
                            exploreGrid.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items matched your filter.</p>`;
                        }
                    }
                    break;

                case 'library-tab':
                    await renderLibraryFolderCards();
                    await renderMoviesInSelectedFolder(currentSelectedLibraryFolder);
                    break;

                case 'seen-tab':
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
                            filteredSeenItems.forEach(item => {
                                const displayItem = { ...item, media_type: item.type, poster_path: item.poster_path };
                                gridContainer.innerHTML += createContentCardHtml(displayItem, isLightMode, isItemSeen);
                            });
                            seenContentDiv.appendChild(gridContainer);
                        }
                    }
                    break;

                case 'search-tab':
                    if (searchInput.value.trim().length >= 3 && cachedSearchResults.length > 0) {
                        performSearch(true);
                    } else {
                        searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Start typing to find movies and TV shows!</p>`;
                    }
                    break;

                default:
                    console.log('Unknown tab:', activeTabId);
            }
        } catch (error) {
            console.error("Error populating active tab content:", error);
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
            if (mainNav) {
                mainNav.setAttribute('aria-hidden', (!isOpen).toString());
            }
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
        const isOpen = mainNav?.classList.toggle('sidebar-open');
        sidebarOverlay?.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
        updateSidebarButtonState(isOpen);
    });

    // Helper function to close the right sidebar
    function closeRightSidebar() {
        if (secondarySidebar && secondarySidebar.classList.contains('open')) {
            secondarySidebar.classList.remove('open');
            if (!mainNav.classList.contains('sidebar-open')) {
                sidebarOverlay.classList.remove('active');
            }
        }
    }

    // Secondary Sidebar Button (right sidebar)
    secondarySidebarButton?.addEventListener('click', () => {
        if (secondarySidebar) {
            secondarySidebar.classList.add('open');
            sidebarOverlay?.classList.add('active');
        }
    });

    // Close button for Secondary Sidebar
    closeSecondarySidebarButton?.addEventListener('click', () => {
        if (secondarySidebar) {
            secondarySidebar.classList.remove('open');
            if (!mainNav?.classList.contains('sidebar-open')) {
                sidebarOverlay?.classList.remove('active');
            }
        }
    });

    // Sidebar Overlay Click to Close
    sidebarOverlay?.addEventListener('click', () => {
        if (mainNav?.classList.contains('sidebar-open')) {
            mainNav.classList.remove('sidebar-open');
            document.body.style.overflow = '';
            updateSidebarButtonState(false);
        }
        if (secondarySidebar && secondarySidebar.classList.contains('open')) {
            secondarySidebar.classList.remove('open');
        }
        if (filterModal.style.display === 'flex') {
            closeFilterModal();
        }
        sidebarOverlay?.classList.remove('active');
    });

    // Close sidebar with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mainNav?.classList.contains('sidebar-open')) {
            mainNav.classList.remove('sidebar-open');
            sidebarOverlay?.classList.remove('active');
            document.body.style.overflow = '';
            updateSidebarButtonState(false);
            sidebarToggleButton?.focus();
        }
    });

    // Sidebar Navigation tab clicks
    document.querySelectorAll('#main-nav .tab-link').forEach(link => {
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
        body.classList.toggle('light-mode');
        isLightMode = body.classList.contains('light-mode');
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
        updateThemeDependentElements(isLightMode);
        populateCurrentTabContent();
        closeRightSidebar();
    });

    filterButtonMobile?.addEventListener('click', () => {
        closeRightSidebar();
        openFilterModal();
    });

    searchButtonMobile?.addEventListener('click', () => {
        switchToTab('search-tab');
    });

    profileButtonMobile?.addEventListener('click', () => {
        const user = getCurrentUser(); // Get user via firebase_api.js
        if (user) {
            if (profileDropdown) {
                profileDropdown.classList.toggle('show');
            }
        } else {
            openAuthModal('signin');
        }
        closeRightSidebar();
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
        body.classList.toggle('light-mode');
        isLightMode = body.classList.contains('light-mode');
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
        updateThemeDependentElements(isLightMode);
        populateCurrentTabContent();
    });

    // --- Filter Modal Logic & State ---
    let tempSelectedFilters = [];

    // Load saved theme preference on DOMContentLoaded
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' && !body.classList.contains('light-mode')) {
        body.classList.add('light-mode');
        isLightMode = true;
        updateThemeDependentElements(isLightMode);
    }

    /**
     * Renders filter options in the dropdown/modal, marking currently selected ones.
     * @param {HTMLElement} container - The container element for filter items.
     * @param {string[]} selectedFilters - Array of currently selected filter values.
     */
    function renderFilterDropdownOptions(container, selectedFilters) {
        container.innerHTML = `
            <div class="dropdown-item filter-option-item" data-rating="">All Ratings <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="G">G <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG">PG <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="PG-13">PG-13 <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="R">R <span class="checkmark">✔</span></div>
            <div class="dropdown-item filter-option-item" data-rating="NC-17">NC-17 <span class="checkmark">✔</span></div>
        `;
        container.querySelectorAll('.filter-option-item').forEach(item => {
            const ratingValue = item.dataset.rating;
            if (selectedFilters.includes(ratingValue) || (selectedFilters.length === 0 && ratingValue === "")) {
                item.classList.add('item-selected');
            } else {
                item.classList.remove('item-selected');
            }
        });
    }

    /**
     * Opens the filter modal and populates it with current filter selections.
     */
    function openFilterModal() {
        filterModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        tempSelectedFilters = currentAgeRatingFilter.length === 0 ? [""] : [...currentAgeRatingFilter];
        renderFilterDropdownOptions(filterOptionsItemsContainerModal, tempSelectedFilters);
    }

    /**
     * Closes the filter modal.
     */
    function closeFilterModal() {
        filterModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // Filter button click handler (desktop)
    filterButton?.addEventListener('click', (event) => {
        event.stopPropagation();
        openFilterModal();
    });

    // Click handler for individual filter options within the modal
    filterOptionsItemsContainerModal.addEventListener('click', (event) => {
        event.stopPropagation();
        const target = event.target.closest('.filter-option-item');
        if (!target || target.dataset.rating === undefined) return;

        const ratingValue = target.dataset.rating;

        if (ratingValue === "") {
            tempSelectedFilters = [""];
        } else {
            const allRatingsIndex = tempSelectedFilters.indexOf("");
            if (allRatingsIndex > -1) {
                tempSelectedFilters.splice(allRatingsIndex, 1);
            }
            const index = tempSelectedFilters.indexOf(ratingValue);
            if (index > -1) {
                tempSelectedFilters.splice(index, 1);
            } else {
                tempSelectedFilters.push(ratingValue);
            }
            if (tempSelectedFilters.length === 0) {
                tempSelectedFilters = [""];
            }
        }
        renderFilterDropdownOptions(filterOptionsItemsContainerModal, tempSelectedFilters);
    });

    // Apply filters button click handler for the modal
    filterApplyBtnModal.addEventListener('click', (event) => {
        event.stopPropagation();
        if (tempSelectedFilters.includes("") || tempSelectedFilters.length === 0) {
            currentAgeRatingFilter = [];
        } else {
            currentAgeRatingFilter = [...tempSelectedFilters];
        }
        closeFilterModal();
        filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0);
        populateCurrentTabContent();
    });

    // Clear filters button click handler for the modal
    filterClearBtnModal.addEventListener('click', (event) => {
        event.stopPropagation();
        tempSelectedFilters = [""];
        renderFilterDropdownOptions(filterOptionsItemsContainerModal, tempSelectedFilters);
    });

    // Close filter modal when clicking its close button
    filterModalCloseButton.addEventListener('click', closeFilterModal);

    // Close filter modal if click outside content area
    filterModal.addEventListener('click', (event) => {
        if (event.target === filterModal) {
            closeFilterModal();
        }
    });

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
        if (exploreIsLoading || !exploreHasMore) return;

        exploreIsLoading = true;
        const loadingIndicator = document.getElementById('explore-loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            const items = await fetchDiscoveredItems('movie', currentAgeRatingFilter, exploreCurrentPage);
            cachedExploreItems = cachedExploreItems.concat(items);

            if (items.length > 0) {
                const itemsToDisplay = currentAgeRatingFilter.length > 0
                    ? items.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedExploreItems;
                appendItemsToGrid(exploreGridContainer, itemsToDisplay, isLightMode, onCardClick, isItemSeen);
                exploreCurrentPage++;
                if (items.length < 20) {
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

    // Event listener for infinite scroll on the window
    window.addEventListener('scroll', () => {
        const exploreTab = document.getElementById('explore-tab');
        if (!exploreTab || !exploreTab.classList.contains('active-tab')) return;

        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 300) {
            loadMoreExploreItems();
        }
    });

    // --- Profile Menu and Auth Modal Logic ---

    // Toggle profile dropdown visibility
    profileMenuButton.addEventListener('click', (event) => {
        event.stopPropagation();
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
        authModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setAuthModalMode(mode);
    }

    /**
     * Closes the authentication modal.
     */
    function closeAuthModal() {
        authModal.style.display = 'none';
        document.body.style.overflow = '';
        authForm.reset();
    }

    /**
     * Configures the authentication modal UI for either sign-in or sign-up.
     * @param {'signin'|'signup'} mode - The desired mode.
     */
    function setAuthModalMode(mode) {
        if (mode === 'signup') {
            authModalTitle.textContent = 'Sign Up';
            nameInputGroup.style.display = 'block';
            confirmPasswordGroup.style.display = 'block';
            authSubmitButton.textContent = 'Sign Up';
            authSwitchLink.textContent = "Already have an account? Sign In";
            nameInput.setAttribute('required', 'true');
            confirmPasswordInput.setAttribute('required', 'true');
        } else {
            authModalTitle.textContent = 'Sign In';
            nameInputGroup.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            authSubmitButton.textContent = 'Sign In';
            authSwitchLink.textContent = "Don't have an account? Sign Up";
            nameInput.removeAttribute('required');
            confirmPasswordInput.removeAttribute('required');
        }
    }

    // Event listeners for profile dropdown buttons and auth modal
    profileSignInBtn.addEventListener('click', () => openAuthModal('signin'));
    profileSignUpBtn.addEventListener('click', () => openAuthModal('signup'));
    profileSignOutBtn.addEventListener('click', async () => {
        try {
            showLoadingIndicator('Signing out...');
            await signOutUser(); // Call signOutUser from firebase_api.js
            profileDropdown.classList.remove('show');
            showCustomAlert('Success', 'You have been signed out.');
    } 
    catch (error) {
        console.error("Error signing out:", error);
        showCustomAlert('Error', `Sign out failed: ${error.message}`);
    } finally {
        hideLoadingIndicator();
    }
});

    authModalCloseButton.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (event) => {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });

    // Toggle between sign-in and sign-up forms
    authSwitchLink.addEventListener('click', () => {
        const currentMode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        setAuthModalMode(currentMode === 'signin' ? 'signup' : 'signin');
        authForm.reset();
    });

    // Handle authentication form submission (sign in or sign up)
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const mode = authModalTitle.textContent === 'Sign In' ? 'signin' : 'signup';
        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        let name = nameInput.value;
        const confirmPassword = confirmPasswordInput.value;

        showLoadingIndicator('Processing...');
        try {
            if (mode === 'signup') {
                if (!name.trim()) {
                    showCustomAlert('Error', 'Please enter your full name.');
                    return;
                }
                if (password !== confirmPassword) {
                    showCustomAlert('Error', 'Passwords do not match.');
                    return;
                }
                await signUp(name, email, password); // Call signUp from firebase_api.js
                showCustomAlert('Success', 'Account created successfully! You are now signed in.');
            } else { // signin
                await signIn(email, password); // Call signIn from firebase_api.js
                showCustomAlert('Success', 'Signed in successfully!');
            }
            closeAuthModal();
        } catch (error) {
            console.error("Authentication error:", error);
            let errorMessage = "An unknown error occurred.";
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
            showCustomAlert('Error', errorMessage);
        } finally {
            hideLoadingIndicator();
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

        if (!reRenderOnly && query.length < 3) {
            searchResultsContainer.innerHTML = `<p style="color: var(--text-secondary);">Please enter at least 3 characters to search.</p>`;
            cachedSearchResults = [];
            return;
        }

        if (reRenderOnly && cachedSearchResults.length > 0) {
            const filteredResults = currentAgeRatingFilter.length > 0
                ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedSearchResults;
            displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen);
            if (filteredResults.length === 0 && currentAgeRatingFilter.length > 0) {
                searchResultsContainer.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No items from your search matched the selected filter.</p>`;
            }
            return;
        } else if (!reRenderOnly) {
            searchResultsContainer.innerHTML = `<p class="loading-message">Searching for "${query}"...</p>`;
            try {
                showLoadingIndicator('Searching...');
                console.log(`Fetching search results for query: "${query}"`);
                const results = await fetchSearchResults(query, 'multi');
                cachedSearchResults = results;
                console.log("Search results fetched:", cachedSearchResults);

                const filteredResults = currentAgeRatingFilter.length > 0
                    ? cachedSearchResults.filter(item => checkRatingCompatibility(getCertification(item), currentAgeRatingFilter))
                    : cachedSearchResults;

                displaySearchResults('search-results-container', filteredResults, isLightMode, onCardClick, isItemSeen);
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

    // Debounce search input to avoid excessive API calls
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            performSearch(false);
        }, SEARCH_DEBOUNCE_DELAY);
    });

    // Trigger search immediately on button click
    searchButton.addEventListener('click', () => {
        clearTimeout(searchTimer);
        performSearch(false);
    });

    // --- Seen Items Logic ---
    let unsubscribeSeenItems = null;

    // Listen for authentication state changes to manage seen items listener
    onAuthChange((user) => {
        if (unsubscribeSeenItems) {
            unsubscribeSeenItems();
            unsubscribeSeenItems = null;
        }

        if (user) {
            // No need to pass db here; listenToUserCollection gets it internally
            unsubscribeSeenItems = listenToUserCollection('seenItems', (items) => {
                localUserSeenItemsCache = items;
                console.log("Real-time Seen Items update:", localUserSeenItemsCache);
                if (document.getElementById('seen-tab').classList.contains('active-tab')) {
                    populateCurrentTabContent();
                }
                const modal = document.getElementById('item-detail-modal');
                if (modal.style.display === 'flex') {
                    const currentItemData = modal.querySelector('#toggle-seen-btn')?.dataset;
                    if (currentItemData) {
                        updateSeenButtonStateInModal(parseInt(currentItemData.id), currentItemData.type, isItemSeen);
                    }
                }
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
            localUserSeenItemsCache = [];
        }
    });

    /**
     * Loads user's seen items from Firestore into local cache upon initial sign-in.
     */
    async function loadUserSeenItems() {
        const user = getCurrentUser();
        if (user && localUserSeenItemsCache.length === 0) {
             try {
                // No need to pass db here; getUserCollection gets it internally
                const items = await getUserCollection('seenItems');
                localUserSeenItemsCache = items;
                console.log("Initial load: User seen items from Firestore:", localUserSeenItemsCache);
            } catch (error) {
                console.error("Error initial loading seen items from Firestore:", error);
                localUserSeenItemsCache = [];
            }
        } else if (!user) {
            localUserSeenItemsCache = [];
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
            showCustomAlert('Info', "Please sign in to mark items as seen.");
            return;
        }

        const itemId = itemDetails.id;
        const isCurrentlySeen = isItemSeen(itemId, itemType);

        try {
            showLoadingIndicator('Updating seen status...');
            if (isCurrentlySeen) {
                await deleteUserData( 'seenItems', String(itemId)); // deleteUserData gets db internally
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as unseen.`);
            } else {
                const seenItemData = {
                    type: itemType,
                    title: itemDetails.title || itemDetails.name,
                    poster_path: itemDetails.poster_path,
                    backdrop_path: itemDetails.backdrop_path,
                    overview: itemDetails.overview,
                    release_date: itemDetails.release_date || itemDetails.first_air_date,
                    vote_average: itemDetails.vote_average,
                    addedAt: new Date().toISOString()
                };
                await saveUserData('seenItems', String(itemId), seenItemData); // saveUserData gets db internally
                showCustomAlert('Success', `"${itemDetails.title || itemDetails.name}" marked as seen.`);
            }
        } catch (error) {
            console.error("Error toggling seen status in Firestore:", error);
            showCustomAlert('Error', `Error updating seen status: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    // Expose toggleSeenStatus globally for ui.js to use in modal
    window.toggleSeenStatus = toggleSeenStatus;

    /**
     * Creates a new watchlist (folder) in Firestore.
     * @param {string} folderName - The name of the new folder.
     */
    async function handleCreateLibraryFolder(folderName) {
        const user = getCurrentUser();
        if (!user) {
            showCustomAlert("Info", "Please sign in to create watchlists.");
            return;
        }
        try {
            showLoadingIndicator(`Creating "${folderName}"...`);
            await saveUserData('watchlists', folderName, { name: folderName, items: [] }); // saveUserData gets db internally
            showCustomAlert("Success", `Watchlist "${folderName}" created successfully!`);
        } catch (error) {
            console.error("Error creating new folder:", error);
            showCustomAlert("Error", `Failed to create watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    // Expose globally for ui.js to call from modal
    window.handleCreateLibraryFolder = handleCreateLibraryFolder;


    /**
     * Deletes a watchlist (folder) from Firestore.
     * @param {string} folderId - The ID of the folder to delete.
     * @param {string} folderName - The name of the folder for confirmation/alert messages.
     */
    async function handleDeleteLibraryFolder(folderId, folderName) {
        const user = getCurrentUser();
        if (!user) {
            showCustomAlert("Info", "Please sign in to delete watchlists.");
            return;
        }
        const confirmDelete = true;
        if (!confirmDelete) return;

        try {
            showLoadingIndicator(`Deleting "${folderName}"...`);
            await deleteUserData('watchlists', folderId); // deleteUserData gets db internally
            showCustomAlert("Success", `Watchlist "${folderName}" deleted.`);
            if (currentSelectedLibraryFolder === folderId) {
                currentSelectedLibraryFolder = null;
            }
        } catch (error) {
            console.error("Error deleting folder:", error);
            showCustomAlert("Error", `Failed to delete watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }


    /**
     * Loads user's watchlists from Firestore into the local cache.
     * This function should be called after user authentication status is known.
     */
    async function loadUserFirestoreWatchlists() {
        const user = getCurrentUser();
        if (user) {
            try {
                // No need to pass db here; getUserCollection gets it internally
                const watchlists = await getUserCollection('watchlists');
                firestoreWatchlistsCache = watchlists.map(wl => ({
                    ...wl,
                    items: Array.isArray(wl.items) ? wl.items : []
                }));
                window.firestoreWatchlistsCache = firestoreWatchlistsCache; // Make cache globally available if ui.js relies on it
                console.log("Initial load: User watchlists from Firestore:", firestoreWatchlistsCache); 

                if (document.getElementById('library-tab').classList.contains('active-tab')) {
                    await renderLibraryFolderCards();
                    if (currentSelectedLibraryFolder) {
                        await renderMoviesInSelectedFolder(currentSelectedLibraryFolder);
                    }
                }
            } catch (error) {
                console.error("Error loading watchlists from Firestore:", error);
                firestoreWatchlistsCache = [];
                window.firestoreWatchlistsCache = []; // Ensure global cache is also cleared on error
            }
        } else {
            firestoreWatchlistsCache = [];
            window.firestoreWatchlistsCache = []; // Ensure global cache is also cleared if no user
        }
    }


    /**
     * Adds or removes an item from a specific watchlist folder in Firestore.
     * If the item already exists in the folder it will be removed, otherwise it
     * will be appended. The local cache and UI are updated after the change.
     * @param {string} folderId - The ID of the watchlist folder.
     * @param {object} item - The item details object.
     * @param {string} itemType - The media type ('movie' or 'tv').
     */
    async function handleAddRemoveItemToFolder(folderId, item, itemType) {
        const user = getCurrentUser();
        if (!user) {
            showCustomAlert('Info', 'Please sign in to manage watchlists.');
            return;
        }

        try {
            showLoadingIndicator('Updating watchlist...');

            // Fetch the latest watchlists and locate the target folder
            const watchlists = await getUserCollection('watchlists');
            const target = watchlists.find(wl => wl.id === folderId);
            if (!target) {
                showCustomAlert('Error', 'Watchlist not found.');
                return;
            }

            const normalizedItem = {
                tmdb_id: item.id || item.tmdb_id,
                item_type: itemType,
                title: item.title || item.name,
                poster_path: item.poster_path
            };

            const itemsArray = Array.isArray(target.items) ? [...target.items] : [];
            const existingIndex = itemsArray.findIndex(i => String(i.tmdb_id) === String(normalizedItem.tmdb_id) && i.item_type === normalizedItem.item_type);

            if (existingIndex > -1) {
                itemsArray.splice(existingIndex, 1);
            } else {
                itemsArray.push(normalizedItem);
            }

            await saveUserData('watchlists', folderId, { name: target.name, items: itemsArray });

            // Update local cache with the modified folder
            firestoreWatchlistsCache = watchlists.map(wl => wl.id === folderId ? { ...wl, items: itemsArray } : wl);
            window.firestoreWatchlistsCache = firestoreWatchlistsCache;

            // Re-render library section to reflect updates
            await renderLibraryFolderCards();
            if (currentSelectedLibraryFolder === folderId) {
                await renderMoviesInSelectedFolder(folderId);
            }
        } catch (error) {
            console.error('Error updating watchlist folder:', error);
            showCustomAlert('Error', `Failed to update watchlist: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    }

    // Expose globally for ui.js and other modules
    window.handleAddRemoveItemToFolder = handleAddRemoveItemToFolder;


    /**
     * Renders the library folder (watchlist) cards in the Library tab.
     */
    async function renderLibraryFolderCards() {
        if (!libraryFoldersRow) return;

        libraryFoldersRow.innerHTML = '';

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
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-right: 1rem;
            margin-bottom: 1rem;
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

        if (firestoreWatchlistsCache.length === 0) {
            return;
        }

        firestoreWatchlistsCache.forEach(folder => {
            const firstItemPoster = folder.items && folder.items.length > 0 && folder.items[0].poster_path
                ? (folder.items[0].poster_path.startsWith('http') ? folder.items[0].poster_path : `https://image.tmdb.org/t/p/w200${folder.items[0].poster_path}`)
                : "https://placehold.co/150x225/374151/9CA3AF?text=Folder";

            const card = document.createElement('div');
            card.className = 'content-card folder-card';
            card.style.position = 'relative';
            card.style.display = 'inline-block';
            card.style.marginRight = '1rem';
            card.style.marginBottom = '1rem';
            card.style.width = '10rem';
            card.dataset.folderId = folder.id;
            card.dataset.folderName = folder.name;

            card.innerHTML = `
                <img src="${firstItemPoster}" alt="Folder: ${folder.name}" style="width:100%; height:14rem; object-fit: cover; border-radius:0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <p style="text-align:center; margin-top:0.5rem; font-size:0.9em; font-weight:500; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name} (${folder.items.length})</p>
            `;

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑';
            deleteBtn.title = 'Delete Watchlist';
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
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await handleDeleteLibraryFolder(folder.id, folder.name);
            };
            card.appendChild(deleteBtn);

            card.addEventListener('click', (e) => {
                if (e.target === deleteBtn) return;
                currentSelectedLibraryFolder = folder.id;
                renderMoviesInSelectedFolder(folder.id);
                libraryFoldersRow.querySelectorAll('.folder-card').forEach(fc => {
                    fc.style.border = '2px solid transparent';
                    fc.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                });
                card.style.border = `2px solid var(--science-blue)`;
                card.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`;
            });

            libraryFoldersRow.appendChild(card);
        });

        if (currentSelectedLibraryFolder) {
            const selectedCard = libraryFoldersRow.querySelector(`.folder-card[data-folder-id="${currentSelectedLibraryFolder}"]`);
            if (selectedCard) {
                selectedCard.style.border = `2px solid var(--science-blue)`;
                card.style.boxShadow = `0 0 0 2px var(--science-blue), 0 4px 6px -1px rgba(0, 0, 0, 0.1)`;
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

        const selectedWatchlist = firestoreWatchlistsCache.find(wl => wl.id === folderId);
        if (!selectedWatchlist) {
            selectedFolderTitleElement.textContent = 'Items in Folder';
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">Watchlist not found or has been deleted.</p>`;
            currentSelectedLibraryFolder = null;
            return;
        }

        selectedFolderTitleElement.textContent = `Items in "${selectedWatchlist.name}"`;
        const items = selectedWatchlist.items;

        if (items.length === 0) {
            librarySelectedFolderMoviesRow.innerHTML = `<p style="color:var(--text-secondary); padding: 1rem;">This watchlist is empty.</p>`;
        } else {
            librarySelectedFolderMoviesRow.innerHTML = '';
            items.forEach(item => {
                const displayItem = {
                    id: item.tmdb_id,
                    media_type: item.item_type,
                    title: item.title,
                    poster_path: item.poster_path
                };
                const cardHtmlString = createContentCardHtml(displayItem, isLightMode, isItemSeen);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtmlString;
                const movieCardElement = tempDiv.firstElementChild;

                movieCardElement.addEventListener('click', () => onCardClick(item.tmdb_id, item.item_type));

                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '🗑';
                removeBtn.title = 'Remove from Watchlist';
                removeBtn.style.position = 'absolute';
                removeBtn.style.bottom = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.background = 'rgba(255, 0, 0, 0.6)';
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '24px';
                removeBtn.style.height = '24px';
                removeBtn.style.fontSize = '14px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.zIndex = '10';
                removeBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await handleAddRemoveItemToFolder(folderId, displayItem, item.item_type);
                };
                movieCardElement.querySelector('.image-container').appendChild(removeBtn);

                librarySelectedFolderMoviesRow.appendChild(movieCardElement);
            });
        }
    }
};