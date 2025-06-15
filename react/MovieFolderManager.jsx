import React, { useState } from 'react';

// Sample folders structure
const initialFolders = [
  { id: 1, name: 'Comedy', parentId: null },
  { id: 2, name: 'Good', parentId: null },
  { id: 3, name: 'Crier', parentId: 2 },
  { id: 4, name: 'Classic', parentId: 2 },
];

function buildTree(folders, parentId = null) {
  return folders
    .filter(f => f.parentId === parentId)
    .map(f => ({ ...f, children: buildTree(folders, f.id) }));
}

function MovieFolderManager() {
  const [folders, setFolders] = useState(initialFolders);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [movingId, setMovingId] = useState(null);
  const [moveParent, setMoveParent] = useState(null);

  const folderMap = Object.fromEntries(folders.map(f => [f.id, f]));

  const eligibleParents = (id) => {
    const exclude = new Set([id]);
    const stack = [id];
    // Exclude children to prevent circular nesting
    while (stack.length) {
      const current = stack.pop();
      folders.forEach(f => {
        if (f.parentId === current && !exclude.has(f.id)) {
          exclude.add(f.id);
          stack.push(f.id);
        }
      });
    }
    return folders.filter(f => !exclude.has(f.id));
  };

  const startRename = (folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const saveRename = (id) => {
    setFolders(fs => fs.map(f => f.id === id ? { ...f, name: editName } : f));
    setEditingId(null);
  };

  const startMove = (folder) => {
    setMovingId(folder.id);
    setMoveParent(folder.parentId || null);
  };

  const confirmMove = () => {
    setFolders(fs => fs.map(f => f.id === movingId ? { ...f, parentId: moveParent } : f));
    setMovingId(null);
  };

  const renderTree = (nodes) => (
    <ul style={{ listStyle: 'none', paddingLeft: '1rem' }}>
      {nodes.map(node => (
        <li key={node.id} style={{ marginBottom: '0.5rem' }}>
          {editingId === node.id ? (
            <span>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveRename(node.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
              />
              <button onClick={() => saveRename(node.id)}>Save</button>
              <button onClick={() => setEditingId(null)}>Cancel</button>
            </span>
          ) : (
            <span>
              {node.name}{' '}
              <button onClick={() => startRename(node)}>Rename</button>{' '}
              <button onClick={() => startMove(node)}>Move</button>
            </span>
          )}
          {node.children && node.children.length > 0 && renderTree(node.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <h3>Movie Folders</h3>
      {renderTree(buildTree(folders))}
      {movingId && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Move Folder</h4>
          <select value={moveParent || ''} onChange={e => setMoveParent(e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {eligibleParents(movingId).map(f => (
              <option key={f.id} value={f.id}>{folderMap[f.id].name}</option>
            ))}
          </select>
          <button onClick={confirmMove}>Confirm</button>
          <button onClick={() => setMovingId(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default MovieFolderManager;
