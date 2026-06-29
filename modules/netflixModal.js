// modules/netflixModal.js
// Lightweight Netflix-style modal used by the app.
// Exports `openNetflixModal`, `openWatchlistModal` and also sets window.openNetflixModal / window.openWatchlistModal so callers that don't import the module still work.

function createElementFromHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

const DEFAULT_OPTIONS = {
  imageSrc: '',
  title: '',
  tags: [],
  description: '',
  rating: null,
  imdbUrl: '',
  streamingLinks: [],
  recommendations: [],
  series: [],
  onItemSelect: null,
  onBack: null,
  onClose: null
};

let activeModal = null;
let previousActiveElement = null;

const handleKeyDown = event => {
  if (!activeModal) return;
  // Close on Escape
  if (event.key === 'Escape') {
    closeNetflixModal();
    return;
  }
  // Basic focus trap: Tab
  if (event.key === 'Tab') {
    const focusable = activeModal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }
};

function closeNetflixModal() {
  if (!activeModal) return;
  document.removeEventListener('keydown', handleKeyDown);
  activeModal.remove();
  activeModal = null;
  if (previousActiveElement && previousActiveElement.focus) previousActiveElement.focus();
}

export function openNetflixModal(userOptions = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, userOptions);

  // If a modal is already open, close it first
  if (activeModal) closeNetflixModal();

  previousActiveElement = document.activeElement;

  const html = `
    <div class="item-detail-modal" role="dialog" aria-modal="true" aria-label="Item details" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);">
      <div class="item-detail-modal-content" style="max-width:900px;width:95%;background:var(--bg-color,#0b0b0b);color:var(--text-primary,#fff);border-radius:8px;overflow:auto;max-height:90vh;padding:1rem;">
        <button class="close-button" aria-label="Close" style="background:transparent;border:none;color:inherit;font-size:1.25rem;position:absolute;right:1rem;top:1rem;cursor:pointer;"><i class="fas fa-times"></i></button>
        <div style="display:flex;gap:1rem;align-items:flex-start;">
          <div style="flex:0 0 260px;">
            <img src="${opts.imageSrc || ''}" alt="${(opts.title || '').replace(/\"/g, '&quot;')} poster" style="width:100%;border-radius:6px;object-fit:cover;"/>
          </div>
          <div style="flex:1;">
            <h2 style="margin:0 0 0.5rem 0;">${opts.title || ''}</h2>
            <div style="margin-bottom:0.5rem;opacity:0.9;">
              ${(opts.tags || []).map(t => `<span style="margin-right:0.5rem;padding:0.2rem 0.45rem;border-radius:3px;background:rgba(255,255,255,0.04);font-size:0.875rem;">${t}</span>`).join('')}
            </div>
            <p style="margin-top:0.5rem;margin-bottom:0.5rem;line-height:1.4;">${opts.description || ''}</p>
            ${opts.rating ? `<div style="margin:0.5rem 0;">Rating: <strong>${opts.rating}</strong></div>` : ''}
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem;">
              ${opts.streamingLinks && opts.streamingLinks.length ? opts.streamingLinks.map(link => `
                <a class="watch-now-link" href="${link.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                  <button class="accent-button" style="cursor:pointer;">Watch: ${link.name}</button>
                </a>`).join('') : `<button disabled style="opacity:0.6;">No streaming links</button>`}
              ${opts.imdbUrl ? `<a href="${opts.imdbUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><button class="accent-button">IMDB</button></a>` : ''}
            </div>

            ${opts.series && opts.series.length ? `
              <div style="margin-top:1rem;">
                <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Series / Seasons</h3>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                  ${opts.series.map(s => `<button class="series-item" data-id="${s.id}" style="cursor:pointer;padding:0.4rem 0.6rem;border-radius:4px;background:rgba(255,255,255,0.03);">${s.title || s.name}</button>`).join('')}
                </div>
              </div>
            ` : ''}

            ${opts.recommendations && opts.recommendations.length ? `
              <div style="margin-top:1rem;">
                <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Recommendations</h3>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                  ${opts.recommendations.map(r => `<button class="recommendation-item" data-id="${r.id}" data-type="${r.media_type || 'movie'}" style="cursor:pointer;padding:0.3rem 0.5rem;border-radius:4px;background:rgba(255,255,255,0.03);">${r.title || r.name}</button>`).join('')}
                </div>
              </div>
            ` : ''}

          </div>
        </div>
      </div>
    </div>
  `;

  const node = createElementFromHTML(html);
  document.body.appendChild(node);
  activeModal = node;

  // Wire up close
  const closeBtn = node.querySelector('.close-button');
  if (closeBtn) closeBtn.addEventListener('click', () => { closeNetflixModal(); if (typeof opts.onClose === 'function') opts.onClose(); });

  // Series item clicks
  node.querySelectorAll('.series-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (typeof opts.onItemSelect === 'function') opts.onItemSelect(parseInt(id, 10), 'tv');
    });
  });

  // Recommendation clicks
  node.querySelectorAll('.recommendation-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type') || 'movie';
      if (typeof opts.onItemSelect === 'function') opts.onItemSelect(parseInt(id, 10), type);
    });
  });

  // Back handler (if provided, render a back button)
  if (typeof opts.onBack === 'function') {
    const content = node.querySelector('.item-detail-modal-content');
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back';
    backBtn.style.marginRight = '0.5rem';
    backBtn.className = 'accent-button';
    backBtn.addEventListener('click', opts.onBack);
    content.insertBefore(backBtn, content.firstChild);
  }

  // Add key handler and focus trap
  document.addEventListener('keydown', handleKeyDown);

  // Focus first focusable element
  setTimeout(() => {
    const focusable = node.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }, 50);

  // Expose a close function on the returned object
  const ret = {
    close: () => {
      closeNetflixModal();
      if (typeof opts.onClose === 'function') opts.onClose();
    }
  };

  return ret;
}

// Open a lightweight watchlist selection modal used when the bookmark icon is clicked.
export async function openWatchlistModal(item = {}) {
  // item: { id, media_type, title, poster_path }
  // If a modal is already open, close it first
  if (activeModal) closeNetflixModal();
  previousActiveElement = document.activeElement;

  const html = `
    <div class="item-detail-modal" role="dialog" aria-modal="true" aria-label="Add to Watchlist" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);">
      <div class="item-detail-modal-content" style="max-width:520px;width:95%;background:var(--bg-color,#0b0b0b);color:var(--text-primary,#fff);border-radius:8px;overflow:auto;max-height:80vh;padding:1rem;">
        <button class="close-button" aria-label="Close" style="background:transparent;border:none;color:inherit;font-size:1.25rem;position:absolute;right:1rem;top:1rem;cursor:pointer;"><i class="fas fa-times"></i></button>
        <h2 style="margin:0 0 0.75rem 0;">Add "${(item.title||item.name||'item').replace(/\"/g,'&quot;')}" to Watchlists</h2>
        <div id="watchlist-modal-body" style="display:flex;flex-direction:column;gap:0.5rem;">
          <p style="margin:0 0 0.5rem 0;color:var(--text-secondary);">Select one or more watchlists to add this item to. Click a selected watchlist to remove it.</p>
          <div id="watchlist-list" style="display:flex;flex-direction:column;gap:0.25rem;max-height:50vh;overflow:auto;padding-right:0.5rem;"></div>
          <div style="margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:flex-end;">
            <button id="create-new-watchlist" class="accent-button">+ New Watchlist</button>
            <button id="close-watchlist-modal" class="accent-button">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const node = createElementFromHTML(html);
  document.body.appendChild(node);
  activeModal = node;

  const closeBtn = node.querySelector('.close-button');
  const closeFooterBtn = node.querySelector('#close-watchlist-modal');
  const createBtn = node.querySelector('#create-new-watchlist');
  const listContainer = node.querySelector('#watchlist-list');

  function wireUpList(watchlists) {
    listContainer.innerHTML = '';
    if (!watchlists || watchlists.length === 0) {
      listContainer.innerHTML = '<p style="color:var(--text-secondary);">No watchlists yet. Create one to get started.</p>';
      return;
    }

    watchlists.forEach(wl => {
      const itemEl = document.createElement('div');
      itemEl.className = 'watchlist-item';
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.padding = '0.4rem 0.5rem';
      itemEl.style.borderRadius = '6px';
      itemEl.style.cursor = 'pointer';
      itemEl.style.background = 'rgba(255,255,255,0.02)';
      itemEl.dataset.folderId = wl.id;

      const label = document.createElement('div');
      label.textContent = wl.name || '(unnamed)';
      label.style.flex = '1';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = Array.isArray(wl.items) && wl.items.some(i => String(i.tmdb_id) === String(item.id) && i.item_type === item.media_type);

      itemEl.appendChild(label);
      itemEl.appendChild(chk);

      itemEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Toggle
        try {
          const module = await import('./libraryManager.js');
          await module.addRemoveItemToFolder(wl.id, { id: item.id, title: item.title || item.name, poster_path: item.poster_path }, item.media_type);
          // Update checkbox state visually
          chk.checked = !chk.checked;
        } catch (err) {
          console.error('Error updating watchlist membership:', err);
        }
      });

      listContainer.appendChild(itemEl);
    });
  }

  // Load watchlists cache and render
  (async () => {
    try {
      const module = await import('./libraryManager.js');
      const watchlists = module.getWatchlistsCache();
      wireUpList(watchlists);
    } catch (err) {
      console.error('Failed to load watchlists:', err);
      listContainer.innerHTML = '<p style="color:red;">Failed to load watchlists.</p>';
    }
  })();

  createBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = prompt('New watchlist name');
    if (!name) return;
    try {
      const module = await import('./libraryManager.js');
      await module.createLibraryFolder(name);
      const watchlists = module.getWatchlistsCache();
      wireUpList(watchlists);
    } catch (err) {
      console.error('Error creating watchlist:', err);
    }
  });

  const doClose = () => {
    closeNetflixModal();
  };

  if (closeBtn) closeBtn.addEventListener('click', doClose);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', doClose);

  document.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    const focusable = node.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }, 50);

  return {
    close: doClose
  };
}

// Make available globally for scripts that call it without import
if (typeof window !== 'undefined') {
  window.openNetflixModal = openNetflixModal;
  window.openWatchlistModal = openWatchlistModal;
}

export default {
  openNetflixModal,
  closeNetflixModal,
  openWatchlistModal
};
