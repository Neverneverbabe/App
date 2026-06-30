import { createContentCardHtml, showCustomAlert } from '../ui.js';
import {
  addRemoveItemToFolder,
  createLibraryFolder,
  getWatchlistFullName,
  getWatchlistsCache
} from './libraryManager.js';
import { isItemSeen, openSeenEpisodesModal, toggleSeenStatus } from './seenItems.js';
import { openEpisodeModal } from './track.js';

let activeKeyHandler = null;

function getItemType(item) {
  if (!item) return 'movie';
  return item.media_type || (item.first_air_date || item.name ? 'tv' : 'movie');
}

function getPosterUrl(item, size = 'w300') {
  const path = item?.poster_path || item?.backdrop_path;
  if (!path) return '';
  if (String(path).startsWith('http')) return path;
  return 'https://image.tmdb.org/t/p/' + size + path;
}

function getFoldersContainingItem(itemDetails, itemType) {
  const itemId = itemDetails?.id;
  if (!itemId) return [];
  return getWatchlistsCache()
    .filter(watchlist => Array.isArray(watchlist.items) && watchlist.items.some(item =>
      String(item.tmdb_id) === String(itemId) && item.item_type === itemType
    ))
    .map(watchlist => watchlist.id);
}

function renderWatchlistChoices(container, itemDetails, itemType) {
  const watchlists = getWatchlistsCache();
  const selectedIds = new Set(getFoldersContainingItem(itemDetails, itemType));
  container.innerHTML = '';

  if (!watchlists.length) {
    const empty = document.createElement('div');
    empty.className = 'dropdown-item';
    empty.style.cursor = 'default';
    empty.style.color = 'var(--text-secondary)';
    empty.textContent = 'No watchlists yet. Use + to create one.';
    container.appendChild(empty);
    return selectedIds;
  }

  watchlists.forEach(watchlist => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'dropdown-item';
    option.dataset.folderId = watchlist.id;
    option.style.display = 'flex';
    option.style.justifyContent = 'space-between';
    option.style.alignItems = 'center';
    option.style.width = '100%';
    option.style.textAlign = 'left';

    const name = document.createElement('span');
    name.textContent = getWatchlistFullName(watchlist.id) || watchlist.name || 'Untitled Watchlist';
    option.appendChild(name);

    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    checkmark.textContent = selectedIds.has(watchlist.id) ? 'OK' : '';
    option.appendChild(checkmark);

    if (selectedIds.has(watchlist.id)) {
      option.classList.add('item-selected');
    }

    container.appendChild(option);
  });

  return selectedIds;
}

function updateWatchlistButton(button, itemDetails, itemType) {
  const selectedIds = getFoldersContainingItem(itemDetails, itemType);
  const icon = button.querySelector('i');
  const isSelected = selectedIds.length > 0;
  button.classList.toggle('is-selected', isSelected);
  button.title = isSelected ? 'Edit Watchlists' : 'Add to Watchlist';
  if (icon) {
    icon.classList.toggle('fa-solid', isSelected);
    icon.classList.toggle('fa-regular', !isSelected);
  }
}

function updateSeenButton(button, itemDetails, itemType) {
  if (!button || !itemDetails?.id) return;
  const seen = isItemSeen(itemDetails.id, itemType);
  button.classList.toggle('is-seen', seen);
  button.title = seen ? 'Mark as Unseen' : 'Mark as Seen';
}

function createWatchlistPanel(itemDetails, itemType, onUpdate) {
  const panel = document.createElement('div');
  panel.className = 'netflix-watchlist-panel dropdown-list hide-scrollbar';
  panel.style.cssText = 'display:none;position:absolute;right:0;top:calc(100% + 0.5rem);min-width:240px;max-height:300px;overflow-y:auto;z-index:1300;background:var(--dropdown-bg);border:1px solid var(--border-color);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.35);padding:0.35rem;';

  const list = document.createElement('div');
  panel.appendChild(list);

  const footer = document.createElement('div');
  footer.className = 'dropdown-footer';
  footer.style.cssText = 'border-top:1px solid var(--border-color);margin-top:0.35rem;padding-top:0.35rem;text-align:center;';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = '+';
  addButton.title = 'Add New Watchlist';
  addButton.style.cssText = 'background:none;border:none;color:var(--science-blue);font-size:1.5rem;line-height:1;cursor:pointer;width:100%;';
  footer.appendChild(addButton);
  panel.appendChild(footer);

  const refresh = () => {
    renderWatchlistChoices(list, itemDetails, itemType);
    if (onUpdate) onUpdate();
  };

  list.addEventListener('click', async event => {
    const option = event.target.closest('[data-folder-id]');
    if (!option) return;
    event.stopPropagation();
    await addRemoveItemToFolder(option.dataset.folderId, itemDetails, itemType);
    refresh();
  });

  addButton.addEventListener('click', async event => {
    event.stopPropagation();
    const folderName = prompt('Enter new watchlist name:');
    if (folderName && folderName.trim()) {
      await createLibraryFolder(folderName.trim());
      refresh();
    }
  });

  refresh();
  return panel;
}

function createElementFromHtml(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild;
}

function renderRelatedSection({ title, items, itemDetails, itemType, onItemSelect }) {
  if (!items || items.length === 0) return null;

  const section = document.createElement('div');
  section.className = 'netflix-modal-section';

  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = itemType === 'tv' ? 'episodes-grid' : 'recommendations-grid';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = itemType === 'tv' ? 'episode-card' : 'content-card';
    card.style.cursor = 'pointer';

    const imageUrl = getPosterUrl(item);
    const image = document.createElement('div');
    image.className = itemType === 'tv' ? 'episode-image' : 'image-container';
    if (imageUrl) image.style.backgroundImage = 'url("' + imageUrl + '")';

    const info = document.createElement('div');
    info.className = itemType === 'tv' ? 'episode-info' : '';

    const itemTitle = document.createElement('div');
    itemTitle.className = itemType === 'tv' ? 'episode-title' : '';
    itemTitle.textContent = item.title || item.name || 'Untitled';
    info.appendChild(itemTitle);

    const metadata = document.createElement('div');
    metadata.className = 'episode-metadata';
    metadata.textContent = itemType === 'tv' && item.season_number ? 'Season ' + item.season_number : '';
    if (metadata.textContent) info.appendChild(metadata);

    card.appendChild(image);
    card.appendChild(info);
    card.addEventListener('click', () => {
      if (itemType === 'tv') {
        openEpisodeModal(itemDetails);
        return;
      }
      const selectedType = getItemType(item);
      if (onItemSelect && item.id) onItemSelect(item.id, selectedType);
    });
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

export function openNetflixModal({ itemDetails = null, imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', rating = null, streamingLinks = [], recommendations = [], series = [], onItemSelect = null, onBack = null, onClose = null } = {}) {
  if (document.getElementById('netflix-modal-overlay')) return;

  const itemType = getItemType(itemDetails);
  const overlay = document.createElement('div');
  overlay.id = 'netflix-modal-overlay';
  overlay.className = 'netflix-modal-overlay';

  const handleClose = () => {
    closeNetflixModal();
    if (onClose) onClose();
  };

  activeKeyHandler = event => {
    if (event.key === 'Escape') handleClose();
  };
  document.addEventListener('keydown', activeKeyHandler);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) handleClose();
  });

  const modal = document.createElement('div');
  modal.className = 'netflix-modal';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'netflix-modal-close';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener('click', handleClose);
  modal.appendChild(closeBtn);

  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'netflix-modal-back';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => {
      closeNetflixModal();
      onBack();
    });
    modal.appendChild(backBtn);
  }

  const imageSection = document.createElement('div');
  imageSection.className = 'netflix-modal-image';
  if (imageSrc) imageSection.style.backgroundImage = 'url("' + imageSrc + '")';

  const infoOverlay = document.createElement('div');
  infoOverlay.className = 'netflix-modal-image-overlay';

  const h1 = document.createElement('h1');
  h1.textContent = title;
  infoOverlay.appendChild(h1);

  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'netflix-modal-tags';
  let imdbInserted = false;
  let imdbLink = null;
  if (imdbUrl) {
    imdbLink = document.createElement('a');
    imdbLink.href = imdbUrl;
    imdbLink.target = '_blank';
    imdbLink.rel = 'noopener noreferrer';
    imdbLink.className = 'imdb-link';
    imdbLink.innerHTML = '<img src="IMDb.png" alt="IMDb">' + (rating !== null ? '<span class="imdb-rating">' + rating + '</span>' : '');
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
  if (imdbLink && !imdbInserted) tagsDiv.appendChild(imdbLink);

  infoOverlay.appendChild(tagsDiv);
  imageSection.appendChild(infoOverlay);
  modal.appendChild(imageSection);

  const body = document.createElement('div');
  body.className = 'netflix-modal-body';

  const overview = document.createElement('p');
  overview.className = 'netflix-modal-description';
  overview.textContent = description;
  body.appendChild(overview);

  const middleRow = document.createElement('div');
  middleRow.className = 'netflix-modal-middle-row';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'netflix-modal-actions';
  actionsDiv.style.position = 'relative';

  const watchNowBtn = document.createElement('button');
  watchNowBtn.type = 'button';
  watchNowBtn.className = 'watch-now-btn';
  watchNowBtn.innerHTML = '<i class="fas fa-play"></i> Watch Now';
  watchNowBtn.addEventListener('click', () => {
    if (streamingLinks && streamingLinks.length > 0) {
      window.open(streamingLinks[0].url, '_blank', 'noopener,noreferrer');
    } else {
      showCustomAlert('Info', 'No streaming links are available for this item.');
    }
  });
  actionsDiv.appendChild(watchNowBtn);

  const seenBtn = document.createElement('button');
  seenBtn.type = 'button';
  seenBtn.className = 'seen-btn';
  seenBtn.innerHTML = '<i class="fas fa-check"></i>';
  seenBtn.addEventListener('click', async event => {
    event.stopPropagation();
    if (!itemDetails?.id) {
      showCustomAlert('Info', 'Item details are still loading. Please try again.');
      return;
    }
    if (itemType === 'tv') {
      await openSeenEpisodesModal(itemDetails);
    } else {
      await toggleSeenStatus(itemDetails, itemType);
    }
    updateSeenButton(seenBtn, itemDetails, itemType);
  });
  updateSeenButton(seenBtn, itemDetails, itemType);
  actionsDiv.appendChild(seenBtn);

  if (itemType === 'tv') {
    const trackBtn = document.createElement('button');
    trackBtn.type = 'button';
    trackBtn.className = 'track-btn';
    trackBtn.innerHTML = '<i class="fas fa-bars-progress"></i>';
    trackBtn.title = 'Track Progress';
    trackBtn.addEventListener('click', event => {
      event.stopPropagation();
      if (itemDetails) openEpisodeModal(itemDetails);
    });
    actionsDiv.appendChild(trackBtn);
  }

  const watchlistWrapper = document.createElement('div');
  watchlistWrapper.style.position = 'relative';
  watchlistWrapper.style.display = 'inline-flex';

  const watchlistBtn = document.createElement('button');
  watchlistBtn.type = 'button';
  watchlistBtn.className = 'watchlist-btn';
  watchlistBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
  updateWatchlistButton(watchlistBtn, itemDetails, itemType);

  const watchlistPanel = createWatchlistPanel(itemDetails, itemType, () => updateWatchlistButton(watchlistBtn, itemDetails, itemType));
  watchlistBtn.addEventListener('click', event => {
    event.stopPropagation();
    watchlistPanel.style.display = watchlistPanel.style.display === 'block' ? 'none' : 'block';
  });
  watchlistWrapper.appendChild(watchlistBtn);
  watchlistWrapper.appendChild(watchlistPanel);
  actionsDiv.appendChild(watchlistWrapper);

  modal.addEventListener('click', event => {
    if (!event.target.closest('.netflix-watchlist-panel') && !event.target.closest('.watchlist-btn')) {
      watchlistPanel.style.display = 'none';
    }
  });

  middleRow.appendChild(actionsDiv);
  body.appendChild(middleRow);

  const relatedSection = renderRelatedSection({
    title: itemType === 'tv' ? 'Seasons' : 'In This Collection',
    items: series,
    itemDetails,
    itemType,
    onItemSelect
  });
  if (relatedSection) body.appendChild(relatedSection);

  if (recommendations && recommendations.length > 0) {
    const recSection = document.createElement('div');
    recSection.className = 'netflix-modal-section';

    const recTitle = document.createElement('h3');
    recTitle.textContent = 'More Like This';
    recSection.appendChild(recTitle);

    const recGrid = document.createElement('div');
    recGrid.className = 'recommendations-grid';
    const isLightMode = document.body.classList.contains('light-mode');

    recommendations.forEach(rec => {
      const recType = getItemType(rec);
      const card = createElementFromHtml(createContentCardHtml({ ...rec, media_type: recType }, isLightMode, isItemSeen));
      if (!card) return;
      card.addEventListener('click', event => {
        if (event.target.closest('.seen-toggle-icon') || event.target.closest('.bookmark-toggle-icon')) return;
        closeNetflixModal();
        if (onItemSelect) onItemSelect(rec.id, recType);
      });
      recGrid.appendChild(card);
    });

    recSection.appendChild(recGrid);
    body.appendChild(recSection);
  }

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  setTimeout(() => overlay.classList.add('active'), 10);
}

export function closeNetflixModal() {
  const overlay = document.getElementById('netflix-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
      if (activeKeyHandler) {
        document.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
      }
    }, 400);
  }
}

export function openWatchlistModal(itemDetails = null) {
  const modal = document.getElementById('watchlist-modal');
  const list = document.getElementById('watchlist-options-list');
  const addButton = document.getElementById('watchlist-add-btn');
  const doneButton = document.getElementById('watchlist-modal-done');

  if (!itemDetails || !modal || !list) {
    showCustomAlert('Info', 'Select a movie or show before adding it to a watchlist.');
    return;
  }

  const itemType = getItemType(itemDetails);
  const refresh = () => renderWatchlistChoices(list, itemDetails, itemType);
  refresh();

  list.onclick = async event => {
    const option = event.target.closest('[data-folder-id]');
    if (!option) return;
    await addRemoveItemToFolder(option.dataset.folderId, itemDetails, itemType);
    refresh();
  };

  if (addButton) {
    const newAddButton = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(newAddButton, addButton);
    newAddButton.addEventListener('click', async () => {
      const folderName = prompt('Enter new watchlist name:');
      if (folderName && folderName.trim()) {
        await createLibraryFolder(folderName.trim());
        refresh();
      }
    });
  }

  const close = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  if (doneButton) {
    const newDoneButton = doneButton.cloneNode(true);
    doneButton.parentNode.replaceChild(newDoneButton, doneButton);
    newDoneButton.addEventListener('click', close);
  }

  const closeButton = modal.querySelector('.close-button');
  if (closeButton) closeButton.onclick = close;
  modal.onclick = event => {
    if (event.target === modal) close();
  };

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
