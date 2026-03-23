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
    temperature:    'ag_temperature',
    max_tokens:     'ag_max_tokens',
  };

  function get(key) { return localStorage.getItem(KEYS[key]) || ''; }
  function set(key, val) { localStorage.setItem(KEYS[key], val); }

  function getAdvanced() {
    return {
      temperature: parseFloat(get('temperature')) || 0.7,
      max_tokens: get('max_tokens') ? parseInt(get('max_tokens')) : null
    };
  }

  function load() {
    document.getElementById('deepseekKeyInput').value   = get('deepseek_key');
    document.getElementById('geminiKeyInput').value     = get('gemini_key');
    document.getElementById('deepseekModelInput').value = get('deepseek_model') || 'deepseek-chat';
    document.getElementById('geminiModelInput').value   = get('gemini_model')   || 'gemini-2.0-flash';
    
    // Advanced
    const temp = get('temperature') || '0.7';
    document.getElementById('tempInput').value = temp;
    document.getElementById('tempValueDisplay').textContent = temp;
    document.getElementById('maxTokensInput').value = get('max_tokens') || '8192';
  }

  function save() {
    set('deepseek_key',   document.getElementById('deepseekKeyInput').value.trim());
    set('gemini_key',     document.getElementById('geminiKeyInput').value.trim());
    set('deepseek_model', document.getElementById('deepseekModelInput').value);
    set('gemini_model',   document.getElementById('geminiModelInput').value);
    
    // Advanced
    set('temperature', document.getElementById('tempInput').value);
    set('max_tokens',  document.getElementById('maxTokensInput').value.trim());
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

    // Sync Temp display
    document.getElementById('tempInput').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value).toFixed(1);
      document.getElementById('tempValueDisplay').textContent = val;
    });

    // Test Integrations
    document.getElementById('testDeepseekBtn').addEventListener('click', async () => {
      const key = document.getElementById('deepseekKeyInput').value.trim();
      if (!key) return Toast.show('Enter DeepSeek API Key first', 'error');
      Toast.show('Testing DeepSeek...', 'info');
      try {
        const res = await fetch('https://api.deepseek.com/models', { headers: { 'Authorization': `Bearer ${key}` }});
        if (res.ok) Toast.show('DeepSeek Connection Successful', 'success');
        else Toast.show(`DeepSeek Test Failed: ${res.status}`, 'error');
      } catch (e) { Toast.show('DeepSeek Network Error', 'error'); }
    });

    document.getElementById('testGeminiBtn').addEventListener('click', async () => {
      const key = document.getElementById('geminiKeyInput').value.trim();
      if (!key) return Toast.show('Enter Gemini API Key first', 'error');
      Toast.show('Testing Gemini...', 'info');
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) Toast.show('Gemini Connection Successful', 'success');
        else Toast.show(`Gemini Test Failed: ${res.status}`, 'error');
      } catch (e) { Toast.show('Gemini Network Error', 'error'); }
    });

    // Show/hide password fields
    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  }

  return { init, get, set, open, getAdvanced };
})();
