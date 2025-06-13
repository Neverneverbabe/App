export function openNetflixModal({ imageSrc = '', title = '', tags = [], description = '', imdbUrl = '', streamingLinks = [] } = {}) {
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
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.textContent = tag;
    tagsDiv.appendChild(span);
  });
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
  watchlistBtn.className = 'netflix-modal-action-btn primary';
  watchlistBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
  watchlistBtn.title = 'Add to Watchlist';
  actions.appendChild(watchlistBtn);

  body.appendChild(actions);

  const infoDiv = document.createElement('div');
  infoDiv.className = 'netflix-modal-info';

  if (imdbUrl) {
    const imdbP = document.createElement('p');
    imdbP.innerHTML = `<strong>IMDb:</strong> <a href="${imdbUrl}" target="_blank">View on IMDb</a>`;
    infoDiv.appendChild(imdbP);
  }

  if (streamingLinks && streamingLinks.length > 0) {
    const watchOnP = document.createElement('p');
    watchOnP.style.marginBottom = '0.5rem';
    watchOnP.innerHTML = '<strong>Watch On:</strong>';
    infoDiv.appendChild(watchOnP);

    const linksContainer = document.createElement('div');
    linksContainer.className = 'streaming-links';
    streamingLinks.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.textContent = link.name;
      linksContainer.appendChild(a);
    });
    infoDiv.appendChild(linksContainer);
  }

  if (infoDiv.children.length > 0) {
    body.appendChild(infoDiv);
  }

  modal.appendChild(body);
  overlay.appendChild(modal);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      closeNetflixModal();
    }
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
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
