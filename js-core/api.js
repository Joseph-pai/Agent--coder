/**
 * api.js — AI model adapters
 * Supports: DeepSeek, Gemini (streaming SSE)
 */

const API = (() => {

  // ── Helpers ──────────────────────────────────────────────────
  function getKey(model) {
    if (model === 'deepseek') return localStorage.getItem('ag_deepseek_key') || '';
    if (model === 'gemini')   return localStorage.getItem('ag_gemini_key') || '';
    return '';
  }

  function getSubModel(model) {
    if (model === 'deepseek') return localStorage.getItem('ag_deepseek_model') || 'deepseek-chat';
    if (model === 'gemini')   return localStorage.getItem('ag_gemini_model')   || 'gemini-2.0-flash';
    return '';
  }

  // ── DeepSeek Streaming ───────────────────────────────────────
  async function* streamDeepSeek(messages, signal) {
    const key = getKey('deepseek');
    if (!key) throw new Error('DeepSeek API key not set. Please open Settings.');

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getSubModel('deepseek'),
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`DeepSeek API error ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch { /* skip malformed */ }
        }
      }
    }
  }

  // ── Gemini Streaming ─────────────────────────────────────────
  async function* streamGemini(messages, signal) {
    const key = getKey('gemini');
    if (!key) throw new Error('Gemini API key not set. Please open Settings.');

    const model = getSubModel('gemini');

    // Convert OpenAI-style messages to Gemini format
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;

    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch { /* skip */ }
        }
      }
    }
  }

  // ── Public Interface ─────────────────────────────────────────
  /**
   * stream(model, messages, signal)
   * Returns an async generator that yields text deltas.
   */
  function stream(model, messages, signal) {
    if (model === 'deepseek') return streamDeepSeek(messages, signal);
    if (model === 'gemini')   return streamGemini(messages, signal);
    throw new Error(`Unknown model: ${model}`);
  }

  return { stream };
})();
