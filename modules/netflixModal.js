import { renderWatchlistOptionsInModal, createContentCardHtml } from '../ui.js';
import { getWatchlistsCache, addRemoveItemToFolder, createLibraryFolder } from './libraryManager.js';
import { renderTrackSectionInModal, openEpisodeModal } from './track.js';

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
  seenBtn.setAttribute('aria-label', 'Mark as Seen');
  actions.appendChild(seenBtn);

  const watchlistDropdown = document.createElement('div');
  watchlistDropdown.className = 'apple-dropdown';
  watchlistDropdown.id = 'add-to-folder-dropdown-modal';
  watchlistDropdown.style.width = '44px';
  watchlistDropdown.innerHTML = `
    <div class="dropdown-selected" id="dropdown-selected-text-modal" title="Add to Watchlist" aria-label="Add to Watchlist" role="button" tabindex="0" style="display:flex;align-items:center;justify-content:center;">
      <i class="fa-regular fa-bookmark"></i>
    </div>
    <div class="dropdown-list hide-scrollbar" id="dropdown-list-modal" style="display:none; border-radius: 10px; margin-top: 4px;"></div>
    <div class="dropdown-footer" id="dropdown-footer-modal" style="display:none; padding: 0.5em 1em; text-align: center; border-top: 1px solid var(--border-color); background: var(--dropdown-bg); border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
      <button id="add-new-folder-btn-modal" aria-label="Add New Watchlist" style="background:none; border:none; color:var(--science-blue); font-size:1.5em; cursor:pointer; width:100%; line-height:1;">+</button>
    </div>`;
  actions.appendChild(watchlistDropdown);

  // "Watch Now" button displayed with provider overlay
  const watchNowBtn = document.createElement('button');
  watchNowBtn.className = 'watch-now-btn';
  watchNowBtn.innerHTML = '<i class="fas fa-play"></i> Watch Now';

  let selectedLinkIndex = 0;

  const providerBtn = document.createElement('button');
  providerBtn.className = 'netflix-modal-action-btn';
  providerBtn.innerHTML = '<i class="fas fa-link"></i>';
  providerBtn.title = 'Watch Links';
  providerBtn.setAttribute('aria-label', 'Watch Links');
  providerBtn.dataset.selectedIndex = '0';

  let showTrackButton = false;
  if (itemDetails) {
    const type = itemDetails.media_type || (itemDetails.title ? 'movie' : 'tv');
    if (type === 'tv') showTrackButton = true;
  }

  const trackBtn = document.createElement('button');
  if (showTrackButton) {
    trackBtn.className = 'netflix-modal-action-btn';
    trackBtn.innerHTML = '<i class="fas fa-bars-progress"></i>';
    trackBtn.title = 'Track Progress';
    trackBtn.setAttribute('aria-label', 'Track Progress');
  }

  providerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const currentIdx = parseInt(providerBtn.dataset.selectedIndex, 10) || 0;
    openProviderModal(streamingLinks, imdbUrl, currentIdx, (idx) => {
      selectedLinkIndex = idx;
      providerBtn.dataset.selectedIndex = String(idx);
      if (streamingLinks[idx]) providerBtn.title = streamingLinks[idx].name;
    });
  });

  if (showTrackButton) {
    trackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = document.getElementById('netflix-track-container');
      if (!container) return;
      const shouldShow = container.style.display === 'none' || container.style.display === '';
      container.style.display = shouldShow ? 'block' : 'none';
      if (shouldShow && itemDetails) {
        renderTrackSectionInModal(itemDetails);
        openEpisodeModal(itemDetails);
      }
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
      const idx = parseInt(providerBtn.dataset.selectedIndex, 10) || selectedLinkIndex;
      const url = streamingLinks[idx]?.url || streamingLinks[0].url;
      window.open(url, '_blank');
    } else if (imdbUrl) {
      window.open(imdbUrl, '_blank');
    }
  });

  if (streamingLinks && streamingLinks.length > 0) {
    actions.appendChild(providerBtn);
  }
  if (showTrackButton) {
    actions.appendChild(trackBtn);
  }

  body.appendChild(actions);

  const watchNowRow = document.createElement('div');
  watchNowRow.className = 'netflix-modal-watch-row';
  watchNowRow.appendChild(watchNowBtn);
  body.appendChild(watchNowRow);

  const trackContainer = document.createElement('div');
  trackContainer.id = 'netflix-track-container';
  trackContainer.style.display = 'none';
  trackContainer.style.marginTop = '1rem';
  body.appendChild(trackContainer);

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
    const watchlistBtn = document.getElementById('dropdown-selected-text-modal');
    if (watchlistBtn) {
      const clone = watchlistBtn.cloneNode(true);
      watchlistBtn.parentNode.replaceChild(clone, watchlistBtn);
      clone.addEventListener('click', (e) => {
        e.stopPropagation();
        openWatchlistModal(itemDetails);
      });
    }
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

export function openWatchlistModal(itemDetails) {
  const overlay = document.getElementById('watchlist-modal');
  if (!overlay) return;
  let listEl = document.getElementById('watchlist-options-list');
  let addBtn = document.getElementById('watchlist-add-btn');
  let doneBtn = document.getElementById('watchlist-modal-done');
  const closeBtn = overlay.querySelector('.close-button');

  const itemType = itemDetails.media_type || (itemDetails.title ? 'movie' : 'tv');

  function getSelectedIds(cache) {
    return cache.filter(wl => wl.items.some(it => String(it.tmdb_id) === String(itemDetails.id) && it.item_type === itemType)).map(wl => wl.id);
  }

  function updateList() {
    let cache = getWatchlistsCache();
    const selected = getSelectedIds(cache);
    listEl.innerHTML = cache.length
      ? cache.map(wl => `<div class="dropdown-item ${selected.includes(wl.id) ? 'item-selected' : ''}" data-folder-id="${wl.id}">${wl.name}<span class="checkmark">✔</span></div>`).join('')
      : `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No watchlists yet. Click '+' below.</div>`;
  }

  const newListEl = listEl.cloneNode(false);
  listEl.parentNode.replaceChild(newListEl, listEl);
  listEl = newListEl;

  listEl.addEventListener('click', async (e) => {
    e.stopPropagation();
    const item = e.target.closest('.dropdown-item');
    if (!item || !item.dataset.folderId) return;
    await addRemoveItemToFolder(item.dataset.folderId, itemDetails, itemType);
    updateList();
  });

  const newAddBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newAddBtn, addBtn);
  addBtn = newAddBtn;
  addBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = prompt('Enter new watchlist name:');
    if (name && name.trim() !== '') {
      await createLibraryFolder(name.trim());
      updateList();
    }
  });

  function close() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    renderWatchlistOptionsInModal(itemDetails, getWatchlistsCache(), addRemoveItemToFolder, createLibraryFolder);
    const btn = document.getElementById('dropdown-selected-text-modal');
    if (btn) {
      const c = btn.cloneNode(true);
      btn.parentNode.replaceChild(c, btn);
      c.addEventListener('click', (ev) => { ev.stopPropagation(); openWatchlistModal(itemDetails); });
    }
  }

  const newDoneBtn = doneBtn.cloneNode(true);
  doneBtn.parentNode.replaceChild(newDoneBtn, doneBtn);
  doneBtn = newDoneBtn;
  doneBtn.addEventListener('click', close);

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', close);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  updateList();
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

export function openProviderModal(streamingLinks = [], imdbUrl = '', currentIdx = 0, onSelect = null) {
  const overlay = document.getElementById('links-modal');
  if (!overlay) return;
  let listEl = document.getElementById('provider-options-list');
  const closeBtn = overlay.querySelector('.close-button');

  const newListEl = listEl.cloneNode(false);
  listEl.parentNode.replaceChild(newListEl, listEl);
  listEl = newListEl;

  if (streamingLinks.length > 0) {
    listEl.innerHTML = streamingLinks
      .map((link, idx) => `<div class="dropdown-item${idx === currentIdx ? ' selected' : ''}" data-index="${idx}">${link.name}<span class="checkmark">✔</span></div>`)
      .join('');
    listEl.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.dataset.index === undefined) return;
      const idx = parseInt(item.dataset.index, 10);
      listEl.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      if (onSelect) onSelect(idx);
      close();
    });
  } else if (imdbUrl) {
    listEl.innerHTML = `<a class="dropdown-item" href="${imdbUrl}" target="_blank">IMDb</a>`;
  } else {
    listEl.innerHTML = `<div class="dropdown-item" style="color:var(--text-secondary);cursor:default;text-align:center;">No streaming links available.</div>`;
  }

  function close() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', close);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
