// SignIn/firebase_api.js
// Import initialized auth and db instances, and all Firebase functions from firebase.js
import { getFirebaseAuth, getFirebaseFirestore, firebaseAuthFunctions, firebaseFirestoreFunctions } from './firebase.js';
import { showCustomAlert } from '../ui.js';

// Define appId globally using the __app_id provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * Helper to get the authenticated user.
 * This is crucial because auth.currentUser can be null if Firebase is not yet ready
 * or if no user is signed in.
 * @returns {object|null} The current Firebase User object, or null.
 */
function getCurrentAuthenticatedUser() {
    const auth = getFirebaseAuth();
    return auth ? auth.currentUser : null;
}

/**
 * Helper to get the Firestore DB instance.
 * @returns {object|null} The Firestore DB instance, or null.
 */
function getFirestoreInstance() {
    return getFirebaseFirestore();
}

/**
 * Helper to get the Auth instance.
 * @returns {object|null} The Auth instance, or null.
 */
function getAuthInstance() {
    return getFirebaseAuth();
}


// --- Firebase Authentication Functions ---

/**
 * Creates a new user with the given email and password.
 * @param {string} name - The user's display name.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A UserCredential object.
 */
export async function signUp(name, email, password) {
    const auth = getAuthInstance();
    if (!auth) {
        showCustomAlert('Error', 'Authentication service is not initialized. Please reload the page.', 'error');
        return null;
    }
    try {
        const userCredential = await firebaseAuthFunctions.createUserWithEmailAndPassword(auth, email, password);
        // After creating the user, update their profile with the display name
        await firebaseAuthFunctions.updateProfile(userCredential.user, { displayName: name });
        return userCredential;
    } catch (error) {
        console.error("Firebase Sign Up Error:", error);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Signs in an existing user with the given email and password.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A UserCredential object.
 */
export async function signIn(email, password) {
    const auth = getAuthInstance();
    if (!auth) {
        showCustomAlert('Error', 'Authentication service is not initialized. Please reload the page.', 'error');
        return null;
    }
    try {
        const userCredential = await firebaseAuthFunctions.signInWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        console.error("Firebase Sign In Error:", error);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Signs out the current user.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
    const auth = getAuthInstance();
    if (!auth) {
        showCustomAlert('Error', 'Authentication service is not initialized. Please reload the page.', 'error');
        return;
    }
    try {
        await firebaseAuthFunctions.signOut(auth);
    } catch (error) {
        console.error("Firebase Sign Out Error:", error);
        throw error;
    }
}

/**
 * Attaches an observer to the authentication state.
 * @param {function} callback - The function to call when the auth state changes.
 * @returns {function} An unsubscribe function.
 */
export function onAuthChange(callback) {
    const auth = getAuthInstance();
    if (!auth) {
        console.warn("Firebase Auth is not initialized. Cannot set up auth state listener.");
        return () => {}; // Return a no-op unsubscribe function
    }
    return firebaseAuthFunctions.onAuthStateChanged(auth, callback);
}

/**
 * Gets the currently authenticated user.
 * @returns {object|null} The current Firebase User object, or null if no user is signed in.
 */
export function getCurrentUser() {
    return getCurrentAuthenticatedUser();
}

// --- Firebase Firestore Functions ---

/**
 * Helper to get the base user document reference for a given collection.
 * This is crucial for adhering to the Canvas environment's Firestore security rules.
 * @param {string} collectionName - The name of the sub-collection (e.g., 'seenItems', 'watchlists').
 * @param {string} userId - The UID of the authenticated user.
 * @returns {object} A DocumentReference to the user's specific collection path.
 */
function getUserCollectionRef(collectionName, userId) {
    const db = getFirestoreInstance();
    if (!db) throw new Error("Firestore is not initialized.");
    // Path: /artifacts/{appId}/users/{userId}/{collectionName}
    return firebaseFirestoreFunctions.collection(db, "artifacts", appId, "users", userId, collectionName);
}

/**
 * Saves data to a specific document within a user's collection.
 * Creates the document if it doesn't exist, merges data if it does.
 * @param {string} collectionName - The name of the sub-collection (e.g., 'seenItems', 'watchlists').
 * @param {string} docId - The ID of the document to save.
 * @param {object} data - The data to save.
 * @returns {Promise<void>}
 */
export async function saveUserData(collectionName, docId, data) {
    const user = getCurrentAuthenticatedUser();
    if (!user) {
        console.warn("Attempted to save data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    const docRef = firebaseFirestoreFunctions.doc(getUserCollectionRef(collectionName, user.uid), docId);
    // Use setDoc with { merge: true } to create or update fields non-destructively
    return await firebaseFirestoreFunctions.setDoc(docRef, data, { merge: true });
}

/**
 * Retrieves a single document from a user's collection.
 * @param {string} collectionName - The name of the sub-collection.
 * @param {string} docId - The ID of the document to retrieve.
 * @returns {Promise<object|null>} The document data with its ID, or null if not found.
 */
export async function getUserDataItem(collectionName, docId) {
    const user = getCurrentAuthenticatedUser();
    if (!user) return null;
    const docRef = firebaseFirestoreFunctions.doc(getUserCollectionRef(collectionName, user.uid), docId);
    const docSnap = await firebaseFirestoreFunctions.getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/**
 * Retrieves all documents from a user's specific collection.
 * @param {string} collectionName - The name of the sub-collection.
 * @returns {Promise<Array<object>>} An array of document data, each including its ID.
 */
export async function getUserCollection(collectionName) {
    const user = getCurrentAuthenticatedUser();
    if (!user) return [];
    const collectionRef = getUserCollectionRef(collectionName, user.uid);
    const querySnapshot = await firebaseFirestoreFunctions.getDocs(collectionRef);
    // Map documents to include their ID along with data
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Sets up a real-time listener for a user's collection.
 * @param {string} collectionName - The name of the sub-collection.
 * @param {function(Array<object>): void} callback - The function to call with the updated collection data.
 * @returns {function(): void} An unsubscribe function to stop listening.
 */
export function listenToUserCollection(collectionName, callback) {
    const user = getCurrentAuthenticatedUser();
    if (!user) {
        console.warn("Attempted to listen to collection without a signed-in user.");
        // Return a no-op unsubscribe function if no user is signed in
        return () => {};
    }
    const collectionRef = getUserCollectionRef(collectionName, user.uid);
    // onSnapshot provides real-time updates
    return firebaseFirestoreFunctions.onSnapshot(collectionRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(items);
    }, (error) => {
        console.error("Error listening to user collection:", collectionName, error);
    });
}

/**
 * Deletes a specific document from a user's collection.
 * @param {string} collectionName - The name of the sub-collection.
 * @param {string} docId - The ID of the document to delete.
 * @returns {Promise<void>}
 */
export async function deleteUserData(collectionName, docId) {
    const user = getCurrentAuthenticatedUser();
    if (!user) {
        console.warn("Attempted to delete data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    const docRef = firebaseFirestoreFunctions.doc(getUserCollectionRef(collectionName, user.uid), docId);
    return await firebaseFirestoreFunctions.deleteDoc(docRef);
}

// NOTE: This array update function is not currently used in main.js but is kept for potential future use.
/**
 * Updates an array field within a document by adding or removing a value.
 * @param {string} collectionName - The name of the sub-collection.
 * @param {string} docId - The ID of the document to update.
 * @param {string} field - The name of the array field to modify.
 * @param {any} value - The value to add or remove from the array.
 * @param {'add'|'remove'} operation - The array operation ('add' or 'remove').
 * @returns {Promise<void>}
 */
export async function updateUserDataArray(collectionName, docId, field, value, operation) {
    const user = getCurrentAuthenticatedUser();
    if (!user) {
        console.warn("Attempted to update array data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    const docRef = firebaseFirestoreFunctions.doc(getUserCollectionRef(collectionName, user.uid), docId);
    const updatePayload = {};
    if (operation === 'add') {
        updatePayload[field] = firebaseFirestoreFunctions.arrayUnion(value);
    } else if (operation === 'remove') {
        updatePayload[field] = firebaseFirestoreFunctions.arrayRemove(value);
    } else {
        throw new Error("Invalid array update operation. Use 'add' or 'remove'.");
    }
    return await firebaseFirestoreFunctions.updateDoc(docRef, updatePayload);
}
