// SignIn/firebase_api.js
// Import initialized auth and db instances, and all Firebase functions from firebase.js
import { auth, db, firebaseAuthFunctions, firebaseFirestoreFunctions } from './firebase.js';

// --- Firebase Authentication Functions ---

/**
 * Creates a new user with the given email and password.
 * @param {object} authInstance - The Firebase Auth instance.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A UserCredential object.
 */
export async function signUp(name, email, password) {
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
 * @param {object} authInstance - The Firebase Auth instance.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A UserCredential object.
 */
export async function signIn(email, password) {
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
 * @param {object} authInstance - The Firebase Auth instance.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
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
    return firebaseAuthFunctions.onAuthStateChanged(auth, callback);
}

/**
 * Gets the currently authenticated user.
 * @returns {object|null} The current Firebase User object, or null if no user is signed in.
 */
export function getCurrentUser() {
    return auth.currentUser;
}

// NOTE: updateProfile is directly used in `signUp` above, not needed as a separate API here,
// but keeping it if external usage is anticipated.
// export async function updateProfile(user, profile) {
//     await firebaseAuthFunctions.updateProfile(user, profile);
// }

// --- Firebase Firestore Functions ---

/**
 * Saves data to a specific document within a user's collection.
 * Creates the document if it doesn't exist, merges data if it does.
 * @param {string} collectionName - The name of the sub-collection (e.g., 'seenItems', 'watchlists').
 * @param {string} docId - The ID of the document to save.
 * @param {object} data - The data to save.
 * @returns {Promise<void>}
 */
export async function saveUserData(collectionName, docId, data) {
    const user = getCurrentUser();
    if (!user) {
        console.warn("Attempted to save data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    // Path: /users/{userId}/{collectionName}/{docId}
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
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
    const user = getCurrentUser();
    if (!user) return null;
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
    const docSnap = await firebaseFirestoreFunctions.getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/**
 * Retrieves all documents from a user's specific collection.
 * @param {string} collectionName - The name of the sub-collection.
 * @returns {Promise<Array<object>>} An array of document data, each including its ID.
 */
export async function getUserCollection(collectionName) {
    const user = getCurrentUser();
    if (!user) return [];
    const collectionRef = firebaseFirestoreFunctions.collection(db, "users", user.uid, collectionName);
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
    const user = getCurrentUser();
    if (!user) {
        console.warn("Attempted to listen to collection without a signed-in user.");
        // Return a no-op unsubscribe function if no user is signed in
        return () => {};
    }
    const collectionRef = firebaseFirestoreFunctions.collection(db, "users", user.uid, collectionName);
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
    const user = getCurrentUser();
    if (!user) {
        console.warn("Attempted to delete data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
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
    const user = getCurrentUser();
    if (!user) {
        console.warn("Attempted to update array data without a signed-in user.");
        throw new Error("User not signed in.");
    }
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
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
