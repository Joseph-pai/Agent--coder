/**
 * app.js — Bootstrap, state management, panel resize, ZIP export
 */

// ── Toast Utility (global) ────────────────────────────────────
window.Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
};

// ── App Bootstrap ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Init all modules
  Settings.init();
  await FileTree.init();
  Editor.init();
  Github.init();
  Chat.init();

  // ── Model Selector ─────────────────────────────────────────
  const modelSelect = document.getElementById('modelSelect');

  function applyModel(model) {
    localStorage.setItem('ag_active_model', model);
    Chat.setModel(model);

    const badge = document.getElementById('modelBadge');
    if (model === 'deepseek') {
      badge.textContent = '🔷 DeepSeek';
    } else {
      badge.textContent = '♊ Gemini';
    }
  }

  // Restore saved model
  const savedModel = localStorage.getItem('ag_active_model') || 'deepseek';
  modelSelect.value = savedModel;
  applyModel(savedModel);

  modelSelect.addEventListener('change', () => {
    applyModel(modelSelect.value);
    Toast.show(`Switched to ${modelSelect.value === 'deepseek' ? 'DeepSeek' : 'Gemini'}`, 'info');
  });

  // ── Export ZIP ────────────────────────────────────────────
  document.getElementById('exportZipBtn').addEventListener('click', async () => {
    if (!window.JSZip) {
      Toast.show('JSZip not loaded. Check your internet connection.', 'error');
      return;
    }
    const files = FileTree.getAll();
    const paths = Object.keys(files);
    if (paths.length === 0) {
      Toast.show('No files to export.', 'info');
      return;
    }

    const zip = new JSZip();
    paths.forEach(p => zip.file(p, files[p].content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-agent-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    Toast.show(`Exported ${paths.length} file(s) as ZIP`, 'success');
  });

  // ── Panel Resize (drag handles) ───────────────────────────
  const layout = document.getElementById('appLayout');

  function initDragHandle(handleId, panelCssVar, minPx, maxPx, side) {
    const handle = document.getElementById(handleId);
    let dragging = false;
    let startX, startVal;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      const style = getComputedStyle(layout);
      const columns = style.gridTemplateColumns.split(' ');
      // Left panel = index 0, right panel = index 4
      startVal = parseFloat(side === 'left' ? columns[0] : columns[4]);
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      let newVal = side === 'left' ? startVal + delta : startVal - delta;
      newVal = Math.max(minPx, Math.min(maxPx, newVal));

      const cols = getComputedStyle(layout).gridTemplateColumns.split(' ');
      if (side === 'left') {
        cols[0] = `${newVal}px`;
      } else {
        cols[4] = `${newVal}px`;
      }
      layout.style.gridTemplateColumns = cols.join(' ');
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  initDragHandle('dragLeft',  '--panel-left-w',  140, 480, 'left');
  initDragHandle('dragRight', '--panel-right-w', 280, 600, 'right');

  // ── Keyboard Shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + , → Settings
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      Settings.open();
    }
  });

  // ── Prompt if no API key configured ───────────────────────
  const hasKey = localStorage.getItem('ag_deepseek_key') || localStorage.getItem('ag_gemini_key');
  if (!hasKey) {
    // Small delay so UI is painted first
    setTimeout(() => {
      Toast.show('Welcome! Open Settings (⚙️) to add your API key.', 'info', 6000);
    }, 800);
  }
});
