# Examples (not part of the shipped app)

These files are standalone demos/experiments. The shipped app is the
plain ES-module site in the repository root (`index.html` + `main.js`);
nothing here is loaded by it.

- `react/` — React demo components (MovieLibrary, BookmarkFolderSelector,
  MovieFolderManager). To try them you will need your own React setup:
  `npm i react react-dom firebase` in a scratch project, then mount a
  component as described in the main README.
- `moviemodalexample.jsx` — a React movie-modal experiment. It was
  previously named `moviemodalexample.py` in error; it is JSX, not Python.
