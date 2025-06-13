import { renderWatchlistOptionsInModal } from '../ui.js';
import { getWatchlistsCache, addRemoveItemToFolder, createLibraryFolder } from './libraryManager.js';

export function openNetflixModal({ itemDetails = null, imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', rating = null, streamingLinks = [] } = {}) {
  if (document.getElementById('netflix-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'netflix-modal-overlay';
  overlay.className = 'netflix-modal-overlay';

  const handleKeyDown = event => {
    if (event.key === 'Escape') closeNetflixModal();
  };
  document.addEventListener('keydown', handleKeyDown);
  overlay._handleKeyDown = handleKeyDown;

  const modal = document.createElement('div');
  modal.className = 'netflix-modal';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'netflix-modal-close';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener('click', closeNetflixModal);
  modal.appendChild(closeBtn);

  const imageSection = document.createElement('div');
  imageSection.className = 'netflix-modal-image';
  if (imageSrc) imageSection.style.backgroundImage = `url('${imageSrc}')`;

  const infoOverlay = document.createElement('div');
  infoOverlay.className = 'netflix-modal-image-overlay';

  const h1 = document.createElement('h1');
  h1.textContent = title;
  infoOverlay.appendChild(h1);

  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'netflix-modal-tags';
  let imdbInserted = false;
  let imdbLink;
  if (imdbUrl) {
    imdbLink = document.createElement('a');
    imdbLink.href = imdbUrl;
    imdbLink.target = '_blank';
    imdbLink.className = 'imdb-link';
    const ratingHtml = rating !== null ? `<span class="imdb-rating">${rating}</span>` : '';
    imdbLink.innerHTML = `<img src="IMDb.png" alt="IMDb">${ratingHtml}`;
  }
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.textContent = tag;
    tagsDiv.appendChild(span);
    if (!imdbInserted && imdbLink && (tag === 'Movie' || tag === 'TV')) {
      tagsDiv.appendChild(imdbLink);
      imdbInserted = true;
    }
  });
  if (imdbLink && !imdbInserted) {
    tagsDiv.appendChild(imdbLink);
  }
  infoOverlay.appendChild(tagsDiv);

  imageSection.appendChild(infoOverlay);
  modal.appendChild(imageSection);

  const body = document.createElement('div');
  body.className = 'netflix-modal-body';

  const p = document.createElement('p');
  p.className = 'netflix-modal-description';
  p.textContent = description;
  body.appendChild(p);

  const actions = document.createElement('div');
  actions.className = 'netflix-modal-actions';

  const seenBtn = document.createElement('button');
  seenBtn.className = 'netflix-modal-action-btn';
  seenBtn.innerHTML = '<i class="fas fa-check"></i>';
  seenBtn.title = 'Mark as Seen';
  actions.appendChild(seenBtn);

  const watchlistDropdown = document.createElement('div');
  watchlistDropdown.className = 'apple-dropdown';
  watchlistDropdown.id = 'add-to-folder-dropdown-modal';
  watchlistDropdown.style.width = '44px';
  watchlistDropdown.innerHTML = `
    <div class="dropdown-selected" id="dropdown-selected-text-modal" title="Add to Watchlist" style="display:flex;align-items:center;justify-content:center;">
      <i class="fa-regular fa-bookmark"></i>
    </div>
    <div class="dropdown-list hide-scrollbar" id="dropdown-list-modal" style="display:none; max-height: 200px; overflow-y: auto; border-radius: 10px; margin-top: 4px;"></div>
    <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg); border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
      <button id="add-new-folder-btn-modal" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
    </div>`;
  actions.appendChild(watchlistDropdown);

  // "Watch Now" button displayed with other action icons
  const watchNowWrapper = document.createElement('div');
  watchNowWrapper.className = 'watch-now-wrapper';

  const watchNowBtn = document.createElement('button');
  watchNowBtn.className = 'watch-now-btn';
  watchNowBtn.innerHTML = '<i class="fas fa-play"></i> Watch Now';

  let selectedLinkIndex = 0;

  const watchNowSelect = document.createElement('select');
  watchNowSelect.className = 'watch-now-select';
  if (streamingLinks && streamingLinks.length > 0) {
    streamingLinks.forEach((link, idx) => {
      const opt = document.createElement('option');
      opt.value = link.url;
      opt.textContent = link.name;
      if (idx === 0) opt.selected = true;
      watchNowSelect.appendChild(opt);
    });
    watchNowSelect.addEventListener('change', (e) => {
      selectedLinkIndex = e.target.selectedIndex;
    });
  }

  // --- Button functionality ---
  let isSeen = false;

  seenBtn.addEventListener('click', () => {
    isSeen = !isSeen;
    seenBtn.classList.toggle('active', isSeen);
    seenBtn.title = isSeen ? 'Marked as Seen' : 'Mark as Seen';
  });


  watchNowBtn.addEventListener('click', () => {
    if (streamingLinks && streamingLinks.length > 0) {
      const url = watchNowSelect.options[selectedLinkIndex]?.value || streamingLinks[0].url;
      window.open(url, '_blank');
    } else if (imdbUrl) {
      window.open(imdbUrl, '_blank');
    }
  });

  watchNowWrapper.appendChild(watchNowBtn);
  if (streamingLinks && streamingLinks.length > 0) {
    watchNowWrapper.appendChild(watchNowSelect);
  }
  actions.appendChild(watchNowWrapper);

  body.appendChild(actions);

  // Optional list of streaming links was previously displayed under the
  // "Watch Now" button. The dropdown next to the button already provides
  // provider choices, so this section has been removed.

  modal.appendChild(body);
  overlay.appendChild(modal);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      closeNetflixModal();
    }
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  if (itemDetails) {
    renderWatchlistOptionsInModal(itemDetails, getWatchlistsCache(), addRemoveItemToFolder, createLibraryFolder);
  }
}

export function closeNetflixModal() {
  const overlay = document.getElementById('netflix-modal-overlay');
  if (overlay) {
    if (overlay._handleKeyDown) {
      document.removeEventListener('keydown', overlay._handleKeyDown);
    }
    overlay.remove();
    document.body.style.overflow = '';
  }
}
