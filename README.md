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
Each folder card also includes a small pencil icon you can click to rename that watchlist.

## React Movie Library Component

A basic React component is provided in `examples/react/MovieLibrary.jsx` that implements a three-tier library layout. The component manages libraries, watchlists and movie lists in state and lets you browse and organize content with a familiar layout.

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import MovieLibrary from './examples/react/MovieLibrary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<MovieLibrary />);
```

Include React and ReactDOM via your preferred build system or CDN, then mount the component inside a container element with id `root`.

## Bookmark Folder Selector (React)

A popup React component is available in `examples/react/BookmarkFolderSelector.jsx` for selecting multiple watchlist folders when bookmarking a movie. Pass a nested folder structure and any folder selection state to the component and it will render a tree editor with checkboxes.

```javascript
import ReactDOM from 'react-dom/client';
import BookmarkFolderSelector from './examples/react/BookmarkFolderSelector.jsx';

const folders = [
  { id: 'comedy', name: 'Comedy', children: [] },
  {
    id: 'good',
    name: 'Good',
    children: [
      { id: 'crier', name: 'Crier', children: [] },
      { id: 'classic', name: 'Classic', children: [] }
    ],
  },
];

function handleSave(ids) {
  console.log(ids); // persist selections
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BookmarkFolderSelector
    folders={folders}
    initialSelected={['comedy']}
    onSave={handleSave}
    onClose={() => console.log('closed')}
  />
);
```

The UI remembers the initial selection and lets you expand folders to reveal subfolders. Multiple folders can be checked at once.

## React Folder Manager

`examples/react/MovieFolderManager.jsx` demonstrates renaming folders and moving them into other folders.
It renders a nested list where each folder can be edited inline or moved to a new parent.

```javascript
import ReactDOM from 'react-dom/client';
import MovieFolderManager from './react/MovieFolderManager.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <MovieFolderManager />
);
```

## Free to Watch tab + pricing

The **Free** tab lists movies and shows that TMDB/JustWatch report as free or free-with-ads in the US (ad-supported services like Tubi, Pluto TV, The Roku Channel, Freevee and YouTube free movies) - $0, no subscription and no trial. Every title's detail view has a **Pricing & where to watch** section: each service is labelled Stream / Free / Ads / Rent / Buy with a pricing note (for example "$0 - free with ads, no subscription") and links out via TMDB to the service. TMDB does not publish dollar prices - services set those - so exact rental/purchase prices are shown on the service itself.

## Where to watch + trailers

"Watch Now" shows the legal services that carry a title in the US
(TMDB watch providers, powered by JustWatch) with Stream / Rent / Buy
labels, and links out via TMDB to that service — a subscription may be
required there.

Trailers play **inside the app**: the player (`modules/player.js`) uses
a sandboxed YouTube (youtube-nocookie) frame with no `allow-popups` and
no `allow-top-navigation`, so clicking can never open a popup, a
redirect, or an ad tab.

Earlier versions linked to third-party "VidSrc" embed sites. Those were
removed: their players are funded by exactly those click popups and
adult ads, and there is no supported way to embed full movies for free
without them.

## VidSrc reference

VidSrc is a popular video embedding and streaming API that lets users watch movies and TV shows directly using IMDb or TMDB IDs.

### How VidSrc works

- URL structure:
  - Movies: https://vidsrc.to/embed/movie/{IMDB_ID}
  - TV shows: https://vidsrc.cc/v2/embed/tv/{IMDB_ID}/{SEASON}/{EPISODE}
- Integrations and addons: VidSrc is widely used across open-source project codebases, browser extensions (for example the VidSrc Quick Launcher in Edge and Firefox), and media centers.
- Stremio integration: Addons like StremSRC pull direct HTTP streams from VidSrc as an alternative to torrenting.

This reference is included for historical and integration context; the shipped app does not rely on third-party VidSrc embeds in its supported experience.
