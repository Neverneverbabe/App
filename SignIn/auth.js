// SignIn/auth.js
import { auth } from './firebase.js'; // Firebase auth instance
// Corrected imports: Use the functions actually exported by firebase_api.js
import { signUp, signIn, signOutUser, onAuthChange, getCurrentUser } from './firebase_api.js';

// This private variable will hold the actual showCustomAlert function passed from main.js
let _showCustomAlert = console.log; // Default to console.log as a fallback if not explicitly initialized

// Placeholder functions for dependencies that were removed or not part of this project's scope.
// These are included just to ensure any existing calls in the original logic don't throw errors.
// In a clean architecture, auth.js would ideally only return authentication results,
// and other modules (like main.js) would handle UI updates based on those results.
let currentUserId = null;
function updateCurrentUserId(id) { currentUserId = id; console.log("Placeholder: Current User ID updated to:", currentUserId); }
function updateCurrentSelectedWatchlistName(name) { console.log("Placeholder: Selected Watchlist Name updated to:", name); }
async function loadAndDisplayWatchlistsFromFirestore() { console.log("Placeholder: Loading and displaying watchlists from Firestore..."); }
function updateAddToWatchlistButtonState(id, details, containerId) { console.log("Placeholder: Updating add to watchlist button state for:", id); }
function determineActiveWatchlistButtonContainerId() { console.log("Placeholder: Determining active watchlist button container ID."); return "default-watchlist-container"; }
async function loadAndDisplaySeenItems() { console.log("Placeholder: Loading and displaying seen items..."); }
function updateMarkAsSeenButtonState(id, details, containerId) { console.log("Placeholder: Updating mark as seen button state for:", id); }
function determineActiveSeenButtonContainerId() { console.log("Placeholder: Determining active seen button container ID."); return "default-seen-container"; }


// DOM Elements (initialized in main.js and passed or imported from each app/website's context)
// These variables are now declared without direct assignment here, as they are passed via initAuthRefs.
let authDropdownMenu, newWatchlistNameInput, createWatchlistBtn;
let currentSelectedItemDetails;

/**
 * Initializes references to UI elements and the custom alert function.
 * This function is called by main.js to provide auth.js with necessary external dependencies.
 * @param {object} elements - Object containing references to auth-related DOM elements (e.g., authDropdownMenu).
 * @param {object} itemDetailsRef - Reference to the currentSelectedItemDetails from main.js's state.
 * @param {function} showCustomAlertFn - The actual showCustomAlert function from ui.js.
 */
export function initAuthRefs(elements, itemDetailsRef, showCustomAlertFn) {
    authDropdownMenu = elements.authDropdownMenu;
    newWatchlistNameInput = elements.newWatchlistNameInput;
    createWatchlistBtn = elements.createWatchlistBtn;
    currentSelectedItemDetails = itemDetailsRef;
    _showCustomAlert = showCustomAlertFn || console.log; // Assign the actual alert function
}

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function createAuthFormUI(parentElement, onSuccessCallback) {
    if (!parentElement) return;
    parentElement.innerHTML = '';

    const instructionText = document.createElement('p');
    instructionText.className = 'text-sm text-gray-300 mb-3';
    instructionText.textContent = 'Sign in or sign up to manage watchlists:';
    parentElement.appendChild(instructionText);

    const emailField = document.createElement('input');
    emailField.type = 'email';
    emailField.placeholder = 'Email';
    emailField.className = 'auth-dropdown-input w-full mb-2';
    parentElement.appendChild(emailField);

    const passwordField = document.createElement('input');
    passwordField.type = 'password';
    passwordField.placeholder = 'Password';
    passwordField.className = 'auth-dropdown-input w-full mb-3';
    parentElement.appendChild(passwordField);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between gap-2';

    const signInButton = document.createElement('button');
    signInButton.textContent = 'Sign In';
    signInButton.className = 'auth-dropdown-button flex-grow';
    signInButton.onclick = async () => {
        const email = emailField.value;
        const password = passwordField.value;
        if (!email || !password) { _showCustomAlert("Email and password required.", "error"); return; }
        if (!isValidEmail(email)) { _showCustomAlert("Invalid email format.", "error"); return; }
        try {
            await signIn(email, password); // Use the exported 'signIn' function
            _showCustomAlert("Signed in!", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
            // Use the passed _showCustomAlert function for all messages
            _showCustomAlert(`Sign in error: ${error.message}`, "error");
        }
    };
    buttonContainer.appendChild(signInButton);

    const signUpButton = document.createElement('button');
    signUpButton.textContent = 'Sign Up';
    signUpButton.className = 'auth-dropdown-button flex-grow';
    signUpButton.onclick = async () => {
        const email = emailField.value;
        const password = passwordField.value;
        // The name input is managed by main.js and passed from there for signUp.
        // For the auth.js dropdown UI, we assume a simple sign-up without name.
        // If a name is needed for the dropdown, it would need to be added to the UI here.
        const name = email; // Fallback name for quick sign-up from dropdown if no name input is available
        if (!email || !password) { _showCustomAlert("Email and password required.", "error"); return; }
        if (!isValidEmail(email)) { _showCustomAlert("Invalid email format.", "error"); return; }
        try {
            await signUp(name, email, password); // Use the exported 'signUp' function
            _showCustomAlert("Signed up! You are now logged in.", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
            // Use the passed _showCustomAlert function for all messages
            _showCustomAlert(`Sign up error: ${error.message}`, "error");
        }
    };
    buttonContainer.appendChild(signUpButton);
    parentElement.appendChild(buttonContainer);
}

export function updateAuthDropdownUI(user) {
    if (!authDropdownMenu) return;
    authDropdownMenu.innerHTML = '';

    if (user) {
        const userInfo = document.createElement('div');
        userInfo.className = 'auth-dropdown-status';
        userInfo.textContent = `Logged in as: ${user.email}`;
        authDropdownMenu.appendChild(userInfo);
        const signOutDropdownButton = document.createElement('button');
        signOutDropdownButton.id = 'signOutDropdownButton';
        signOutDropdownButton.className = 'auth-dropdown-button bg-red-600 hover:bg-red-700 w-full mt-2';
        signOutDropdownButton.textContent = 'Sign Out';
        signOutDropdownButton.addEventListener('click', async () => {
            try {
                const oldUserId = currentUserId;
                await signOutUser(); // Use the exported 'signOutUser' function
                localStorage.removeItem(`mediaFinderLastSelectedWatchlist_${oldUserId}`);
                _showCustomAlert("Signed out successfully.", "info"); // Use _showCustomAlert
                if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
            } catch (error) {
                _showCustomAlert(`Sign out error: ${error.message}`, "error"); // Use _showCustomAlert
            }
        });
        authDropdownMenu.appendChild(signOutDropdownButton);
    } else {
        createAuthFormUI(authDropdownMenu, () => {
            if (authDropdownMenu) authDropdownMenu.classList.add('hidden');
        });
    }
}

// Removed 'elements' parameter as it's passed during initialization via initAuthRefs
export async function handleAuthStateChanged(user) {
    updateAuthDropdownUI(user);
    if (user) {
        updateCurrentUserId(user.uid);
        // The following elements are now managed directly by main.js in the library tab,
        // so direct manipulation or reliance on their existence in auth.js is removed.
        // if (newWatchlistNameInput) newWatchlistNameInput.disabled = false;
        // if (createWatchlistBtn) createWatchlistBtn.disabled = false;

        // These loading/display calls are handled by main.js's populateCurrentTabContent
        // in response to auth state changes and tab switches.
        // await loadAndDisplaySeenItems();
        // await loadAndDisplayWatchlistsFromFirestore();

        if (currentSelectedItemDetails) {
            // These functions are placeholders, assuming their real implementation is in main.js's scope
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
            const activeSeenBtnContainerId = determineActiveSeenButtonContainerId();
            updateMarkAsSeenButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeSeenBtnContainerId);
        }
    } else {
        updateCurrentUserId(null);
        updateCurrentSelectedWatchlistName(null);

        // Content clearing for these containers is handled by main.js in populateCurrentTabContent.
        // if (watchlistTilesContainer) watchlistTilesContainer.innerHTML = '<p class="text-xs text-gray-400 col-span-full w-full text-center">Sign in to see your watchlists.</p>';
        // if (watchlistDisplayContainer) watchlistDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to manage your watchlists.</p>';
        // if (seenItemsDisplayContainer) seenItemsDisplayContainer.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Sign in to see your seen items.</p>';

        // if (newWatchlistNameInput) newWatchlistNameInput.disabled = true;
        // if (createWatchlistBtn) createWatchlistBtn.disabled = true;

        if (currentSelectedItemDetails) {
            // These functions are placeholders, assuming their real implementation is in main.js's scope
            const activeBtnContainerId = determineActiveWatchlistButtonContainerId();
            updateAddToWatchlistButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeBtnContainerId);
            const activeSeenBtnContainerId = determineActiveSeenButtonContainerId();
            updateMarkAsSeenButtonState(currentSelectedItemDetails.tmdb_id, currentSelectedItemDetails, activeSeenBtnContainerId);
        }
    }
}
