/**
 * github.js — Per-push GitHub dialog + REST API push
 * Token / repo / branch shown fresh each push, remembers last values.
 */

const Github = (() => {

  // ── Modal helpers ─────────────────────────────────────────────
  function openModal() {
    // Pre-fill from last-used values
    document.getElementById('pushTokenInput').value  = localStorage.getItem('ag_push_token')   || '';
    document.getElementById('pushRepoInput').value   = localStorage.getItem('ag_push_repo')    || '';
    document.getElementById('pushBranchInput').value = localStorage.getItem('ag_push_branch')  || 'main';
    document.getElementById('pushMessageInput').value= localStorage.getItem('ag_push_message') || 'feat: AI Agent generated files';
    document.getElementById('githubPushModal').style.display = 'flex';
    document.getElementById('pushRepoInput').focus();
  }

  function closeModal() {
    document.getElementById('githubPushModal').style.display = 'none';
  }

  // ── GitHub REST helpers ───────────────────────────────────────
  async function getFileSHA(token, repo, path, branch) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
        { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' } }
      );
      if (res.ok) return (await res.json()).sha;
    } catch { /* new file */ }
    return null;
  }

  async function pushFile(token, repo, branch, filePath, content, message) {
    const sha = await getFileSHA(token, repo, filePath, branch);
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
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
      throw new Error(`"${filePath}": ${err.message || res.statusText}`);
    }
  }

  // ── Main push execution ───────────────────────────────────────
  async function push(token, repo, branch, message) {
    const files = FileTree.getAll();
    const paths = Object.keys(files);
    if (paths.length === 0) { Toast.show('No files to push.', 'info'); return; }

    const progressModal = document.getElementById('progressModal');
    const bar   = document.getElementById('progressBar');
    const label = document.getElementById('progressLabel');
    progressModal.style.display = 'flex';
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

    await new Promise(r => setTimeout(r, 500));
    progressModal.style.display = 'none';

    if (errors.length === 0) {
      Toast.show(`✅ Pushed ${paths.length} file(s) to ${repo}`, 'success');
    } else {
      Toast.show(`⚠️ ${errors.length} error(s) during push. Check console.`, 'error');
      errors.forEach(e => console.error('[GitHub Push]', e));
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    // Toolbar button
    document.getElementById('pushGithubBtn').addEventListener('click', openModal);

    // Close modal
    document.getElementById('closeGithubPushBtn').addEventListener('click', closeModal);
    document.getElementById('cancelGithubPushBtn').addEventListener('click', closeModal);
    document.getElementById('githubPushModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Show/hide token
    const eyeBtn = document.getElementById('pushTokenEyeBtn');
    if (eyeBtn) {
      eyeBtn.addEventListener('click', () => {
        const inp = document.getElementById('pushTokenInput');
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    }

    // Confirm push
    document.getElementById('confirmGithubPushBtn').addEventListener('click', async () => {
      const token   = document.getElementById('pushTokenInput').value.trim();
      const repo    = document.getElementById('pushRepoInput').value.trim();
      const branch  = document.getElementById('pushBranchInput').value.trim() || 'main';
      const message = document.getElementById('pushMessageInput').value.trim() || 'feat: AI Agent generated files';

      if (!token) { Toast.show('Please enter your GitHub token.', 'error'); return; }
      if (!repo)  { Toast.show('Please enter the repository (owner/repo).', 'error'); return; }

      // Remember for next time
      localStorage.setItem('ag_push_token',   token);
      localStorage.setItem('ag_push_repo',    repo);
      localStorage.setItem('ag_push_branch',  branch);
      localStorage.setItem('ag_push_message', message);

      closeModal();
      await push(token, repo, branch, message);
    });
  }

  // Public: allow Chat module to trigger the modal
  function triggerPushModal() { openModal(); }

  return { init, triggerPushModal };
})();
