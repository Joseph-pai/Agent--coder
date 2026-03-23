/**
 * settings.js — Settings modal and localStorage API key management
 */

const Settings = (() => {
  const KEYS = {
    deepseek_key:     'ag_deepseek_key',
    gemini_key:       'ag_gemini_key',
    github_token:     'ag_github_token',
    github_repo:      'ag_github_repo',
    github_branch:    'ag_github_branch',
    github_message:   'ag_github_message',
    deepseek_model:   'ag_deepseek_model',
    gemini_model:     'ag_gemini_model',
    active_model:     'ag_active_model',
  };

  function get(key) { return localStorage.getItem(KEYS[key]) || ''; }
  function set(key, val) { localStorage.setItem(KEYS[key], val); }

  function load() {
    document.getElementById('deepseekKeyInput').value  = get('deepseek_key');
    document.getElementById('geminiKeyInput').value    = get('gemini_key');
    document.getElementById('githubTokenInput').value  = get('github_token');
    document.getElementById('githubRepoInput').value   = get('github_repo');
    document.getElementById('githubBranchInput').value = get('github_branch') || 'main';
    document.getElementById('githubMessageInput').value= get('github_message') || 'feat: AI Agent generated files';
    document.getElementById('deepseekModelInput').value= get('deepseek_model') || 'deepseek-chat';
    document.getElementById('geminiModelInput').value  = get('gemini_model') || 'gemini-2.0-flash';
  }

  function save() {
    set('deepseek_key',   document.getElementById('deepseekKeyInput').value.trim());
    set('gemini_key',     document.getElementById('geminiKeyInput').value.trim());
    set('github_token',   document.getElementById('githubTokenInput').value.trim());
    set('github_repo',    document.getElementById('githubRepoInput').value.trim());
    set('github_branch',  document.getElementById('githubBranchInput').value.trim() || 'main');
    set('github_message', document.getElementById('githubMessageInput').value.trim() || 'feat: AI Agent generated files');
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
    // Open / close
    document.getElementById('settingsBtn').addEventListener('click', open);
    document.getElementById('closeSettingsBtn').addEventListener('click', close);
    document.getElementById('cancelSettingsBtn').addEventListener('click', close);
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    // Save
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      save();
      close();
      Toast.show('Settings saved', 'success');
    });

    // Eye (show/hide password) buttons
    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  }

  return { init, get, set, open };
})();
