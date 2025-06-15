import React, { useState } from 'react';

// Example data structure for the library system
const initialLibraries = [
  {
    id: 'comedy',
    name: 'Comedy',
    movies: [
      { id: 'm1', title: 'Funny Movie' },
      { id: 'm2', title: 'Another Laugh' }
    ],
    watchlists: []
  },
  {
    id: 'good',
    name: 'Good',
    movies: [],
    watchlists: [
      {
        id: 'crier',
        name: 'Crier',
        movies: [ { id: 'm3', title: 'Tears of Joy' } ]
      },
      {
        id: 'classic',
        name: 'Classic',
        movies: [ { id: 'm4', title: 'Vintage Hit' } ]
      }
    ]
  },
  {
    id: 'horror',
    name: 'Horror',
    movies: [ { id: 'm5', title: 'Scary One' } ],
    watchlists: []
  }
];

/**
 * MovieLibrary component provides a three tier layout:
 * 1. Libraries row with a "New Library +" button.
 * 2. Watchlists row visible when a library is selected with a "New Watchlist +" button.
 * 3. Movie grid showing movies that match the selected folder and optional watchlist.
 */
function MovieLibrary() {
  const [libraries, setLibraries] = useState(initialLibraries);
  const [selectedLibraryId, setSelectedLibraryId] = useState(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(null);

  const addLibrary = (name) => {
    const newLib = { id: Date.now().toString(), name, movies: [], watchlists: [] };
    setLibraries([...libraries, newLib]);
  };

  const addWatchlist = (libraryId, name) => {
    setLibraries(libs => libs.map(lib => lib.id === libraryId
      ? { ...lib, watchlists: [...lib.watchlists, { id: Date.now().toString(), name, movies: [] }] }
      : lib
    ));
  };

  const onSelectLibrary = (id) => {
    setSelectedLibraryId(id);
    setSelectedWatchlistId(null);
  };

  const onSelectWatchlist = (id) => {
    setSelectedWatchlistId(id);
  };

  const selectedLibrary = libraries.find(l => l.id === selectedLibraryId);
  const selectedWatchlist = selectedLibrary?.watchlists.find(w => w.id === selectedWatchlistId);

  const movies = selectedWatchlist
    ? selectedWatchlist.movies
    : selectedLibrary
      ? selectedLibrary.watchlists.reduce((acc, w) => acc.concat(w.movies), [...selectedLibrary.movies])
      : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {libraries.map(lib => (
          <button
            key={lib.id}
            onClick={() => onSelectLibrary(lib.id)}
            className={`px-3 py-1 rounded ${selectedLibraryId === lib.id ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-100'}`}
          >
            {lib.name}
          </button>
        ))}
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white"
          onClick={() => {
            const name = prompt('New library name');
            if (name) addLibrary(name);
          }}
        >
          New Library +
        </button>
      </div>

      {selectedLibrary && (
        <div className="flex flex-wrap gap-2">
          {selectedLibrary.watchlists.map(w => (
            <button
              key={w.id}
              onClick={() => onSelectWatchlist(w.id)}
              className={`px-3 py-1 rounded ${selectedWatchlistId === w.id ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-100'}`}
            >
              {w.name}
            </button>
          ))}
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white"
            onClick={() => {
              const name = prompt('New watchlist name');
              if (name) addWatchlist(selectedLibrary.id, name);
            }}
          >
            New Watchlist +
          </button>
        </div>
      )}

      {selectedLibrary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {movies.map(movie => (
            <div key={movie.id} className="p-2 bg-gray-800 rounded text-white">
              {movie.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MovieLibrary;
