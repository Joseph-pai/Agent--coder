/**
 * app.js — Bootstrap, model selector, panel resize (fixed), ZIP export
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
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
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
    badge.textContent = model === 'deepseek' ? '🔷 DeepSeek' : '♊ Gemini';
  }

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
    if (paths.length === 0) { Toast.show('No files to export.', 'info'); return; }

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

  // ── Panel Resize (Fixed with Pointer Events and CSS Variables) ──
  const layout = document.getElementById('appLayout');

  function initDragHandle(handleId, cssVar, minPx, maxPx, side) {
    const handle = document.getElementById(handleId);
    let dragging = false;
    let startX = 0;
    let startW = 0;

    function onPointerMove(e) {
      if (!dragging) return;
      const delta = e.clientX - startX;
      let newW = side === 'left' ? startW + delta : startW - delta;
      newW = Math.max(minPx, Math.min(newW, maxPx));
      layout.style.setProperty(cssVar, `${newW}px`);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      
      // Get current active width natively from CSS
      const computed = getComputedStyle(layout);
      const currentVal = computed.getPropertyValue(cssVar).replace('px', '').trim();
      startW = parseFloat(currentVal) || (side === 'left' ? 260 : 380);
      
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
  }

  initDragHandle('dragLeft',  '--panel-left-w',  140, 600, 'left');
  initDragHandle('dragRight', '--panel-right-w', 200, 800, 'right');

  // ── Keyboard Shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      Settings.open();
    }
  });

  // ── Welcome hint if no API key ─────────────────────────────
  const hasKey = localStorage.getItem('ag_deepseek_key') || localStorage.getItem('ag_gemini_key');
  if (!hasKey) {
    setTimeout(() => {
      Toast.show('Welcome! Open Settings (⚙️) to add your API key.', 'info', 6000);
    }, 800);
  }
});
