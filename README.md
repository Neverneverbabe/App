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
it to your watchlist with the bookmark icon, or launch the first available
streaming link by clicking **Watch Now**.

On some mobile browsers, `window.open` may be blocked. The modal now uses a
helper that falls back to `window.location.href` if opening a new tab fails.

The rest of the project uses plain JavaScript modules, so no React setup is required.
