import { renderWatchlistOptionsInModal, createContentCardHtml } from '../ui.js';
import { getWatchlistsCache, addRemoveItemToFolder, createLibraryFolder } from '../libraryManager.js';
import { renderTrackSectionInModal, openEpisodeModal } from './track.js';

export function openNetflixModal({ itemDetails = null, imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', rating = null, streamingLinks = [], recommendations = [], series = [], onItemSelect = null, onBack = null, onClose = null } = {}) {
  if (document.getElementById('netflix-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'netflix-modal-overlay';
  overlay.className = 'netflix-modal-overlay';

  const handleClose = () => {
    closeNetflixModal();
    if (onClose) onClose();
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') handleClose();
  };

  document.addEventListener('keydown', handleKeyDown);
  overlay.addEventListener('click', handleClose);

  const modal = document.createElement('div');
  modal.className = 'netflix-modal';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'netflix-modal-close';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener('click', handleClose);
  modal.appendChild(closeBtn);

  if (onBack) {
    const backBtn = document.createElement('button');
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
  if (imageSrc) imageSection.style.backgroundImage = `url(\'${imageSrc}\')`;

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

  const middleRow = document.createElement('div');
  middleRow.className = 'netflix-modal-middle-row';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'netflix-modal-actions';

  const watchNowBtn = document.createElement('button');
  watchNowBtn.className = 'watch-now-btn';
  watchNowBtn.innerHTML = '<i class="fas fa-play"></i> Watch Now';
  watchNowBtn.addEventListener('click', () => {
    if (streamingLinks && streamingLinks.length > 0) {
      const firstLink = streamingLinks[0].url;
      const iframeContainer = document.getElementById('iframe-container');
      const iframe = document.getElementById('video-iframe');
      if (iframeContainer && iframe) {
        iframe.src = firstLink;
        iframeContainer.style.display = 'block';
        closeNetflixModal();
      }
    }
  });
  actionsDiv.appendChild(watchNowBtn);

  const watchlistBtn = document.createElement('button');
  watchlistBtn.className = 'watchlist-btn';
  watchlistBtn.innerHTML = '<i class="fas fa-plus"></i> Watchlist';
  watchlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = watchlistBtn.getBoundingClientRect();
    renderWatchlistOptionsInModal(itemDetails, {
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX
    });
  });
  actionsDiv.appendChild(watchlistBtn);

  middleRow.appendChild(actionsDiv);
  body.appendChild(middleRow);

  if (series && series.length > 0) {
    const episodesSection = document.createElement('div');
    episodesSection.className = 'netflix-modal-section';
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'Episodes';
    episodesSection.appendChild(sectionTitle);

    const episodesGrid = document.createElement('div');
    episodesGrid.className = 'episodes-grid';
    series.forEach(episode => {
      const episodeCard = document.createElement('div');
      episodeCard.className = 'episode-card';
      episodeCard.innerHTML = `
        <div class="episode-image" style="background-image: url(\'${episode.image}\')">
          <div class="episode-play-overlay"><i class="fas fa-play"></i></div>
        </div>
        <div class="episode-info">
          <div class="episode-title">${episode.title}</div>
          <div class="episode-metadata">S${episode.season} E${episode.number}</div>
        </div>
      `;
      episodeCard.addEventListener('click', () => {
        openEpisodeModal(episode, series);
      });
      episodesGrid.appendChild(episodeCard);
    });
    episodesSection.appendChild(episodesGrid);
    body.appendChild(episodesSection);
  }

  if (recommendations && recommendations.length > 0) {
    const recSection = document.createElement('div');
    recSection.className = 'netflix-modal-section';
    const recTitle = document.createElement('h3');
    recTitle.textContent = 'More Like This';
    recSection.appendChild(recTitle);

    const recGrid = document.createElement('div');
    recGrid.className = 'recommendations-grid';
    recommendations.forEach(rec => {
      const recCard = createContentCardHtml(rec);
      recCard.addEventListener('click', () => {
        closeNetflixModal();
        if (onItemSelect) onItemSelect(rec);
      });
      recGrid.appendChild(recCard);
    });
    recSection.appendChild(recGrid);
    body.appendChild(recSection);
  }

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  setTimeout(() => overlay.classList.add('active'), 10);
}

export function closeNetflixModal() {
  const overlay = document.getElementById('netflix-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }, 400);
  }
}

function handleKeyDown(event) {
  if (event.key === 'Escape') closeNetflixModal();
}
