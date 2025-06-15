import React, { useState, useEffect } from 'react';

/**
 * BookmarkFolderSelector renders a popup tree view of folders so the user can
 * pick multiple watchlists at once. Only top level folders are shown at first
 * and each folder can be expanded to reveal subfolders.
 *
 * Props:
 * - folders: array of { id, name, children: [] }
 * - initialSelected: array of folder ids already containing the item
 * - onSave: callback(ids) invoked when the Save button is pressed
 * - onClose: callback invoked when the popup is closed without saving
 */
function BookmarkFolderSelector({ folders = [], initialSelected = [], onSave, onClose }) {
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState(new Set());

  // keep selected folders in sync with prop
  useEffect(() => {
    setSelected(new Set(initialSelected));
  }, [initialSelected]);

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
      }
      return copy;
    });
  };

  const handleSave = () => {
    if (onSave) onSave(Array.from(selected));
    if (onClose) onClose();
  };

  const renderFolders = (items, depth = 0) => (
    <ul style={{ listStyle: 'none', paddingLeft: depth ? '1rem' : 0 }}>
      {items.map((f) => (
        <li key={f.id}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
            {Array.isArray(f.children) && f.children.length > 0 && (
              <button
                type="button"
                onClick={() => toggleExpanded(f.id)}
                aria-label="Toggle Subfolders"
                style={{ marginRight: '0.25rem', width: '1rem' }}
              >
                {expanded[f.id] ? '▾' : '▸'}
              </button>
            )}
            <input
              type="checkbox"
              checked={selected.has(f.id)}
              onChange={() => toggleSelected(f.id)}
              style={{ marginRight: '0.5rem' }}
            />
            <span>{f.name}</span>
          </div>
          {Array.isArray(f.children) && f.children.length > 0 && expanded[f.id] &&
            renderFolders(f.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className="bookmark-popup-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="bookmark-popup"
        style={{
          background: '#141414',
          color: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          width: '300px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginBottom: '0.5rem' }}>Add to Watchlists</h3>
        {renderFolders(folders)}
        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
          <button onClick={onClose} style={{ marginRight: '0.5rem' }}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default BookmarkFolderSelector;
