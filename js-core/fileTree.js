/**
 * fileTree.js — Virtual file system + left panel rendering
 * Hydrates from IndexedDB on load, syncs every write back to DB.
 */

const FileTree = (() => {
  // In-memory virtual file system: { "src/app.js": { content, lang }, ... }
  let _fs = {};
  let _selectedPath = null;

  // ── Helpers ──────────────────────────────────────────────────
  function detectLang(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx',
      html: 'html', css: 'css', scss: 'scss', less: 'less',
      json: 'json', md: 'markdown', py: 'python', sh: 'bash',
      yml: 'yaml', yaml: 'yaml', toml: 'toml', env: 'plaintext',
      txt: 'plaintext', rs: 'rust', go: 'go', java: 'java',
      cpp: 'cpp', c: 'c', php: 'php', rb: 'ruby', swift: 'swift',
      kt: 'kotlin', sql: 'sql', graphql: 'graphql', xml: 'xml',
      svg: 'xml', vue: 'html', svelte: 'html',
    };
    return map[ext] || 'plaintext';
  }

  function fileIcon(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const icons = {
      js: '🟨', ts: '🔷', jsx: '⚛️', tsx: '⚛️',
      html: '🌐', css: '🎨', scss: '🎨', json: '📋',
      md: '📝', py: '🐍', sh: '⚙️', yml: '📄', yaml: '📄',
      toml: '📄', env: '🔒', txt: '📄', rs: '🦀', go: '🐹',
      java: '☕', cpp: '⚡', c: '⚡', php: '🐘', rb: '💎',
      swift: '🦅', kt: '🎯', sql: '🗄️', vue: '💚', svelte: '🔥',
      svg: '🖼️', png: '🖼️', jpg: '🖼️', gif: '🖼️',
    };
    return icons[ext] || '📄';
  }

  // ── Tree structure builder ────────────────────────────────────
  function buildTree(paths) {
    const tree = {};
    paths.forEach(filePath => {
      const parts = filePath.split('/');
      let node = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          node[part] = { __file: true, __path: filePath };
        } else {
          node[part] = node[part] || {};
          node = node[part];
        }
      });
    });
    return tree;
  }

  function renderTree(node, container, depth = 0) {
    const keys = Object.keys(node).sort((a, b) => {
      // Folders first, then files
      const aIsFile = node[a].__file;
      const bIsFile = node[b].__file;
      if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
      return a.localeCompare(b);
    });

    keys.forEach(key => {
      const item = node[key];
      if (item.__file) {
        const el = createFileEl(key, item.__path, depth);
        container.appendChild(el);
      } else {
        const { folderEl, childrenEl } = createFolderEl(key, depth);
        container.appendChild(folderEl);
        renderTree(item, childrenEl, depth + 1);
        container.appendChild(childrenEl);
      }
    });
  }

  function createFileEl(name, filePath, depth) {
    const el = document.createElement('div');
    el.className = 'tree-file';
    el.dataset.path = filePath;
    if (filePath === _selectedPath) el.classList.add('active');
    el.style.paddingLeft = `${12 + depth * 16}px`;

    el.innerHTML = `
      <span class="tree-icon" style="font-size:12px">${fileIcon(filePath)}</span>
      <span class="tree-label">${name}</span>
      <button class="tree-delete-btn" data-path="${filePath}" title="Delete file">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    `;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.tree-delete-btn')) return;
      selectFile(filePath);
    });

    el.querySelector('.tree-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${filePath}"?`)) return;
      await removeFile(filePath);
    });

    return el;
  }

  function createFolderEl(name, depth) {
    const folderEl = document.createElement('div');
    folderEl.className = 'tree-folder';
    folderEl.style.paddingLeft = `${12 + depth * 16}px`;

    folderEl.innerHTML = `
      <svg class="tree-icon tree-folder-toggle open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span class="tree-icon" style="font-size:12px">📁</span>
      <span class="tree-label">${name}</span>
    `;

    const childrenEl = document.createElement('div');
    childrenEl.className = 'tree-children';

    const toggle = folderEl.querySelector('.tree-folder-toggle');
    folderEl.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('open');
      childrenEl.style.display = isOpen ? '' : 'none';
    });

    return { folderEl, childrenEl };
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('fileTree');
    const empty = document.getElementById('fileTreeEmpty');
    const paths = Object.keys(_fs);

    // Clear existing tree items (not the empty placeholder)
    Array.from(container.children).forEach(c => {
      if (c !== empty) c.remove();
    });

    if (paths.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    const tree = buildTree(paths);
    renderTree(tree, container);
  }

  // ── Public API ────────────────────────────────────────────────
  function selectFile(filePath) {
    _selectedPath = filePath;
    render();
    const entry = _fs[filePath];
    if (entry) {
      document.dispatchEvent(new CustomEvent('file:selected', {
        detail: { filePath, content: entry.content, lang: entry.lang }
      }));
    }
  }

  async function writeFile(filePath, content) {
    const lang = detectLang(filePath);
    _fs[filePath] = { content, lang };
    await DB.put(filePath, content, lang);
    render();
    // Auto-select newly written file
    selectFile(filePath);
  }

  async function removeFile(filePath) {
    delete _fs[filePath];
    await DB.remove(filePath);
    if (_selectedPath === filePath) {
      _selectedPath = null;
      document.dispatchEvent(new CustomEvent('file:cleared'));
    }
    render();
    Toast.show(`Deleted ${filePath}`, 'info');
  }

  async function clearAll() {
    if (!confirm('Delete all files? This cannot be undone.')) return;
    _fs = {};
    _selectedPath = null;
    await DB.clear();
    render();
    document.dispatchEvent(new CustomEvent('file:cleared'));
    Toast.show('All files cleared', 'info');
  }

  function getAll() { return { ..._fs }; }
  function getSelectedPath() { return _selectedPath; }

  async function init() {
    // Hydrate from IndexedDB
    try {
      const rows = await DB.getAll();
      rows.forEach(row => {
        _fs[row.filePath] = { content: row.content, lang: row.lang };
      });
      render();
    } catch (e) {
      console.warn('FileTree: DB hydration failed', e);
    }

    // New Folder button
    document.getElementById('newFolderBtn').addEventListener('click', () => {
      const folderName = prompt('Folder name:');
      if (!folderName) return;
      const fileName = prompt('Initial file name (inside folder):');
      if (!fileName) return;
      writeFile(`${folderName.trim()}/${fileName.trim()}`, '');
    });

    // New File button
    document.getElementById('newFileBtn').addEventListener('click', () => {
      const filePath = prompt('File path (e.g. src/app.js):');
      if (!filePath) return;
      writeFile(filePath.trim(), '');
    });

    // Clear button
    document.getElementById('clearFilesBtn').addEventListener('click', clearAll);
  }

  return { init, writeFile, removeFile, clearAll, getAll, getSelectedPath, selectFile, detectLang };
})();
