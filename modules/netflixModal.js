import { renderWatchlistOptionsInModal, createContentCardHtml } from '../ui.js';
import { getWatchlistsCache, addRemoveItemToFolder, createLibraryFolder } from './libraryManager.js';

export function openNetflixModal({ itemDetails = null, imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', rating = null, streamingLinks = [], recommendations = [], series = [], onItemSelect = null } = {}) {
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

  const watchlistBtn = document.createElement('button');
  watchlistBtn.className = 'netflix-modal-action-btn';
  watchlistBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
  watchlistBtn.title = 'Add to Watchlist';
  watchlistBtn.addEventListener('click', () => openWatchlistOverlay(itemDetails));
  actions.appendChild(watchlistBtn);

  // "Watch Now" button displayed with provider dropdown
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

  if (streamingLinks && streamingLinks.length > 0) {
    actions.appendChild(watchNowSelect);
  }
  actions.appendChild(watchNowBtn);

  body.appendChild(actions);

  if (recommendations && recommendations.length > 0) {
    const recSection = document.createElement('div');
    recSection.className = 'netflix-modal-section';
    const recTitle = document.createElement('h3');
    recTitle.textContent = 'Recommendations';
    recSection.appendChild(recTitle);
    const recRow = document.createElement('div');
    recRow.className = 'content-row hide-scrollbar modal-row';
    recommendations.slice(0, 10).forEach(rec => {
      const temp = document.createElement('div');
      temp.innerHTML = createContentCardHtml(rec, false, () => false);
      const card = temp.firstElementChild;
      if (card && onItemSelect) {
        card.addEventListener('click', () => {
          closeNetflixModal();
          onItemSelect(rec.id, rec.media_type || (rec.title ? 'movie' : 'tv'));
        });
      }
      recRow.appendChild(card);
    });
    recSection.appendChild(recRow);
    body.appendChild(recSection);
  }

  if (series && series.length > 0) {
    const seriesSection = document.createElement('div');
    seriesSection.className = 'netflix-modal-section';
    const seriesTitle = document.createElement('h3');
    seriesTitle.textContent = 'Series';
    seriesSection.appendChild(seriesTitle);
    const seriesRow = document.createElement('div');
    seriesRow.className = 'content-row hide-scrollbar modal-row';
    series.forEach(part => {
      const temp = document.createElement('div');
      temp.innerHTML = createContentCardHtml(part, false, () => false);
      const card = temp.firstElementChild;
      if (card && onItemSelect) {
        card.addEventListener('click', () => {
          closeNetflixModal();
          onItemSelect(part.id, part.media_type || (part.title ? 'movie' : 'tv'));
        });
      }
      seriesRow.appendChild(card);
    });
    seriesSection.appendChild(seriesRow);
    body.appendChild(seriesSection);
  }

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

export function openWatchlistOverlay(itemDetails) {
  const modal = document.getElementById('watchlist-modal');
  if (!modal) return;

  const listContainer = document.getElementById('watchlist-options-container');
  const addBtn = document.getElementById('watchlist-add-folder-btn');
  const closeBtn = modal.querySelector('.close-button');

  const itemType = itemDetails.media_type || (itemDetails.title ? 'movie' : 'tv');

  function getSelectedIds() {
    return getWatchlistsCache()
      .filter(wl => wl.items.some(i => String(i.tmdb_id) === String(itemDetails.id) && i.item_type === itemType))
      .map(wl => wl.id);
  }

  function renderList() {
    const watchlists = getWatchlistsCache();
    const selectedIds = getSelectedIds();
    listContainer.innerHTML = watchlists.length
      ? watchlists.map(wl => `
          <div class="dropdown-item ${selectedIds.includes(wl.id) ? 'item-selected' : ''}" data-folder-id="${wl.id}">
            ${wl.name}<span class="checkmark">✔</span>
          </div>`).join('')
      : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No watchlists yet. Click '+' below.</div>`;
  }

  async function listHandler(e) {
    const itemElement = e.target.closest('.dropdown-item');
    if (!itemElement || !itemElement.dataset.folderId) return;
    await addRemoveItemToFolder(itemElement.dataset.folderId, itemDetails, itemType);
    renderList();
  }

  async function addHandler() {
    const newFolderName = prompt('Enter new watchlist name:');
    if (newFolderName && newFolderName.trim() !== '') {
      await createLibraryFolder(newFolderName.trim());
    }
    renderList();
  }

  function closeOverlay() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    listContainer.removeEventListener('click', listHandler);
    addBtn.removeEventListener('click', addHandler);
    modal.removeEventListener('click', outsideHandler);
    closeBtn.removeEventListener('click', closeOverlay);
  }

  function outsideHandler(e) { if (e.target === modal) closeOverlay(); }

  renderList();

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  listContainer.addEventListener('click', listHandler);
  addBtn.addEventListener('click', addHandler);
  modal.addEventListener('click', outsideHandler);
  closeBtn.addEventListener('click', closeOverlay);
}
