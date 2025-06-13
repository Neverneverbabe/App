# App

This repository includes various scripts for a movie streaming application.

The **NetflixModal.jsx** component demonstrates how to build a Netflix-style modal in React using Tailwind CSS. It features a gradient overlay to blend the image background with the modal, responsive layout, and optional fade-in animation defined in `tailwind.config.js`.

### React Usage

1. Install dependencies:
   ```bash
   npm install react react-dom tailwindcss
   ```
2. Configure Tailwind CSS using the provided `tailwind.config.js`.
3. Import and use `NetflixModal` within your React application.

### Vanilla JavaScript

If your project does not use React, a plain JS equivalent is available at `modules/netflixModal.js`. Include the script in `index.html` and call `openNetflixModal()` with the modal data:

```html
<script src="modules/netflixModal.js" type="module"></script>
```

```javascript
import { openNetflixModal } from './modules/netflixModal.js';

openNetflixModal({
  imageSrc: 'poster.jpg',
  title: 'Example Movie',
  tags: ['Action', 'Drama'],
  description: 'Short description here'
});
```

The repository's existing HTML and JavaScript files are unrelated to React and may require additional setup.
