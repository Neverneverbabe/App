import { showCustomAlert } from '../ui.js';
import { fetchSearchResults } from '../api.js';
import {
  addRemoveItemToFolder,
  createLibraryFolder,
  getWatchlistFullName,
  getWatchlistsCache
} from './libraryManager.js';
import { isItemSeen, openSeenEpisodesModal, toggleSeenStatus } from './seenItems.js';
import { openEpisodeModal } from './track.js';

let activeKeyHandler = null;
const MODAL_STYLE_ID = 'netflix-modal-runtime-styles';

function ensureNetflixModalStyles() {
  if (document.getElementById(MODAL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `
.netflix-modal-overlay {
  z-index: 1200;
  align-items: flex-start;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.82);
}
.netflix-modal {
  width: min(100%, 68rem);
  max-width: 68rem;
  max-height: calc(100vh - 3rem);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
}
.netflix-modal-image {
  height: 26rem;
  min-height: 22rem;
  background-color: var(--card-bg);
}
.netflix-modal-image-overlay {
  padding: 2rem;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.68) 44%, rgba(0,0,0,0.1) 100%);
}
.netflix-modal-image-overlay h1 {
  max-width: 44rem;
  margin: 0 0 0.75rem;
  font-size: 2.25rem;
  line-height: 1.1;
}
.netflix-modal-body {
  padding: 1.25rem 2rem 2rem;
}
.netflix-modal-description {
  max-width: 48rem;
  font-size: 1rem;
  line-height: 1.55;
  margin-bottom: 1.25rem;
}
.netflix-modal-middle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.netflix-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  width: auto;
}
.netflix-modal-actions button {
  flex: 0 0 auto;
}
.netflix-modal .watch-now-btn {
  min-height: 44px;
  border-radius: 6px;
  padding: 0.7rem 1.2rem;
}
.netflix-modal .seen-btn,
.netflix-modal .track-btn,
.netflix-modal .watchlist-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--text-secondary);
  background: var(--card-bg);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}
.netflix-modal .seen-btn:hover,
.netflix-modal .track-btn:hover,
.netflix-modal .watchlist-btn:hover,
.netflix-modal .seen-btn.is-seen,
.netflix-modal .watchlist-btn.is-selected {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: var(--white);
}
.netflix-modal .seen-btn:active,
.netflix-modal .track-btn:active,
.netflix-modal .watchlist-btn:active {
  transform: scale(0.96);
}
.netflix-watchlist-panel .dropdown-item {
  background: transparent;
  border: 0;
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
}
.netflix-watchlist-panel .dropdown-item:hover,
.netflix-watchlist-panel .dropdown-item.item-selected {
  background: rgba(var(--white-rgb), 0.12);
}
.light-mode .netflix-watchlist-panel .dropdown-item:hover,
.light-mode .netflix-watchlist-panel .dropdown-item.item-selected {
  background: rgba(var(--black-rgb), 0.08);
}
.netflix-modal-section {
  margin-top: 2rem;
}
.netflix-modal-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.netflix-modal-section h3 {
  margin: 0;
  font-size: 1.15rem;
}
.netflix-media-rail {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 1rem;
}
.netflix-media-card {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}
.netflix-media-card:disabled {
  cursor: default;
}
.netflix-media-card-poster {
  position: relative;
  aspect-ratio: 2 / 3;
  width: 100%;
  overflow: hidden;
  border-radius: 6px;
  background: var(--card-bg);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.netflix-media-card-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.netflix-media-card:hover img {
  opacity: 0.82;
  transform: scale(1.03);
}
.netflix-media-card-title {
  margin-top: 0.55rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.netflix-media-card-meta {
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
}
.netflix-current-badge {
  position: absolute;
  left: 0.45rem;
  bottom: 0.45rem;
  border-radius: 4px;
  background: rgba(var(--science-blue-rgb), 0.92);
  color: var(--white);
  padding: 0.2rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
}
@media (max-width: 640px) {
  .netflix-modal-overlay {
    padding: 0;
  }
  .netflix-modal {
    width: 100%;
    max-width: none;
    min-height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .netflix-modal-image {
    height: 18rem;
    min-height: 18rem;
  }
  .netflix-modal-image-overlay,
  .netflix-modal-body {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  .netflix-modal-image-overlay h1 {
    font-size: 1.6rem;
  }
  .netflix-modal-middle-row {
    align-items: flex-start;
  }
  .netflix-modal-actions {
    flex-wrap: wrap;
  }
  .netflix-media-rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .netflix-media-card-title {
    font-size: 0.78rem;
  }
}`;
  document.head.appendChild(style);
}

function getItemType(item) {
  if (!item) return 'movie';
  if (item.media_type) return item.media_type;
  return item.first_air_date || item.name || item.number_of_seasons ? 'tv' : 'movie';
}

function getImageUrl(path, size = 'w342') {
  if (!path) return '';
  if (String(path).startsWith('http')) return path;
  return 'https://image.tmdb.org/t/p/' + size + path;
}

function getPosterUrl(item, size = 'w342') {
  return getImageUrl(item?.poster_path || item?.backdrop_path, size);
}

function getItemTitle(item) {
  return item?.title || item?.name || 'Untitled';
}

function getItemYear(item) {
  return (item?.release_date || item?.first_air_date || '').slice(0, 4);
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFranchiseQuery(itemDetails) {
  const title = getItemTitle(itemDetails);
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('spider-man') || lowerTitle.includes('spiderman')) {
    return 'Spider-Man';
  }

  const withoutParenthetical = title.replace(/\s*\([^)]*\)/g, '').trim();
  const root = withoutParenthetical.split(/[:\u2013\u2014]/)[0].trim();
  const cleaned = root
    .replace(/\b(part|chapter|volume|vol)\s+[ivxlcdm0-9]+\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length >= 3 ? cleaned : title;
}

function isLikelyFranchiseMovie(item, query) {
  if (!item || getItemType(item) !== 'movie') return false;
  const title = normalizeForMatch(getItemTitle(item));
  const normalizedQuery = normalizeForMatch(query);
  if (!title || !normalizedQuery) return false;
  if (title.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(' ').filter(token => token.length > 2);
  return tokens.length > 0 && tokens.every(token => title.includes(token));
}

function sortMoviesByDate(items) {
  return [...items].sort((a, b) => {
    const aDate = a.release_date || '';
    const bDate = b.release_date || '';
    if (aDate && bDate) return aDate.localeCompare(bDate);
    if (aDate) return -1;
    if (bDate) return 1;
    return (b.popularity || 0) - (a.popularity || 0);
  });
}

function mergeMediaItems(...groups) {
  const byKey = new Map();
  groups.flat().filter(Boolean).forEach(item => {
    if (!item.id) return;
    const type = getItemType(item);
    const key = type + '_' + item.id;
    const existing = byKey.get(key) || {};
    byKey.set(key, { ...existing, ...item, media_type: type });
  });
  return Array.from(byKey.values());
}

async function loadMovieSeriesItems(itemDetails, initialSeries = []) {
  if (!itemDetails || getItemType(itemDetails) !== 'movie') return [];

  const currentMovie = { ...itemDetails, media_type: 'movie' };
  const collectionItems = (initialSeries || []).map(item => ({ ...item, media_type: 'movie' }));
  let searchItems = [];
  const query = getFranchiseQuery(itemDetails);

  if (query && query.length >= 3) {
    try {
      const results = await fetchSearchResults(query, 'movie');
      searchItems = results
        .filter(item => isLikelyFranchiseMovie(item, query))
        .map(item => ({ ...item, media_type: 'movie' }));
    } catch (error) {
      console.warn('Could not load related movie series:', error);
    }
  }

  return sortMoviesByDate(mergeMediaItems([currentMovie], collectionItems, searchItems)).slice(0, 24);
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
    checkmark.innerHTML = selectedIds.has(watchlist.id) ? '<i class="fas fa-check"></i>' : '';
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

function navigateToItem(item, onItemSelect) {
  if (!item?.id || !onItemSelect) return;
  closeNetflixModal({ immediate: true });
  onItemSelect(item.id, getItemType(item));
}

function createMediaCard(item, options = {}) {
  const type = options.type || getItemType(item);
  const currentId = options.currentId ? String(options.currentId) : '';
  const isCurrent = type === 'movie' && currentId && String(item.id) === currentId;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'netflix-media-card';
  card.disabled = isCurrent;

  const poster = document.createElement('div');
  poster.className = 'netflix-media-card-poster';
  const imageUrl = getPosterUrl(item);
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = getItemTitle(item);
    img.loading = 'lazy';
    poster.appendChild(img);
  }
  if (isCurrent) {
    const badge = document.createElement('span');
    badge.className = 'netflix-current-badge';
    badge.textContent = 'Current';
    poster.appendChild(badge);
  }

  const title = document.createElement('div');
  title.className = 'netflix-media-card-title';
  title.textContent = getItemTitle(item);

  const meta = document.createElement('div');
  meta.className = 'netflix-media-card-meta';
  meta.textContent = options.meta || getItemYear(item) || (type === 'tv' ? 'TV' : 'Movie');

  card.appendChild(poster);
  card.appendChild(title);
  card.appendChild(meta);

  if (!isCurrent) {
    card.addEventListener('click', () => {
      if (options.onSeasonSelect) {
        options.onSeasonSelect(item);
        return;
      }
      navigateToItem({ ...item, media_type: type }, options.onItemSelect);
    });
  }

  return card;
}

function createMediaRail(title, items, options = {}) {
  const section = document.createElement('section');
  section.className = 'netflix-modal-section netflix-media-section';

  const header = document.createElement('div');
  header.className = 'netflix-modal-section-header';
  const heading = document.createElement('h3');
  heading.textContent = title;
  header.appendChild(heading);

  const rail = document.createElement('div');
  rail.className = 'netflix-media-rail';
  section.appendChild(header);
  section.appendChild(rail);
  setMediaRailItems(section, items, options);
  return section;
}

function setMediaRailItems(section, items, options = {}) {
  const rail = section.querySelector('.netflix-media-rail');
  if (!rail) return;

  const validItems = (items || []).filter(item => item && item.id);
  rail.innerHTML = '';
  section.hidden = validItems.length === 0;

  validItems.forEach(item => {
    rail.appendChild(createMediaCard(item, options));
  });
}

function createTvSeasonRail(itemDetails, seasons = []) {
  const seasonItems = seasons
    .filter(season => season && season.season_number > 0)
    .map(season => ({
      ...season,
      id: season.id || season.season_number,
      title: season.name || 'Season ' + season.season_number,
      media_type: 'tv'
    }));

  return createMediaRail('Seasons', seasonItems, {
    type: 'tv',
    meta: '',
    onSeasonSelect: () => openEpisodeModal(itemDetails)
  });
}

export function openNetflixModal({ itemDetails = null, imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', rating = null, streamingLinks = [], recommendations = [], series = [], onItemSelect = null, onBack = null, onClose = null } = {}) {
  if (document.getElementById('netflix-modal-overlay')) return;
  ensureNetflixModalStyles();

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
      closeNetflixModal({ immediate: true });
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

  if (itemType === 'movie') {
    const seriesSection = createMediaRail('Series', series, {
      type: 'movie',
      currentId: itemDetails?.id,
      onItemSelect
    });
    body.appendChild(seriesSection);
    loadMovieSeriesItems(itemDetails, series).then(items => {
      setMediaRailItems(seriesSection, items, {
        type: 'movie',
        currentId: itemDetails?.id,
        onItemSelect
      });
    });
  } else if (Array.isArray(itemDetails?.seasons)) {
    body.appendChild(createTvSeasonRail(itemDetails, itemDetails.seasons));
  }

  const recommendedItems = (recommendations || [])
    .filter(item => item && item.id && String(item.id) !== String(itemDetails?.id))
    .slice(0, 24);
  body.appendChild(createMediaRail('More Like This', recommendedItems, { onItemSelect }));

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  setTimeout(() => overlay.classList.add('active'), 10);
}

export function closeNetflixModal(options = {}) {
  const overlay = document.getElementById('netflix-modal-overlay');
  if (!overlay) return;

  const cleanup = () => {
    overlay.remove();
    document.body.style.overflow = '';
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
  };

  if (options.immediate) {
    cleanup();
    return;
  }

  overlay.classList.remove('active');
  setTimeout(cleanup, 400);
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
