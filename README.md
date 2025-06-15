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
