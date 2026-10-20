import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Although not used for persistence yet, it's good practice to import if Firebase is generally used.

// Firebase configuration (global variables provided by the Canvas environment)
// Ensure these variables are available in your runtime environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Initialize Firebase App outside the component to prevent re-initialization
let app;
let auth;
let db; // Firestore instance

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Placeholder for TMDB API key and base URL.
// IMPORTANT: Replace 'YOUR_TMDB_API_KEY' with your actual key.
// You would typically get movie details for a specific movie ID.
const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIE_ID = 940721; // Example: A placeholder movie ID for "Sirens" (actual ID might vary)

const App = () => {
  // State for Firebase user ID
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State for movie data from TMDB
  const [movieData, setMovieData] = useState(null);
  const [loadingMovieData, setLoadingMovieData] = useState(true);
  const [movieDataError, setMovieDataError] = useState(null);

  // State for message box
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [messageBoxContent, setMessageoxContent] = useState('');

  // Firebase Authentication setup
  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth not initialized. Cannot proceed with authentication.");
      setIsAuthReady(true); // Mark as ready even if auth failed to prevent endless loading.
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in.
        setUserId(user.uid);
        console.log("Firebase user signed in:", user.uid);
      } else {
        // User is signed out, or not yet signed in.
        console.log("No Firebase user. Attempting anonymous sign-in...");
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Signed in with custom token.");
          } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
          }
        } catch (error) {
          console.error("Firebase anonymous/custom sign-in error:", error);
        }
      }
      setIsAuthReady(true); // Authentication state has been checked.
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once on mount

  // Fetch movie data from TMDB
  useEffect(() => {
    // Only fetch if Firebase auth is ready (or if we want to fetch regardless of auth status)
    // For this example, we'll fetch once auth is ready.
    if (isAuthReady && TMDB_API_KEY && MOVIE_ID) {
      const fetchMovie = async () => {
        setLoadingMovieData(true);
        setMovieDataError(null);
        try {
          const response = await fetch(`${TMDB_BASE_URL}/movie/${MOVIE_ID}?api_key=${TMDB_API_KEY}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          // Map TMDB data to our movieData structure
          setMovieData({
            title: data.title || data.name || "Unknown Title",
            year: data.release_date ? new Date(data.release_date).getFullYear().toString() : "N/A",
            rating: data.adult ? "Adult" : "Family Friendly", // TMDB `adult` property
            type: data.media_type || "Movie", // TMDB doesn't always specify type explicitly, might need to infer
            genres: data.genres ? data.genres.map(g => g.name) : ["N/A"],
            description: data.overview || "No description available.",
            imageUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "https://placehold.co/500x750/333333/FFFFFF?text=Image+Missing" // Fallback image
          });
        } catch (error) {
          console.error("Error fetching movie data:", error);
          setMovieDataError("Failed to load movie data. Please try again later.");
        } finally {
          setLoadingMovieData(false);
        }
      };

      fetchMovie();
    } else if (!TMDB_API_KEY) {
      setMovieDataError("TMDB API Key is missing. Please provide it to fetch movie data.");
      setLoadingMovieData(false);
    }
  }, [isAuthReady]); // Re-run when auth state is confirmed

  // Function to handle closing the modal (for demonstration purposes)
  const handleCloseModal = () => {
    setMessageoxContent('Close modal button clicked!');
    setShowMessageBox(true);
  };

  // Function to handle action button clicks (e.g., Library, Seen, Like, Dislike)
  const handleActionClick = (action) => {
    setMessageoxContent(`You clicked: ${action}`);
    setShowMessageBox(true);
  };

  // Function to handle the "Play Movie" button click
  const handlePlayMovie = () => {
    setMessageoxContent(`Playing "${movieData ? movieData.title : 'the movie'}"!`);
    setShowMessageBox(true);
  };

  // Function to handle the "Get Started" button click
  const handleGetStarted = () => {
    setMessageoxContent('Getting started with Sirens!');
    setShowMessageBox(true);
  };

  // Display loading, error, or data
  if (loadingMovieData || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 font-inter text-white">
        <p>Loading movie data and authenticating...</p>
      </div>
    );
  }

  if (movieDataError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 font-inter text-white">
        <p className="text-red-500">{movieDataError}</p>
        <p>Please check your TMDB API key and network connection.</p>
      </div>
    );
  }

  if (!movieData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 font-inter text-white">
        <p>No movie data available.</p>
      </div>
    );
  }

  return (
    // Main container for the modal, centered on the screen
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900 font-inter">
      {/* User ID display (for multi-user app requirement) */}
      {userId && (
        <div className="absolute top-4 left-4 text-gray-400 text-sm">
          User ID: <span className="font-mono text-gray-200">{userId}</span>
        </div>
      )}

      {/* Message Box */}
      {showMessageBox && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white text-center flex flex-col items-center">
            <p className="text-lg mb-4">{messageBoxContent}</p>
            <button
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none"
              onClick={() => setShowMessageBox(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal content container */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl overflow-hidden w-full max-w-xl mx-auto flex flex-col">
        {/* Background image section */}
        <div
          className="relative h-64 md:h-80 bg-cover bg-center"
          style={{
            backgroundImage: `url('${movieData.imageUrl}')`,
          }}
        >
          {/* Gradient overlay for better text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-800 via-transparent to-transparent"></div>
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none z-10 p-2 rounded-full bg-black bg-opacity-50"
            aria-label="Close modal"
            onClick={handleCloseModal}
          >
            {/* Close icon (SVG) */}
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        {/* Content section */}
        <div className="p-6 md:p-8 pt-0 text-white flex flex-col justify-between">
          <div>
            {/* Title */}
            <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white tracking-wide font-inter">{movieData.title}</h1>
            {/* Metadata tags */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm px-3 py-1 bg-gray-700 text-gray-300 rounded-full">{movieData.year}</span>
              <span className="text-sm px-3 py-1 bg-gray-700 text-gray-300 rounded-full">{movieData.rating}</span>
              <span className="text-sm px-3 py-1 bg-gray-700 text-gray-300 rounded-full">{movieData.type}</span>
              {/* Dynamically render genres */}
              {movieData.genres.map((genre, index) => (
                <span key={index} className="text-sm px-3 py-1 bg-gray-700 text-gray-300 rounded-full">{genre}</span>
              ))}
            </div>
            {/* Description */}
            <p className="text-gray-300 text-base leading-relaxed mb-8">
              {movieData.description}
            </p>
          </div>

          {/* Action buttons section */}
          <div className="flex flex-col items-center">
            <div className="flex justify-around items-center w-full mb-4">
              {/* Library button */}
              <button
                className="flex flex-col items-center text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none"
                aria-label="Add to library"
                onClick={() => handleActionClick('Library')}
              >
                {/* Library icon (SVG) */}
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <span className="text-xs mt-1">Library</span>
              </button>
              {/* Mark as seen button */}
              <button
                className="flex flex-col items-center text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none"
                aria-label="Mark as seen"
                onClick={() => handleActionClick('Mark as seen')}
              >
                {/* Seen icon (SVG) */}
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-xs mt-1">Mark as seen</span>
              </button>
              {/* Like button */}
              <button
                className="flex flex-col items-center text-gray-300 hover:text-green-500 transition-colors duration-200 focus:outline-none"
                aria-label="Like"
                onClick={() => handleActionClick('Like')}
              >
                {/* Like icon (SVG) */}
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H6V6a2 2 0 00-2-2h-1a2 2 0 00-2 2v10a2 2 0 002 2h10.737a2 2 0 001.789-2.894l-3.5-7z"
                  />
                </svg>
                <span className="text-xs mt-1">Like</span>
              </button>
              {/* Dislike button */}
              <button
                className="flex flex-col items-center text-gray-300 hover:text-red-500 transition-colors duration-200 focus:outline-none"
                aria-label="Dislike"
                onClick={() => handleActionClick('Dislike')}
              >
                {/* Dislike icon (SVG) */}
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3H18v15a2 2 0 01-2 2h1a2 2 0 012-2V4a2 2 0 01-2-2h-10.737a2 2 0 01-1.789 2.894l3.5 7z"
                  />
                </svg>
                <span className="text-xs mt-1">Dislike</span>
              </button>
              {/* Play Movie button */}
              <button
                className="flex flex-col items-center text-red-500 hover:text-red-400 transition-colors duration-200 focus:outline-none"
                aria-label="Play movie"
                onClick={handlePlayMovie}
              >
                {/* Play icon (SVG) */}
                <svg
                  className="w-12 h-12"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="text-xs mt-1">Play Movie</span>
              </button>
            </div>
            {/* Get Started button */}
            <button
              className="mt-6 w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 focus:outline-none"
              onClick={handleGetStarted}
            >
              Get Started &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
