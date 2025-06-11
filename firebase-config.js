// Example Firebase configuration. Replace these values with your Firebase project's details.
window.firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Optional: provide the Canvas-style __firebase_config string if not already defined.
if (typeof window.__firebase_config === 'undefined') {
    window.__firebase_config = JSON.stringify(window.firebaseConfig);
}
