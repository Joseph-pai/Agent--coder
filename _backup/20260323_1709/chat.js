/**
 * chat.js — Right panel AI chat, plan flow, and file generation
 *
 * Two-phase flow:
 *  Phase 1 (Plan): User sends prompt → AI responds with plan markdown
 *  Phase 2 (Execute): User confirms → AI generates <FILE> blocks
 */

const Chat = (() => {
  let _messages = [];    // conversation history (OpenAI format)
  let _model    = 'deepseek';
  let _abortCtrl = null;
  let _phase     = 'idle'; // 'idle' | 'planning' | 'confirming' | 'executing'
  let _pendingPlan = '';   // raw plan markdown

  // ── System Prompts ────────────────────────────────────────────
  const PLAN_SYSTEM = `You are an expert AI software agent. When the user describes a project or feature, respond with a clear, concise **Execution Plan** in Markdown. Include:
- A brief description of what you will build
- A list of files you will create with one-line descriptions
- Key implementation decisions

Do NOT include any code at this stage. End your response with exactly the line: \`--- PLAN COMPLETE ---\``;

  const EXECUTE_SYSTEM = `You are an expert AI software agent executing a code generation task. Generate complete, working file contents for each file in the plan.

Use this EXACT format for each file (no deviations):
<FILE path="relative/path/to/file.ext">
full file content here
</FILE>

Rules:
- Output ALL files needed to implement the plan
- Use relative paths (no leading slash)
- Include complete, production-ready code (no placeholders)
- After all files, write: \`--- FILES COMPLETE ---\``;

  // ── Helpers ───────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderMarkdown(text) {
    if (window.marked) {
      return marked.parse(text);
    }
    return `<p>${escapeHtml(text).replace(/\n/g,'<br/>')}</p>`;
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
    // Remove welcome if present
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

  // ── Phase 1: Plan ─────────────────────────────────────────────
  async function runPlan(userText, systemOverride) {
    _phase = 'planning';
    setUIState('generating');

    const sysPrompt = systemOverride || PLAN_SYSTEM;
    _messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userText },
    ];

    const bodyEl = createAiMessageEl();
    let fullText = '';
    _abortCtrl = new AbortController();

    try {
      const gen = API.stream(_model, _messages, _abortCtrl.signal);
      for await (const delta of gen) {
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
        setUIState('idle');
        _phase = 'idle';
        return;
      }
    }

    // Store assistant response
    _messages.push({ role: 'assistant', content: fullText });
    _pendingPlan = fullText;

    // Check if it looks like a plan
    const hasPlanMarker = fullText.includes('--- PLAN COMPLETE ---') || fullText.length > 50;
    if (hasPlanMarker) {
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

    // Append execution request to conversation
    _messages.push({ role: 'user', content: 'Please now generate all the files based on the plan above.' });

    // Override system prompt for execution
    _messages[0] = { role: 'system', content: EXECUTE_SYSTEM };

    const bodyEl = createAiMessageEl();
    let fullText = '';
    _abortCtrl = new AbortController();

    try {
      const gen = API.stream(_model, _messages, _abortCtrl.signal);
      for await (const delta of gen) {
        fullText += delta;
        // Show streaming text but hide raw FILE tags (replace with generating indicator)
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
        _phase = 'idle';
        setUIState('idle');
        return;
      } else {
        bodyEl.innerHTML = `<span style="color:var(--danger)">Error: ${escapeHtml(e.message)}</span>`;
        Toast.show(e.message, 'error');
        _phase = 'idle';
        setUIState('idle');
        return;
      }
    }

    // Parse and write files
    const files = parseFiles(fullText);
    if (files.length === 0) {
      // AI just replied normally — display as chat
      bodyEl.innerHTML = renderMarkdown(fullText);
      _messages.push({ role: 'assistant', content: fullText });
      _phase = 'idle';
      setUIState('idle');
      return;
    }

    // Write each file
    let summary = `<p><strong>✅ Generated ${files.length} file(s):</strong></p><ul>`;
    for (const file of files) {
      await FileTree.writeFile(file.path, file.content);
      summary += `<li><code>${escapeHtml(file.path)}</code></li>`;
      await new Promise(r => setTimeout(r, 80)); // small delay for UI feedback
    }
    summary += '</ul>';
    bodyEl.innerHTML = summary;
    scrollToBottom();

    _messages.push({ role: 'assistant', content: fullText });
    _phase = 'idle';
    hidePlanArea();
    setUIState('idle');
    Toast.show(`${files.length} file(s) created`, 'success');
  }

  // ── Plan Area UI ──────────────────────────────────────────────
  function showPlanArea(planText) {
    const area = document.getElementById('planArea');
    const content = document.getElementById('planContent');
    area.style.display = 'flex';
    content.innerHTML = renderMarkdown(planText);
  }

  function hidePlanArea() {
    document.getElementById('planArea').style.display = 'none';
    document.getElementById('planContent').innerHTML = '';
  }

  // ── UI State Machine ──────────────────────────────────────────
  function setUIState(state) {
    const sendBtn  = document.getElementById('sendBtn');
    const stopBtn  = document.getElementById('stopBtn');
    const input    = document.getElementById('chatInput');
    const confirm  = document.getElementById('confirmPlanBtn');
    const reject   = document.getElementById('rejectPlanBtn');

    sendBtn.style.display  = state === 'generating' ? 'none' : 'flex';
    stopBtn.style.display  = state === 'generating' ? 'flex' : 'none';
    input.disabled         = state === 'generating';

    if (state === 'confirming') {
      confirm.disabled = false;
      reject.disabled  = false;
    }
  }

  // ── Send ──────────────────────────────────────────────────────
  async function send() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text) return;

    const sysOverride = document.getElementById('systemPrompt').value.trim();

    input.value = '';
    appendUserMessage(text);
    hidePlanArea();

    await runPlan(text, sysOverride || null);
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    // Send on button click
    document.getElementById('sendBtn').addEventListener('click', send);

    // Send on Enter (Shift+Enter = newline)
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (_phase === 'idle') send();
      }
    });

    // Auto-resize textarea
    document.getElementById('chatInput').addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    });

    // Stop generation
    document.getElementById('stopBtn').addEventListener('click', () => {
      if (_abortCtrl) _abortCtrl.abort();
      _phase = 'idle';
      setUIState('idle');
      hidePlanArea();
    });

    // Confirm plan → execute
    document.getElementById('confirmPlanBtn').addEventListener('click', () => {
      if (_phase !== 'confirming') return;
      runExecute();
    });

    // Reject plan → hide plan area
    document.getElementById('rejectPlanBtn').addEventListener('click', () => {
      hidePlanArea();
      _phase = 'idle';
      setUIState('idle');
      _pendingPlan = '';
      Toast.show('Plan cancelled', 'info');
    });

    // Clear chat
    document.getElementById('clearChatBtn').addEventListener('click', () => {
      _messages = [];
      _phase = 'idle';
      _pendingPlan = '';
      hidePlanArea();
      setUIState('idle');
      const history = document.getElementById('chatHistory');
      history.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🤖</div>
          <p>Describe what you want to build and AI will create an execution plan, then generate the files for you.</p>
        </div>
      `;
    });

    // Toggle system prompt
    const toggleBtn = document.getElementById('toggleSystemPrompt');
    const systemWrap = document.getElementById('systemPromptWrap');
    toggleBtn.addEventListener('click', () => {
      const isHidden = systemWrap.style.display === 'none';
      systemWrap.style.display = isHidden ? '' : 'none';
      toggleBtn.classList.toggle('open', isHidden);
    });
  }

  function setModel(model) {
    _model = model;
  }

  return { init, setModel };
})();
