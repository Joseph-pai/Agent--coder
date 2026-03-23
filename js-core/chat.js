/**
 * chat.js — Right panel AI chat, plan/execute flow, and command detection
 *
 * Special commands (intercepted before AI):
 *   建立文件夾 / create folder / new folder  → triggers folder creation dialog
 *   建立文件   / create file   / new file    → triggers file creation dialog
 *   推送到github / push to github / git push → triggers GitHub push modal
 */

const Chat = (() => {
  let _messages  = [];
  let _model     = 'deepseek';
  let _abortCtrl = null;
  let _phase     = 'idle'; // idle | planning | confirming | executing

  // ── System Prompts ────────────────────────────────────────────
  const PLAN_SYSTEM = `You are an expert AI software agent. When the user describes a project or feature, respond with a clear, concise **Execution Plan** in Markdown. Include:
- A brief description of what you will build
- A list of files you will create with one-line descriptions
- Key implementation decisions

Do NOT include any code at this stage. End your response with exactly: \`--- PLAN COMPLETE ---\``;

  const EXECUTE_SYSTEM = `You are an expert AI software agent executing a code generation task. Generate complete, working file contents for each file in the plan.

Use this EXACT format for EVERY file (no deviations):
<FILE path="relative/path/to/file.ext">
full file content here
</FILE>

Rules:
- Output ALL files needed
- Use relative paths (no leading slash)
- Complete, production-ready code (no placeholders or TODOs)
- After all files, write: \`--- FILES COMPLETE ---\``;

  // ── Command Detection ─────────────────────────────────────────
  const COMMANDS = [
    {
      patterns: ['建立文件夾', '建立文件夹', 'create folder', 'new folder', '新建文件夾', '新建文件夹'],
      action: 'newFolder',
      label: '📁 建立文件夾',
    },
    {
      patterns: ['建立文件', 'create file', 'new file', '新建文件', '新增文件'],
      action: 'newFile',
      label: '📄 建立文件',
    },
    {
      patterns: ['推送到github', 'push to github', 'git push', '推送github', '上傳github', '上传github'],
      action: 'pushGithub',
      label: '🐙 推送到 GitHub',
    },
  ];

  function detectCommand(text) {
    const lower = text.toLowerCase().trim();
    for (const cmd of COMMANDS) {
      if (cmd.patterns.some(p => lower.includes(p.toLowerCase()))) {
        return cmd;
      }
    }
    return null;
  }

  function executeCommand(cmd) {
    appendSystemMessage(`✅ 執行指令：${cmd.label}`);
    switch (cmd.action) {
      case 'newFolder':
        setTimeout(() => document.getElementById('newFolderBtn').click(), 300);
        break;
      case 'newFile':
        setTimeout(() => document.getElementById('newFileBtn').click(), 300);
        break;
      case 'pushGithub':
        setTimeout(() => Github.triggerPushModal(), 300);
        break;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderMarkdown(text) {
    return window.marked ? marked.parse(text) : `<p>${escapeHtml(text).replace(/\n/g,'<br/>')}</p>`;
  }

  function getModelTag() {
    return `<span class="model-tag ${_model}">${_model === 'deepseek' ? '🔷 DeepSeek' : '♊ Gemini'}</span>`;
  }

  function scrollToBottom() {
    const h = document.getElementById('chatHistory');
    h.scrollTop = h.scrollHeight;
  }

  // ── Message Rendering ─────────────────────────────────────────
  function appendUserMessage(text) {
    const history = document.getElementById('chatHistory');
    const welcome = history.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const el = document.createElement('div');
    el.className = 'message user';
    el.innerHTML = `
      <div class="message-header">
        <div class="message-avatar user">U</div>
        <span>You</span>
      </div>
      <div class="message-body">${escapeHtml(text).replace(/\n/g,'<br/>')}</div>
    `;
    history.appendChild(el);
    scrollToBottom();
  }

  function appendSystemMessage(text) {
    const history = document.getElementById('chatHistory');
    const el = document.createElement('div');
    el.className = 'message ai';
    el.innerHTML = `
      <div class="message-header">
        <div class="message-avatar ai">AI</div>
        <span>System</span>
      </div>
      <div class="message-body" style="color:var(--accent-cyan);">${escapeHtml(text)}</div>
    `;
    history.appendChild(el);
    scrollToBottom();
  }

  function createAiMessageEl() {
    const history = document.getElementById('chatHistory');
    const el = document.createElement('div');
    el.className = 'message ai';
    el.innerHTML = `
      <div class="message-header">
        <div class="message-avatar ai">AI</div>
        <span>Assistant</span>
        ${getModelTag()}
      </div>
      <div class="message-body">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    history.appendChild(el);
    scrollToBottom();
    return el.querySelector('.message-body');
  }

  // ── File Parsing ──────────────────────────────────────────────
  function parseFiles(text) {
    const files = [];
    const regex = /<FILE\s+path="([^"]+)">([\s\S]*?)<\/FILE>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      files.push({ path: match[1].trim(), content: match[2].replace(/^\n/, '') });
    }
    return files;
  }

  // ── Workspace Context ─────────────────────────────────────────
  function buildWorkspaceContext() {
    const files = FileTree.getAll();
    const paths = Object.keys(files);
    if (paths.length === 0) return '';
    
    let ctx = '\n\n=== CURRENT WORKSPACE FILES ===\n';
    ctx += '(You already have these files. Only generate files you need to modify or create.)\n';
    paths.forEach(p => {
      ctx += `\n--- ${p} ---\n${files[p].content}\n`;
    });
    ctx += '\n===============================\n';
    return ctx;
  }

  // ── Phase 1: Plan ─────────────────────────────────────────────
  async function runPlan(userText, systemOverride) {
    _phase = 'planning';
    setUIState('generating');

    // Persist conversation history
    _messages.push({ role: 'user', content: userText });

    // Dynamically build payload with the Plan System Prompt + Workspace
    const baseSystem = systemOverride || PLAN_SYSTEM;
    const systemContent = baseSystem + buildWorkspaceContext();
    
    const payload = [
      { role: 'system', content: systemContent },
      ..._messages
    ];

    const bodyEl = createAiMessageEl();
    let fullText = '';
    _abortCtrl = new AbortController();

    try {
      for await (const delta of API.stream(_model, payload, _abortCtrl.signal)) {
        fullText += delta;
        bodyEl.innerHTML = renderMarkdown(fullText);
        scrollToBottom();
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        bodyEl.innerHTML += '<br/><em style="color:var(--text-muted)">Stopped.</em>';
      } else {
        bodyEl.innerHTML = `<span style="color:var(--danger)">Error: ${escapeHtml(e.message)}</span>`;
        Toast.show(e.message, 'error');
        _phase = 'idle';
        setUIState('idle');
        return;
      }
    }

    _messages.push({ role: 'assistant', content: fullText });

    if (fullText.length > 30) {
      _phase = 'confirming';
      showPlanArea(fullText.replace('--- PLAN COMPLETE ---', '').trim());
      setUIState('confirming');
    } else {
      _phase = 'idle';
      setUIState('idle');
    }
  }

  // ── Phase 2: Execute ──────────────────────────────────────────
  async function runExecute() {
    _phase = 'executing';
    setUIState('generating');

    _messages.push({ role: 'user', content: 'Please now generate all the files based on the plan above.' });

    // Dynamically build payload with the Execute System Prompt + Workspace
    const systemContent = EXECUTE_SYSTEM + buildWorkspaceContext();
    const payload = [
      { role: 'system', content: systemContent },
      ..._messages
    ];

    const bodyEl = createAiMessageEl();
    let fullText = '';
    _abortCtrl = new AbortController();

    try {
      for await (const delta of API.stream(_model, payload, _abortCtrl.signal)) {
        fullText += delta;
        const preview = fullText
          .replace(/<FILE path="([^"]+)">([\s\S]*?)<\/FILE>/g, (_, p) =>
            `\n<div class="file-generating"><div class="file-generating-dot"></div> Generating: <code>${p}</code></div>`)
          .replace(/--- FILES COMPLETE ---/, '');
        bodyEl.innerHTML = renderMarkdown(preview);
        scrollToBottom();
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        bodyEl.innerHTML += '<br/><em style="color:var(--text-muted)">Stopped.</em>';
      } else {
        bodyEl.innerHTML = `<span style="color:var(--danger)">Error: ${escapeHtml(e.message)}</span>`;
        Toast.show(e.message, 'error');
      }
      _phase = 'idle';
      setUIState('idle');
      return;
    }

    const files = parseFiles(fullText);
    if (files.length === 0) {
      bodyEl.innerHTML = renderMarkdown(fullText);
    } else {
      let summary = `<p><strong>✅ Generated ${files.length} file(s):</strong></p><ul>`;
      for (const file of files) {
        await FileTree.writeFile(file.path, file.content);
        summary += `<li><code>${escapeHtml(file.path)}</code></li>`;
        await new Promise(r => setTimeout(r, 80));
      }
      summary += '</ul>';
      bodyEl.innerHTML = summary;
      Toast.show(`${files.length} file(s) created`, 'success');
    }

    _messages.push({ role: 'assistant', content: fullText });
    _phase = 'idle';
    hidePlanArea();
    setUIState('idle');
    scrollToBottom();
  }

  // ── Plan Area ─────────────────────────────────────────────────
  function showPlanArea(planText) {
    const area = document.getElementById('planArea');
    area.style.display = 'flex';
    document.getElementById('planContent').innerHTML = renderMarkdown(planText);
  }

  function hidePlanArea() {
    document.getElementById('planArea').style.display = 'none';
    document.getElementById('planContent').innerHTML = '';
  }

  // ── UI State ──────────────────────────────────────────────────
  function setUIState(state) {
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');
    const input   = document.getElementById('chatInput');
    sendBtn.style.display = state === 'generating' ? 'none' : 'flex';
    stopBtn.style.display = state === 'generating' ? 'flex' : 'none';
    input.disabled = state === 'generating';
  }

  // ── Send ──────────────────────────────────────────────────────
  async function send() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text || _phase === 'generating') return;

    input.value = '';
    input.style.height = 'auto';

    // ── Command interception ──────────────────────────────────
    const cmd = detectCommand(text);
    if (cmd) {
      appendUserMessage(text);
      executeCommand(cmd);
      return;
    }

    // ── Normal AI flow ────────────────────────────────────────
    const sysOverride = document.getElementById('systemPrompt').value.trim();
    appendUserMessage(text);
    hidePlanArea();
    await runPlan(text, sysOverride || null);
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.getElementById('sendBtn').addEventListener('click', send);

    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (_phase === 'idle') send();
      }
    });

    document.getElementById('chatInput').addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    });

    document.getElementById('stopBtn').addEventListener('click', () => {
      if (_abortCtrl) _abortCtrl.abort();
      _phase = 'idle';
      setUIState('idle');
      hidePlanArea();
    });

    document.getElementById('confirmPlanBtn').addEventListener('click', () => {
      if (_phase === 'confirming') runExecute();
    });

    document.getElementById('rejectPlanBtn').addEventListener('click', () => {
      hidePlanArea();
      _phase = 'idle';
      setUIState('idle');
      Toast.show('Plan cancelled', 'info');
    });

    document.getElementById('clearChatBtn').addEventListener('click', () => {
      _messages = [];
      _phase = 'idle';
      hidePlanArea();
      setUIState('idle');
      document.getElementById('chatHistory').innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🤖</div>
          <p>Describe what you want to build and AI will create an execution plan, then generate the files for you.</p>
          <div class="command-hints">
            <span class="cmd-hint">📁 建立文件夾</span>
            <span class="cmd-hint">📄 建立文件</span>
            <span class="cmd-hint">🐙 推送到GitHub</span>
          </div>
        </div>
      `;
    });

    const toggleBtn = document.getElementById('toggleSystemPrompt');
    const systemWrap = document.getElementById('systemPromptWrap');
    toggleBtn.addEventListener('click', () => {
      const isHidden = systemWrap.style.display === 'none';
      systemWrap.style.display = isHidden ? '' : 'none';
      toggleBtn.classList.toggle('open', isHidden);
    });
  }

  function setModel(model) { _model = model; }

  return { init, setModel };
})();
