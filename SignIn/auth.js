// SignIn/auth.js
// Import Firebase functions directly, as instances will be passed from main.js or retrieved via getters
import { firebaseAuthFunctions } from './firebase.js';
// Import API functions that now handle getting their own auth/db instances
import { signUp, signIn, signOutUser, onAuthChange, getCurrentUser } from './firebase_api.js';

// This private variable will hold the actual showCustomAlert function passed from main.js
let _showCustomAlert = console.log; // Default to console.log as a fallback if not explicitly initialized

// Global variable to hold the current authenticated user's ID
let currentUserId = null;
// let firebaseAuthInstance = null; // No longer needed globally here

/**
 * Signs in with a custom token if available. If no token is provided,
 * the user remains unauthenticated.
 * This is called from main.js after Firebase services are initialized.
 * @param {object} authInstanceParam - The Firebase Auth instance passed from main.js.
 * @param {string|null} initialAuthToken - The custom auth token from Canvas, or null.
 */
export async function canvasSignIn(authInstanceParam, initialAuthToken) {
    if (!authInstanceParam) {
        console.error("Firebase Auth instance is not provided to canvasSignIn. Cannot perform sign-in.");
        return;
    }
    // firebaseAuthInstance = authInstanceParam; // Not needed if only used here

    try {
        if (initialAuthToken && typeof initialAuthToken === 'string') {
            await firebaseAuthFunctions.signInWithCustomToken(authInstanceParam, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            console.log("No custom auth token provided; skipping automatic sign-in.");
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
 * @param {function} showCustomAlertFn - The actual showCustomAlert function from ui.js.
 */
export function initAuthRefs(elements, showCustomAlertFn) {
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

    const form = document.createElement('form');
    form.addEventListener('submit', (e) => e.preventDefault()); // Prevent default form submission

    const instructionText = document.createElement('p');
    instructionText.className = 'text-sm text-gray-300 mb-3';
    instructionText.textContent = 'Sign in or sign up to manage watchlists:';
    form.appendChild(instructionText);

    const emailField = document.createElement('input');
    emailField.type = 'email';
    emailField.placeholder = 'Email';
    emailField.className = 'auth-dropdown-input w-full mb-2';
    emailField.name = 'email'; // Good practice for forms
    emailField.autocomplete = 'email';
    form.appendChild(emailField);

    const passwordField = document.createElement('input');
    passwordField.type = 'password';
    passwordField.placeholder = 'Password';
    passwordField.className = 'auth-dropdown-input w-full mb-3';
    passwordField.name = 'password'; // Good practice for forms
    passwordField.autocomplete = 'current-password';
    form.appendChild(passwordField);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-between gap-2';

    const signInButton = document.createElement('button');
    signInButton.textContent = 'Sign In';
    signInButton.className = 'auth-dropdown-button flex-grow';
    signInButton.type = 'button'; // To prevent form submission if it was the first button
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
    signUpButton.type = 'button'; // To prevent form submission
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
    form.appendChild(buttonContainer);
    parentElement.appendChild(form);
}

export function updateAuthDropdownUI(user) {
    if (!authDropdownMenu) return;

    const statusEl = authDropdownMenu.querySelector('#profile-status');
    const signInBtn = authDropdownMenu.querySelector('#profile-signin-btn');
    const signUpBtn = authDropdownMenu.querySelector('#profile-signup-btn');
    const signOutBtn = authDropdownMenu.querySelector('#profile-signout-btn');

    if (user) {
        if (statusEl) statusEl.textContent = `Signed in as: ${user.email || 'Anonymous User'}`;
        if (signInBtn) signInBtn.style.display = 'none';
        if (signUpBtn) signUpBtn.style.display = 'none';
        if (signOutBtn) signOutBtn.style.display = 'block';
    } else {
        if (statusEl) statusEl.textContent = 'Not Signed In';
        if (signInBtn) signInBtn.style.display = 'block';
        if (signUpBtn) signUpBtn.style.display = 'block';
        if (signOutBtn) signOutBtn.style.display = 'none';
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
