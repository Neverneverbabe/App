// App/main.js

// Import from Firebase initialization
import { initializeFirebaseServices, getFirebaseAuth, getFirebaseFirestore } from './SignIn/firebase.js';
// Import auth related functions
import { canvasSignIn, initAuthRefs, handleAuthStateChanged } from './SignIn/auth.js';
// Import API calls for item details (needed by onCardClick)
import { fetchItemDetails } from './api.js';

// Import new modules for content, search, seen items, and library management
import * as ContentManager from './modules/contentManager.js';
import * as SearchManager from './modules/search.js';
import * as SeenItemsManager from './modules/seenItems.js';
import * as LibraryManager from './modules/libraryManager.js';
import * as TrackManager from './modules/track.js';

// Import Netflix-style modal helpers
import { openNetflixModal } from './modules/netflixModal.js';
import { TMDB_BACKDROP_BASE_URL, TMDB_IMG_BASE_URL } from './config.js';
import { getCertification } from './ratingUtils.js';

// Import UI utility functions
import {
    updateThemeDependentElements,
    showCustomAlert,
    hideCustomAlert,
    showLoadingIndicator,
    hideLoadingIndicator,
} from './ui.js';

// Global state variables
let currentAgeRatingFilter = [];
let currentMediaTypeFilter = '';

// Supported age rating options for filtering (movies and TV)
const AGE_RATING_OPTIONS = [
    { value: "", label: "All Ratings" },
    { value: "G", label: "G" },
    { value: "PG", label: "PG" },
    { value: "PG-13", label: "PG-13" },
    { value: "R", label: "R" },
    { value: "NC-17", label: "NC-17" },
    { value: "TV-Y", label: "TV-Y" },
    { value: "TV-Y7", label: "TV-Y7" },
    { value: "TV-G", label: "TV-G" },
    { value: "TV-PG", label: "TV-PG" },
    { value: "TV-14", label: "TV-14" },
    { value: "TV-MA", label: "TV-MA" }
];
const MEDIA_TYPE_OPTIONS = [
    { value: "", label: "All Types" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "TV Shows" }
];
let isLightMode = false; // Initial theme state

// DOM Element References (will be initialized in window.onload)
let themeToggleBtn, filterButton, body, sidebarToggleButton, sidebarToggleIcon, currentTabNameDisplay,
    sidebarOverlay, mainNav, searchInput, searchButton, searchResultsContainer, themeToggleMobileBtn,
    filterButtonMobile, searchButtonMobile, profileButtonMobile, secondarySidebarButton,
    secondarySidebar, closeSecondarySidebarButton, libraryFoldersRow, selectedFolderTitleElement,
    librarySelectedFolderMoviesRow, profileMenuContainer, profileMenuButton, profileDropdown,
    profileStatus, profileSignInBtn, profileSignUpBtn, profileSignOutBtn, authModal,
    authModalCloseButton, authModalTitle, authForm, nameInputGroup, nameInput, authEmailInput,
    authPasswordInput, confirmPasswordGroup, confirmPasswordInput, authSubmitButton, authSwitchLink,
    filterModal, filterModalCloseButton, filterOptionsItemsContainerModal, filterMediaTypeContainerModal, filterApplyBtnModal,
    filterClearBtnModal;


// Shift the main initialization logic to window.onload
window.onload = async () => {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // Initialize DOM element references
    themeToggleBtn = document.getElementById('theme-toggle');
    filterButton = document.getElementById('filter-button');
    body = document.body;
    sidebarToggleButton = document.getElementById('sidebar-toggle-button');
    sidebarToggleIcon = sidebarToggleButton ? sidebarToggleButton.querySelector('i') : null;
    currentTabNameDisplay = document.getElementById('current-tab-name-display');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    mainNav = document.getElementById('main-nav');
    searchInput = document.getElementById('search-input');
    searchButton = document.getElementById('search-button');
    searchResultsContainer = document.getElementById('search-results-container');
    themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
    filterButtonMobile = document.getElementById('filter-button-mobile');
    searchButtonMobile = document.getElementById('search-button-mobile');
    profileButtonMobile = document.getElementById('profile-button-mobile');
    secondarySidebarButton = document.getElementById('secondary-sidebar-button');
    secondarySidebar = document.getElementById('secondary-sidebar');
    closeSecondarySidebarButton = secondarySidebar ? secondarySidebar.querySelector('.close-secondary-sidebar') : null;
    libraryFoldersRow = document.getElementById('library-folders-row');
    selectedFolderTitleElement = document.getElementById('selected-folder-title');
    librarySelectedFolderMoviesRow = document.getElementById('library-selected-folder-movies-row');
    profileMenuContainer = document.getElementById('profile-menu-container');
    profileMenuButton = document.getElementById('profile-menu-button');
    profileDropdown = document.getElementById('profile-dropdown');
    profileStatus = document.getElementById('profile-status');
    profileSignInBtn = document.getElementById('profile-signin-btn');
    profileSignUpBtn = document.getElementById('profile-signup-btn');
    profileSignOutBtn = document.getElementById('profile-signout-btn');
    authModal = document.getElementById('auth-modal');
    authModalCloseButton = authModal.querySelector('.close-button');
    authModalTitle = document.getElementById('auth-modal-title');
    authForm = document.getElementById('auth-form');
    nameInputGroup = document.getElementById('signup-name-group');
    nameInput = document.getElementById('name-input');
    authEmailInput = document.getElementById('auth-email-input');
    authPasswordInput = document.getElementById('auth-password-input');
    confirmPasswordGroup = document.getElementById('signup-confirm-password-group');
    confirmPasswordInput = document.getElementById('confirm-password-input');
    authSubmitButton = document.getElementById('auth-submit-button');
    authSwitchLink = document.getElementById('auth-switch-link');
    filterModal = document.getElementById('filter-modal');
    filterModalCloseButton = filterModal.querySelector('.close-button');
    filterOptionsItemsContainerModal = document.getElementById('filter-options-items-container-modal');
    filterMediaTypeContainerModal = document.getElementById('filter-media-type-container');
    filterApplyBtnModal = document.getElementById('filter-apply-btn-modal');
    filterClearBtnModal = document.getElementById('filter-clear-btn-modal');


    // --- Firebase Initialization and Auth Setup ---
    const pollForFirebaseGlobals = setInterval(async () => {
        if (typeof window.__firebase_config !== 'undefined' || typeof window.firebaseConfig !== 'undefined') {
            clearInterval(pollForFirebaseGlobals);
            await initializeAndAuthFirebase();
        }
    }, 100);

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

        if (!auth) {
            console.error("Firebase Auth failed to initialize. Check Firebase config.");
            showCustomAlert('Error', 'Firebase Auth service failed to initialize. Please check console for details.', 'error');
            return;
        }

        await canvasSignIn(auth, initialAuthToken);

        // Initialize auth.js with necessary UI elements and the showCustomAlert function from ui.js
        initAuthRefs({
            authDropdownMenu: profileDropdown,
        }, showCustomAlert);

        // Set up Firebase Auth state listener
        handleAuthStateChanged(auth.currentUser); // Initial call for current user
        auth.onAuthStateChanged(async (user) => {
            handleAuthStateChanged(user);
            if (user) {
                console.log("Auth state changed: User signed in - UID:", user.uid);
                // Initialize seen items and library listeners for the newly signed-in user
                SeenItemsManager.initializeSeenItemsListener(populateCurrentTabContent);
                LibraryManager.initializeLibraryListener(
                    (isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderLibraryFolderCards(isItemSeenFn, isLightMode, onCardClickCallback),
                    (folderId, isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderMoviesInSelectedFolder(folderId, isItemSeenFn, isLightMode, onCardClickCallback),
                    SeenItemsManager.isItemSeen,
                    isLightMode,
                    onCardClick // Pass onCardClick
                );
                TrackManager.initializeTrackListener(populateCurrentTabContent);
            } else {
                console.log("Auth state changed: User signed out");
                // Clear any local caches that depend on user being signed in
                SeenItemsManager.initializeSeenItemsListener(populateCurrentTabContent); // Re-initialize to clear cache
                LibraryManager.initializeLibraryListener(
                    (isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderLibraryFolderCards(isItemSeenFn, isLightMode, onCardClickCallback),
                    (folderId, isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderMoviesInSelectedFolder(folderId, isItemSeenFn, isLightMode, onCardClickCallback),
                    SeenItemsManager.isItemSeen,
                    isLightMode,
                    onCardClick // Pass onCardClick
                );
                TrackManager.initializeTrackListener(populateCurrentTabContent);
            }
            populateCurrentTabContent();
        });

        // Initialize seen items and library managers with their listeners immediately if user is already authenticated (e.g., page refresh)
        // This ensures data is loaded even if the initial auth state is already signed in.
        SeenItemsManager.initializeSeenItemsListener(populateCurrentTabContent);
        LibraryManager.initializeLibraryListener(
            (isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderLibraryFolderCards(isItemSeenFn, isLightMode, onCardClickCallback),
            (folderId, isItemSeenFn, isLightMode, onCardClickCallback) => LibraryManager.renderMoviesInSelectedFolder(folderId, isItemSeenFn, isLightMode, onCardClickCallback),
            SeenItemsManager.isItemSeen,
            isLightMode,
            onCardClick
        );
        TrackManager.initializeTrackListener(populateCurrentTabContent);

        // Pre-load content caches for faster display
        await ContentManager.initializeContentCaches();

        // Initial content population based on current tab
        populateCurrentTabContent();
    }


    // Set the current year in the footer dynamically
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Initial theme setup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        isLightMode = true;
    }
    updateThemeDependentElements(isLightMode);

    // --- Core Functions ---

    /**
     * Handles the click event on a content card, fetching and displaying item details in a modal.
     * This function is passed to content rendering functions in ui.js.
     * @param {number} id - The ID of the movie or TV show.
     * @param {'movie'|'tv'} type - The media type ('movie' or 'tv').
     */
    const onCardClick = async (id, type) => {
        try {
            showLoadingIndicator('Fetching item details...');
            const details = await fetchItemDetails(id, type);

            const imageSrc = details.backdrop_path
                ? `${TMDB_BACKDROP_BASE_URL}${details.backdrop_path}`
                : (details.poster_path ? `${TMDB_IMG_BASE_URL}${details.poster_path}` : '');
            const tags = [];
            const year = (details.release_date || details.first_air_date || '').slice(0, 4);
            if (year) tags.push(year);
            const certification = getCertification(details);
            if (certification && certification !== 'N/A') tags.push(certification);
            tags.push(type === 'movie' ? 'Movie' : 'TV');
            if (details.genres && details.genres.length > 0) {
                tags.push(...details.genres.slice(0, 2).map(g => g.name));
            }

            openNetflixModal({
                imageSrc,
                title: details.title || details.name || '',
                tags,
                description: details.overview || ''
            });
        } catch (error) {
            console.error("Error fetching item details for modal:", error);
            showCustomAlert('Error', `Could not load item details. Error: ${error.message}`);
        } finally {
            hideLoadingIndicator();
        }
    };

    // Setup delegated click listener for seen toggle icons (moved here from SeenItemsManager)
    // This listener also handles general content card clicks.
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
                await SeenItemsManager.toggleSeenStatus(details, itemType);
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
                if (!isNaN(id) && type) onCardClick(id, type);
            }
        }
    });


    /**
     * Switches the active tab in the main content area.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'watch-now-tab').
     */
    function switchToTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active-tab');
            const label = document.querySelector(`.tab-link[data-tab="${tabId}"]`)?.textContent || '';
            if (currentTabNameDisplay) currentTabNameDisplay.textContent = label;
        } else {
            console.error(`Could not find tab content element with ID: ${tabId}`);
            return;
        }

        mainNav.querySelectorAll('a.tab-link').forEach(link => link.classList.remove('active-nav-link'));
        const activeNavLink = document.querySelector(`#main-nav a[data-tab="${tabId}"]`);
        if (activeNavLink) {
            activeNavLink.classList.add('active-nav-link');
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

        // Reset explore state if switching away from it to ensure fresh load next time
        if (tabId !== 'explore-tab') {
            ContentManager.resetExploreState();
        }

        populateCurrentTabContent();

        mainNav?.classList.remove('sidebar-open');
        secondarySidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = '';
        updateSidebarButtonState(mainNav?.classList.contains('sidebar-open'));
    }

    /**
     * Populates the content of the currently active tab.
     */
    async function populateCurrentTabContent() {
        console.log("populateCurrentTabContent called for active tab.");
        const activeTabElement = document.querySelector('.tab-content.active-tab');
        if (!activeTabElement) {
            console.error("No active tab element found in populateCurrentTabContent. Page might appear blank.");
            return;
        }

        const activeTabId = activeTabElement.id;

        try {
            switch (activeTabId) {
                case 'watch-now-tab':
                    await ContentManager.populateWatchNowTab(currentMediaTypeFilter, currentAgeRatingFilter, isLightMode, onCardClick, SeenItemsManager.isItemSeen);
                    break;
                case 'explore-tab':
                    await ContentManager.populateExploreTab(currentMediaTypeFilter, currentAgeRatingFilter, isLightMode, onCardClick, SeenItemsManager.isItemSeen);
                    break;
                case 'library-tab':
                    await LibraryManager.populateLibraryTab(SeenItemsManager.isItemSeen, isLightMode, onCardClick);
                    break;
                case 'seen-tab':
                    SeenItemsManager.populateSeenTab(currentAgeRatingFilter, isLightMode, onCardClick);
                    break;
                case 'track-tab':
                    TrackManager.populateTrackTab(isLightMode, onCardClick);
                    break;
                case 'search-tab':
                    SearchManager.populateSearchTab(currentMediaTypeFilter, currentAgeRatingFilter, isLightMode, onCardClick, SeenItemsManager.isItemSeen);
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
        const auth = getFirebaseAuth(); // Get auth instance from Firebase module
        if (auth && auth.currentUser) {
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
    let tempSelectedMediaType = '';

    /**
     * Renders filter options in the dropdown/modal, marking currently selected ones.
     * @param {HTMLElement} container - The container element for filter items.
     * @param {string[]} selectedFilters - Array of currently selected filter values.
     */
    function renderFilterDropdownOptions(container, selectedFilters) {
        container.innerHTML = AGE_RATING_OPTIONS.map(opt =>
            `<div class="dropdown-item filter-option-item" data-rating="${opt.value}">${opt.label} <span class="checkmark">✔</span></div>`
        ).join('');

        container.querySelectorAll('.filter-option-item').forEach(item => {
            const ratingValue = item.dataset.rating;
            if (selectedFilters.includes(ratingValue) || (selectedFilters.length === 0 && ratingValue === "")) {
                item.classList.add('item-selected');
            } else {
                item.classList.remove('item-selected');
            }
        });
    }

    function renderMediaTypeOptions(container, selectedType) {
        container.innerHTML = MEDIA_TYPE_OPTIONS.map(opt =>
            `<div class="dropdown-item media-type-option" data-type="${opt.value}">${opt.label} <span class="checkmark">✔</span></div>`
        ).join('');

        container.querySelectorAll('.media-type-option').forEach(item => {
            const value = item.dataset.type;
            if (value === selectedType) {
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
        tempSelectedMediaType = currentMediaTypeFilter;
        renderFilterDropdownOptions(filterOptionsItemsContainerModal, tempSelectedFilters);
        renderMediaTypeOptions(filterMediaTypeContainerModal, tempSelectedMediaType);
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

    filterMediaTypeContainerModal.addEventListener('click', (event) => {
        event.stopPropagation();
        const target = event.target.closest('.media-type-option');
        if (!target || target.dataset.type === undefined) return;

        tempSelectedMediaType = target.dataset.type;
        renderMediaTypeOptions(filterMediaTypeContainerModal, tempSelectedMediaType);
    });

    // Apply filters button click handler for the modal
    filterApplyBtnModal.addEventListener('click', (event) => {
        event.stopPropagation();
        if (tempSelectedFilters.includes("") || tempSelectedFilters.length === 0) {
            currentAgeRatingFilter = [];
        } else {
            currentAgeRatingFilter = [...tempSelectedFilters];
        }
        currentMediaTypeFilter = tempSelectedMediaType;
        closeFilterModal();
        filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0 || currentMediaTypeFilter !== '');
        // Reset explore tab state to reload content with new filters
        ContentManager.resetExploreState();
        populateCurrentTabContent();
    });

    // Clear filters button click handler for the modal
    filterClearBtnModal.addEventListener('click', (event) => {
        event.stopPropagation();
        tempSelectedFilters = [""];
        tempSelectedMediaType = '';
        renderFilterDropdownOptions(filterOptionsItemsContainerModal, tempSelectedFilters);
        renderMediaTypeOptions(filterMediaTypeContainerModal, tempSelectedMediaType);
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
        filterButton.classList.toggle('filter-active', currentAgeRatingFilter.length > 0 || currentMediaTypeFilter !== '');
    }

    // --- Explore Tab Infinite Scroll ---
    window.addEventListener('scroll', () => {
        const exploreTab = document.getElementById('explore-tab');
        if (!exploreTab || !exploreTab.classList.contains('active-tab')) return;

        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 300) {
            ContentManager.loadMoreExploreItems(currentMediaTypeFilter, currentAgeRatingFilter, isLightMode, onCardClick, SeenItemsManager.isItemSeen);
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
            await import('./SignIn/firebase_api.js').then(module => module.signOutUser()); // Dynamic import
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
            const firebaseApi = await import('./SignIn/firebase_api.js'); // Dynamic import
            if (mode === 'signup') {
                if (!name.trim()) {
                    showCustomAlert('Error', 'Please enter your full name.');
                    return;
                }
                if (password !== confirmPassword) {
                    showCustomAlert('Error', 'Passwords do not match.');
                    return;
                }
                await firebaseApi.signUp(name, email, password);
                showCustomAlert('Success', 'Account created successfully! You are now signed in.');
            } else { // signin
                await firebaseApi.signIn(email, password);
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

    // --- Search Functionality Setup ---
    SearchManager.setupSearchListeners(searchInput, currentMediaTypeFilter, currentAgeRatingFilter, isLightMode, onCardClick, SeenItemsManager.isItemSeen);
};
