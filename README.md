# App

This repository includes various scripts for a movie streaming application.

## Netflix-style Modal

A modal inspired by Netflix is provided via `modules/netflixModal.js`. Include the script in your page and call `openNetflixModal()` with your data.

```html
<script src="modules/netflixModal.js" type="module"></script>
```

```javascript
import { openNetflixModal } from './modules/netflixModal.js';

openNetflixModal({
  imageSrc: 'poster.jpg',
  title: 'Example Movie',
  tags: ['Action', 'Drama'],
  description: 'Short description here',
  rating: '8.5'
});
```

Inside the modal you can mark the item as seen using the checkmark button, save
it to your watchlist with the bookmark icon, track your progress with the bars
icon, or launch the first available streaming link by clicking **Watch Now**.
For TV shows, the checkmark button lets you select individual episodes or mark
an entire season as seen, while the progress icon simply bookmarks the episode
you last watched.

The rest of the project uses plain JavaScript modules, so no React setup is required.

## Library Folder Reordering

Folders in the **Library** tab can be rearranged by dragging a folder tile onto another.
The new order is saved to your account so your organization persists across sessions.

## React Movie Library Component

A basic React component is provided in `react/MovieLibrary.jsx` that implements a three-tier library layout. The component manages libraries, watchlists and movie lists in state and lets you add new folders dynamically.

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import MovieLibrary from './react/MovieLibrary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<MovieLibrary />);
```

Include React and ReactDOM via your preferred build system or CDN, then mount the component inside a container element with id `root`.
