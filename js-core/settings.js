/**
 * settings.js — Settings modal (API keys only, GitHub moved to per-push dialog)
 */

const Settings = (() => {
  const KEYS = {
    deepseek_key:   'ag_deepseek_key',
    gemini_key:     'ag_gemini_key',
    deepseek_model: 'ag_deepseek_model',
    gemini_model:   'ag_gemini_model',
    active_model:   'ag_active_model',
  };

  function get(key) { return localStorage.getItem(KEYS[key]) || ''; }
  function set(key, val) { localStorage.setItem(KEYS[key], val); }

  function load() {
    document.getElementById('deepseekKeyInput').value   = get('deepseek_key');
    document.getElementById('geminiKeyInput').value     = get('gemini_key');
    document.getElementById('deepseekModelInput').value = get('deepseek_model') || 'deepseek-chat';
    document.getElementById('geminiModelInput').value   = get('gemini_model')   || 'gemini-2.0-flash';
  }

  function save() {
    set('deepseek_key',   document.getElementById('deepseekKeyInput').value.trim());
    set('gemini_key',     document.getElementById('geminiKeyInput').value.trim());
    set('deepseek_model', document.getElementById('deepseekModelInput').value);
    set('gemini_model',   document.getElementById('geminiModelInput').value);
  }

  function open() {
    load();
    document.getElementById('settingsModal').style.display = 'flex';
  }

  function close() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  function init() {
    document.getElementById('settingsBtn').addEventListener('click', open);
    document.getElementById('closeSettingsBtn').addEventListener('click', close);
    document.getElementById('cancelSettingsBtn').addEventListener('click', close);
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      save();
      close();
      Toast.show('Settings saved', 'success');
    });

    // Show/hide password fields
    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  }

  return { init, get, set, open };
})();
