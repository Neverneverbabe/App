// SignIn/auth.js
// Import Firebase functions directly, as instances will be passed from main.js or retrieved via getters
import { firebaseAuthFunctions } from './firebase.js';
// Import API functions that now handle getting their own auth/db instances
import { signUp, signIn, signOutUser, onAuthChange, getCurrentUser } from './firebase_api.js';

// This private variable will hold the actual showCustomAlert function passed from main.js
let _showCustomAlert = console.log; // Default to console.log as a fallback if not explicitly initialized

// Global variable to hold the current authenticated user's ID
let currentUserId = null;
let firebaseAuthInstance = null; // Will be set by canvasSignIn

/**
 * Signs in with custom token or anonymously if not available.
 * This is called from main.js after Firebase services are initialized.
 * @param {object} authInstanceParam - The Firebase Auth instance passed from main.js.
 * @param {string|null} initialAuthToken - The custom auth token from Canvas, or null.
 */
export async function canvasSignIn(authInstanceParam, initialAuthToken) {
    if (!authInstanceParam) {
        console.error("Firebase Auth instance is not provided to canvasSignIn. Cannot perform sign-in.");
        return;
    }
    firebaseAuthInstance = authInstanceParam; // Store the instance for later use by other functions

    try {
        if (initialAuthToken && typeof initialAuthToken === 'string') {
            await firebaseAuthFunctions.signInWithCustomToken(firebaseAuthInstance, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await firebaseAuthFunctions.signInAnonymously(firebaseAuthInstance);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Canvas sign-in failed:", error);
        _showCustomAlert(`Authentication failed: ${error.message}`, "error");
    }
}

// DOM Elements (initialized in main.js and passed via initAuthRefs)
let authDropdownMenu;

/**
 * Initializes references to UI elements and the custom alert function.
 * This function is called by main.js to provide auth.js with necessary external dependencies.
 * @param {object} elements - Object containing references to auth-related DOM elements (e.g., authDropdownMenu).
 * @param {object} _itemDetailsRef - Not directly used in auth.js, but kept for signature compatibility.
 * @param {function} showCustomAlertFn - The actual showCustomAlert function from ui.js.
 */
export function initAuthRefs(elements, _itemDetailsRef, showCustomAlertFn) {
    authDropdownMenu = elements.authDropdownMenu;
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
            await signIn(email, password); // Call signIn from firebase_api.js (gets its own auth instance)
            _showCustomAlert("Signed in!", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
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
        const name = email; // Fallback name for quick sign-up from dropdown if no name input is available
        if (!email || !password) { _showCustomAlert("Email and password required.", "error"); return; }
        if (!isValidEmail(email)) { _showCustomAlert("Invalid email format.", "error"); return; }
        try {
            await signUp(name, email, password); // Call signUp from firebase_api.js (gets its own auth instance)
            _showCustomAlert("Signed up! You are now logged in.", "success");
            if (onSuccessCallback) onSuccessCallback();
        } catch (error) {
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
        userInfo.textContent = `Logged in as: ${user.email || 'Anonymous User'}`; // Display email or anonymous status
        authDropdownMenu.appendChild(userInfo);
        const signOutDropdownButton = document.createElement('button');
        signOutDropdownButton.id = 'signOutDropdownButton';
        signOutDropdownButton.className = 'auth-dropdown-button bg-red-600 hover:bg-red-700 w-full mt-2';
        signOutDropdownButton.textContent = 'Sign Out';
        signOutDropdownButton.addEventListener('click', async () => {
            try {
                const oldUserId = currentUserId; // Preserve oldUserId before sign out for local storage
                await signOutUser(); // Call signOutUser from firebase_api.js (gets its own auth instance)
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

/**
 * Handles authentication state changes, updating UI and setting current user ID.
 * @param {object|null} user - The Firebase User object, or null if signed out.
 */
export async function handleAuthStateChanged(user) {
    updateAuthDropdownUI(user);

    if (user) {
        currentUserId = user.uid;
        console.log("Auth state changed: User UID updated to:", currentUserId);
    } else {
        currentUserId = null; // Clear userId on sign out
    }
}

/**
 * Returns the current authenticated user's ID.
 * This function now gets the current user via `getCurrentUser()` from firebase_api.js.
 * @returns {string|null} The current user's UID or null if not signed in.
 */
export function getFirebaseUserId() {
    const user = getCurrentUser(); // Get current user from firebase_api.js
    return user ? user.uid : null;
}
