/**
 * editor.js — Center panel code/markdown viewer
 */

const Editor = (() => {
  let _currentPath = null;

  function showWelcome() {
    const content = document.getElementById('editorContent');
    const title = document.getElementById('editorTitle');
    const badge = document.getElementById('langBadge');
    const copyBtn = document.getElementById('copyFileBtn');

    title.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
      Code Viewer
    `;
    badge.style.display = 'none';
    copyBtn.style.display = 'none';
    _currentPath = null;

    content.innerHTML = `
      <div class="editor-welcome">
        <div class="welcome-icon">⚡</div>
        <h2>AI Agent Studio</h2>
        <p>Select a file from the left panel to view its content,<br/>or start a conversation with AI in the right panel.</p>
        <div class="welcome-features">
          <div class="feature-chip">🔷 DeepSeek</div>
          <div class="feature-chip">♊ Gemini</div>
          <div class="feature-chip">📂 IndexedDB</div>
          <div class="feature-chip">🐙 GitHub Push</div>
        </div>
      </div>
    `;
  }

  function show({ filePath, content, lang }) {
    _currentPath = filePath;
    const contentEl = document.getElementById('editorContent');
    const title = document.getElementById('editorTitle');
    const badge = document.getElementById('langBadge');
    const copyBtn = document.getElementById('copyFileBtn');

    // Update header
    const name = filePath.split('/').pop();
    title.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
      ${escapeHtml(filePath)}
    `;
    badge.textContent = lang || 'plaintext';
    badge.style.display = 'inline-block';
    copyBtn.style.display = 'flex';

    if (lang === 'markdown') {
      // Render markdown
      contentEl.innerHTML = `<div class="editor-markdown">${window.marked ? marked.parse(content) : escapeHtml(content)}</div>`;
    } else {
      // Syntax highlighted code
      let highlighted;
      try {
        if (window.hljs && lang && lang !== 'plaintext') {
          highlighted = hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
        } else {
          highlighted = escapeHtml(content);
        }
      } catch {
        highlighted = escapeHtml(content);
      }
      contentEl.innerHTML = `
        <div class="editor-code-wrap">
          <pre><code class="hljs language-${lang || ''}">${highlighted}</code></pre>
        </div>
      `;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function init() {
    // Copy button
    document.getElementById('copyFileBtn').addEventListener('click', async () => {
      const pre = document.querySelector('#editorContent pre code');
      const md = document.querySelector('#editorContent .editor-markdown');
      const text = pre?.textContent || md?.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        Toast.show('Copied to clipboard', 'success');
      } catch {
        Toast.show('Copy failed', 'error');
      }
    });

    // Listen for file selection
    document.addEventListener('file:selected', (e) => {
      show(e.detail);
    });

    document.addEventListener('file:cleared', () => {
      showWelcome();
    });
  }

  return { init, show, showWelcome };
})();
