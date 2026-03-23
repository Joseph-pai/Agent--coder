/**
 * github.js — Push files to GitHub via REST API
 */

const Github = (() => {

  async function getFileSHA(token, repo, path, branch) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
        { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.sha;
      }
    } catch { /* file doesn't exist yet */ }
    return null;
  }

  async function pushFile(token, repo, branch, filePath, content, message) {
    const sha = await getFileSHA(token, repo, filePath, branch);
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // base64 encode UTF-8
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub error for "${filePath}": ${err.message || res.statusText}`);
    }
  }

  async function push() {
    const token   = localStorage.getItem('ag_github_token') || '';
    const repo    = localStorage.getItem('ag_github_repo') || '';
    const branch  = localStorage.getItem('ag_github_branch') || 'main';
    const message = localStorage.getItem('ag_github_message') || 'feat: AI Agent generated files';

    if (!token) { Toast.show('GitHub token not set. Open Settings.', 'error'); return; }
    if (!repo)  { Toast.show('GitHub repo not set. Open Settings.', 'error'); return; }

    const files = FileTree.getAll();
    const paths = Object.keys(files);
    if (paths.length === 0) { Toast.show('No files to push.', 'info'); return; }

    // Show progress modal
    const modal = document.getElementById('progressModal');
    const bar   = document.getElementById('progressBar');
    const label = document.getElementById('progressLabel');
    modal.style.display = 'flex';
    bar.style.width = '0%';

    let done = 0;
    const errors = [];

    for (const filePath of paths) {
      label.textContent = `Pushing ${filePath}…`;
      try {
        await pushFile(token, repo, branch, filePath, files[filePath].content, message);
      } catch (e) {
        errors.push(e.message);
      }
      done++;
      bar.style.width = `${Math.round((done / paths.length) * 100)}%`;
    }

    // Hide modal after short delay
    await new Promise(r => setTimeout(r, 600));
    modal.style.display = 'none';

    if (errors.length === 0) {
      Toast.show(`✅ Pushed ${paths.length} file(s) to ${repo}`, 'success');
    } else {
      Toast.show(`⚠️ Pushed with ${errors.length} error(s). Check console.`, 'error');
      errors.forEach(e => console.error('[GitHub Push]', e));
    }
  }

  function init() {
    document.getElementById('pushGithubBtn').addEventListener('click', push);
  }

  return { init, push };
})();
