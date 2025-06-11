// SignIn/firebase.js
// Updated Firebase SDK imports to use CDN paths for browser compatibility
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import * as FirebaseAuthFunctions from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import * as FirebaseFirestoreFunctions from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

let appInstance = null;
let authInstance = null;
let dbInstance = null;

/**
 * Initializes Firebase app, Auth, and Firestore services.
 * This function should be called once, typically from main.js's DOMContentLoaded.
 * @param {object} config - The Firebase configuration object.
 * @returns {void}
 */
export function initializeFirebaseServices(config) {
    if (!config) {
        console.error("Firebase configuration is missing. Cannot initialize Firebase.");
        return;
    }

    if (!getApps().length) {
        appInstance = initializeApp(config);
    } else {
        appInstance = getApp();
    }

    authInstance = FirebaseAuthFunctions.getAuth(appInstance);
    dbInstance = FirebaseFirestoreFunctions.getFirestore(appInstance);

    console.log("Firebase services initialized.");
}

// Export getters for the initialized instances
export function getFirebaseAuth() {
    return authInstance;
}

export function getFirebaseFirestore() {
    return dbInstance;
}

// Re-export specific Firebase functions for convenience
export const firebaseAuthFunctions = FirebaseAuthFunctions;
export const firebaseFirestoreFunctions = FirebaseFirestoreFunctions;

// This function is no longer strictly needed but kept as a no-op if other parts of the code expect it.
export async function loadFirebaseIfNeeded() {
    return appInstance !== null;
}
