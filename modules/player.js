// modules/player.js
//
// In-app video player for trailers (YouTube, via the privacy-enhanced
// youtube-nocookie domain).
//
// Why this exists: the old "Watch Now" flow linked out to third-party
// embed sites whose players open popup / redirect / adult ads on click.
// This player never leaves the app and the iframe is sandboxed WITHOUT
// `allow-popups` and WITHOUT `allow-top-navigation`, so content inside
// the frame physically cannot open a new tab, pop under, or navigate
// the top page — clicking it can only play/pause the video.
//
// Full titles are not embedded here (no legal source offers that for
// free); use the Watch providers list, which deep-links to the services
// that carry the title. Trailers play seamlessly in-app.

let overlayEl = null;

function closePlayer() {
  if (!overlayEl) return;
  overlayEl.remove(); // removing the iframe stops playback immediately
  overlayEl = null;
  document.removeEventListener('keydown', onKeyDown);
  document.body.style.overflow = '';
}

function onKeyDown(e) {
  if (e.key === 'Escape') closePlayer();
}

/**
 * Open the trailer player.
 * @param {{key: string, name?: string}} video - YouTube video (from getTrailerFromDetails).
 * @param {string} [title] - Movie/show title shown above the player.
 */
export function openTrailerPlayer(video, title = '') {
  if (!video?.key) return;
  closePlayer();

  overlayEl = document.createElement('div');
  overlayEl.className = 'player-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-label', title ? `Trailer: ${title}` : 'Trailer');

  const box = document.createElement('div');
  box.className = 'player-box';

  const heading = document.createElement('p');
  heading.className = 'player-title';
  heading.textContent = title ? `${title} — Trailer` : (video.name || 'Trailer');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'player-close';
  closeBtn.setAttribute('aria-label', 'Close player');
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener('click', closePlayer);

  const frameWrap = document.createElement('div');
  frameWrap.className = 'player-frame-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'player-frame';
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  iframe.title = heading.textContent;
  // Deliberately NO allow-popups / allow-top-navigation: frame content
  // cannot spawn tabs or redirect this page.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.allowFullscreen = true;

  frameWrap.appendChild(iframe);
  box.append(heading, closeBtn, frameWrap);
  overlayEl.appendChild(box);
  overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closePlayer(); });
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlayEl);
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
}

export function closeTrailerPlayer() {
  closePlayer();
}
