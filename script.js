// ==========================================
// GEMINI ASSISTANT PRO - CLIENT ENGINE
// Features: Persistent history, streaming responses,
// markdown parsing, search, export & action controls
// ==========================================

// DOM Elements
const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const imageInput = document.getElementById('imageInput');
const recordBtn = document.getElementById('recordBtn');
const preview = document.getElementById('preview');
const engineBadge = document.getElementById('engineBadge');
const clearChatBtn = document.getElementById('clearChatBtn');
const commercialBanner = document.getElementById('commercialBanner');
const activateKeyBtn = document.getElementById('activateKeyBtn');
const exportChatBtn = document.getElementById('exportChatBtn');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchBarContainer = document.getElementById('searchBarContainer');
const chatSearchInput = document.getElementById('chatSearchInput');
const searchMatchCount = document.getElementById('searchMatchCount');
const closeSearchBtn = document.getElementById('closeSearchBtn');

// Settings Modal Elements
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
const currentKeyStatus = document.getElementById('currentKeyStatus');
const modelSelect = document.getElementById('modelSelect');
const settingsFeedback = document.getElementById('settingsFeedback');

// PWA & Mobile Install Elements
const pwaInstallBanner = document.getElementById('pwaInstallBanner');
const bannerInstallBtn = document.getElementById('bannerInstallBtn');
const dismissBannerBtn = document.getElementById('dismissBannerBtn');
const navInstallBtn = document.getElementById('navInstallBtn');
const installModal = document.getElementById('installModal');
const closeInstallModalBtn = document.getElementById('closeInstallModalBtn');
const cancelInstallModalBtn = document.getElementById('cancelInstallModalBtn');
const executeInstallBtn = document.getElementById('executeInstallBtn');
const nativeInstallSection = document.getElementById('nativeInstallSection');
const iosInstallSection = document.getElementById('iosInstallSection');

// Mobile Bottom Navigation Tabs
const mobileBottomNav = document.getElementById('mobileBottomNav');
const navTabChat = document.getElementById('navTabChat');
const navTabPrompts = document.getElementById('navTabPrompts');
const navTabSearch = document.getElementById('navTabSearch');
const navTabSettings = document.getElementById('navTabSettings');
const navTabInstall = document.getElementById('navTabInstall');

// Recording & Attachment State
let mediaRecorder = null;
let recordedChunks = [];
let attachedImageFile = null;
let recordedAudioBlob = null;
let recordingTimer = null;
let recordingStartTime = null;

// API Base URL (Auto-routes to Render backend if running on GitHub Pages, Netlify, Vercel, or standalone PWA)
const API_BASE = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('onrender.com')
) ? '' : 'https://vikola-ai-assistant.onrender.com';

// Persistent Chat State
const STORAGE_KEY = 'gemini_pro_chat_history_v2';
let chatHistory = []; // Array of { id, sender, text, timestamp, isRawHtml, engine, model, rating }
let lastUserPrompt = '';

// ==========================================
// MARKDOWN PARSER
// ==========================================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkdown(md) {
  if (!md) return '';

  let html = md;

  // 1. Code blocks: ```lang ... ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'code';
    const escaped = escapeHtml(code.trim());
    return `<div class="code-block-wrapper"><div class="code-block-header"><span>${language}</span><button type="button" class="copy-code-btn" onclick="copyCode(this)">Copy</button></div><pre><code class="language-${language}">${escaped}</code></pre></div>`;
  });

  // 2. Tables: simple markdown tables
  html = html.replace(/\n(\|.+?\|\n\|[-:\s|]+\|\n(?:\|.+?\|\n?)+)/g, (match, tableText) => {
    const lines = tableText.trim().split('\n');
    if (lines.length < 3) return match;
    const headerCols = lines[0].split('|').slice(1, -1);
    let tableHtml = '<table><thead><tr>';
    headerCols.forEach(col => { tableHtml += `<th>${col.trim()}</th>`; });
    tableHtml += '</tr></thead><tbody>';
    for (let i = 2; i < lines.length; i++) {
      const rowCols = lines[i].split('|').slice(1, -1);
      tableHtml += '<tr>';
      rowCols.forEach(col => { tableHtml += `<td>${col.trim()}</td>`; });
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // 3. Horizontal rules: --- or ***
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');

  // 4. Blockquotes: > line
  html = html.replace(/(?:^|\n)>[ \t]?(.*?)(?=\n|$)/g, '<blockquote>$1</blockquote>');

  // 5. Headers: ###, ##, #
  html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // 6. Inline Code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 7. Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 8. Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 9a. Ordered Lists: 1. Item
  html = html.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<oli>$2</oli>');
  html = html.replace(/(<oli>.*?<\/oli>(?:\s*<oli>.*?<\/oli>)*)/gims, '<ol>$1</ol>');
  html = html.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>');

  // 9b. Unordered Lists: - Item or * Item
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<uli>$1</uli>');
  html = html.replace(/(<uli>.*?<\/uli>(?:\s*<uli>.*?<\/uli>)*)/gims, '<ul>$1</ul>');
  html = html.replace(/<uli>/g, '<li>').replace(/<\/uli>/g, '</li>');

  // 10. Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 11. Paragraphs & Linebreaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

// Helpers
function formatCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function generateId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

// ==========================================
// LOCAL STORAGE PERSISTENCE
// ==========================================
function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
  } catch (e) {
    console.warn('Could not save chat history to localStorage:', e);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      chatHistory = JSON.parse(raw) || [];
    }
  } catch (e) {
    chatHistory = [];
  }
}

// Render a saved or new message into the DOM
function renderMessageToDOM(msg, shouldScroll = true) {
  const welcomeHero = document.getElementById('welcomeHero');
  if (welcomeHero) welcomeHero.style.display = 'none';

  const row = document.createElement('div');
  row.className = `message-row ${msg.sender}`;
  row.id = msg.id;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  if (msg.sender === 'user') {
    avatar.textContent = '👤';
  } else {
    avatar.innerHTML = '<img src="icons/icon.svg" alt="V" class="bot-avatar-img" width="28" height="28" />';
  }

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (msg.isRawHtml) {
    bubble.innerHTML = msg.text;
  } else if (msg.sender === 'bot') {
    bubble.innerHTML = parseMarkdown(msg.text);
  } else {
    bubble.textContent = msg.text;
  }

  // Message metadata & actions footer
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = msg.timestamp || formatCurrentTime();
  meta.appendChild(timeEl);

  // Actions for bot messages (Copy, Thumbs Up/Down, Regenerate)
  if (msg.sender === 'bot') {
    const actionsBar = document.createElement('div');
    actionsBar.className = 'message-actions-bar';

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.title = 'Copy response';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(msg.text).then(() => {
        copyBtn.innerHTML = '✓ Copied';
        setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 1500);
      });
    };
    actionsBar.appendChild(copyBtn);

    // Thumbs Up
    const upBtn = document.createElement('button');
    upBtn.className = `msg-action-btn ${msg.rating === 'up' ? 'active' : ''}`;
    upBtn.title = 'Helpful';
    upBtn.innerHTML = '👍';
    upBtn.onclick = () => {
      toggleRating(msg.id, 'up');
    };
    actionsBar.appendChild(upBtn);

    // Thumbs Down
    const downBtn = document.createElement('button');
    downBtn.className = `msg-action-btn thumbs-down ${msg.rating === 'down' ? 'active thumbs-down' : ''}`;
    downBtn.title = 'Needs improvement';
    downBtn.innerHTML = '👎';
    downBtn.onclick = () => {
      toggleRating(msg.id, 'down');
    };
    actionsBar.appendChild(downBtn);

    // Regenerate Button
    const regenBtn = document.createElement('button');
    regenBtn.className = 'msg-action-btn';
    regenBtn.title = 'Regenerate this response';
    regenBtn.innerHTML = '🔄';
    regenBtn.onclick = () => {
      regenerateLastAnswer();
    };
    actionsBar.appendChild(regenBtn);

    meta.appendChild(actionsBar);
  }

  contentWrap.appendChild(bubble);
  contentWrap.appendChild(meta);

  row.appendChild(avatar);
  row.appendChild(contentWrap);

  chatBox.appendChild(row);
  if (shouldScroll) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  return row;
}

// Add and persist a message
function addMessage(text, sender, isRawHtml = false, engine = null, model = null) {
  const msg = {
    id: generateId(),
    sender,
    text,
    timestamp: formatCurrentTime(),
    isRawHtml,
    engine,
    model,
    rating: null,
  };

  chatHistory.push(msg);
  saveHistory();
  return renderMessageToDOM(msg, true);
}

// Progressive Typewriter Streaming for Bot Responses
function streamBotMessage(fullText, engine, model) {
  const welcomeHero = document.getElementById('welcomeHero');
  if (welcomeHero) welcomeHero.style.display = 'none';

  const msgId = generateId();
  const timestamp = formatCurrentTime();

  const msg = {
    id: msgId,
    sender: 'bot',
    text: fullText,
    timestamp,
    isRawHtml: false,
    engine,
    model,
    rating: null,
  };

  // Create DOM structure
  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.id = msgId;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '✨';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Blinking cursor container
  const textSpan = document.createElement('span');
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';

  bubble.appendChild(textSpan);
  bubble.appendChild(cursor);

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = timestamp;
  meta.appendChild(timeEl);

  contentWrap.appendChild(bubble);
  contentWrap.appendChild(meta);
  row.appendChild(avatar);
  row.appendChild(contentWrap);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Stream in chunks
  const words = fullText.split(' ');
  let index = 0;
  const chunkSize = Math.max(1, Math.floor(words.length / 50)); // Smooth 30-50 frames
  const interval = setInterval(() => {
    index += chunkSize;
    if (index >= words.length) {
      clearInterval(interval);
      // Finished streaming: render full parsed markdown and action buttons
      bubble.innerHTML = parseMarkdown(fullText);
      cursor.remove();

      // Add actions bar
      const actionsBar = document.createElement('div');
      actionsBar.className = 'message-actions-bar';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.title = 'Copy response';
      copyBtn.innerHTML = '📋 Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(fullText).then(() => {
          copyBtn.innerHTML = '✓ Copied';
          setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 1500);
        });
      };
      actionsBar.appendChild(copyBtn);

      const upBtn = document.createElement('button');
      upBtn.className = 'msg-action-btn';
      upBtn.title = 'Helpful';
      upBtn.innerHTML = '👍';
      upBtn.onclick = () => toggleRating(msgId, 'up');
      actionsBar.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.className = 'msg-action-btn thumbs-down';
      downBtn.title = 'Needs improvement';
      downBtn.innerHTML = '👎';
      downBtn.onclick = () => toggleRating(msgId, 'down');
      actionsBar.appendChild(downBtn);

      const regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action-btn';
      regenBtn.title = 'Regenerate this response';
      regenBtn.innerHTML = '🔄';
      regenBtn.onclick = () => regenerateLastAnswer();
      actionsBar.appendChild(regenBtn);

      meta.appendChild(actionsBar);

      // Persist to history
      chatHistory.push(msg);
      saveHistory();
      chatBox.scrollTop = chatBox.scrollHeight;
    } else {
      textSpan.textContent = words.slice(0, index).join(' ');
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, 20);
}

// Toggle thumbs up / down feedback
function toggleRating(msgId, type) {
  const msg = chatHistory.find(m => m.id === msgId);
  if (!msg) return;

  msg.rating = msg.rating === type ? null : type;
  saveHistory();

  // Re-render this specific row's actions
  const row = document.getElementById(msgId);
  if (row) {
    const upBtn = row.querySelector('.msg-action-btn[title="Helpful"]');
    const downBtn = row.querySelector('.msg-action-btn[title="Needs improvement"]');
    if (upBtn && downBtn) {
      upBtn.className = `msg-action-btn ${msg.rating === 'up' ? 'active' : ''}`;
      downBtn.className = `msg-action-btn thumbs-down ${msg.rating === 'down' ? 'active thumbs-down' : ''}`;
    }
  }
}

// Regenerate last user answer
function regenerateLastAnswer() {
  if (!lastUserPrompt) {
    // Find last user message in history
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      if (chatHistory[i].sender === 'user') {
        lastUserPrompt = chatHistory[i].text;
        break;
      }
    }
  }
  if (lastUserPrompt) {
    sendQuestion(lastUserPrompt);
  }
}

// ==========================================
// TYPING INDICATOR
// ==========================================
function showTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row bot typing-indicator-row';
  row.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '✨';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;

  contentWrap.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(contentWrap);

  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ==========================================
// BACKEND STATUS & SETTINGS
// ==========================================
async function refreshSettingsStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (res.ok) {
      const data = await res.json();
      if (data.configured) {
        engineBadge.className = 'status-pill online';
        engineBadge.textContent = `✨ ${data.model} (Online)`;
        currentKeyStatus.textContent = `Active Key: ${data.maskedKey} (Connected)`;
        currentKeyStatus.style.color = 'var(--success)';
        if (commercialBanner) commercialBanner.style.display = 'none';
      } else {
        checkLocalClientKey();
      }
      if (data.model) {
        modelSelect.value = data.model;
      }
      return;
    }
  } catch (e) {
    // Static hosting or server offline — check localStorage
  }
  checkLocalClientKey();
}

function checkLocalClientKey() {
  const localKey = localStorage.getItem('gemini_api_key_client') || '';
  const localModel = localStorage.getItem('gemini_model_client') || 'gemini-3.6-flash';
  if (localKey) {
    const masked = localKey.length >= 8 ? `${localKey.slice(0, 4)}...${localKey.slice(-4)}` : '***';
    engineBadge.className = 'status-pill online';
    engineBadge.textContent = `✨ ${localModel} (Direct PWA)`;
    currentKeyStatus.textContent = `Client Key: ${masked} (Active)`;
    currentKeyStatus.style.color = 'var(--success)';
    if (commercialBanner) commercialBanner.style.display = 'none';
  } else {
    engineBadge.className = 'status-pill fallback';
    engineBadge.textContent = '⚡ Free AI Mode';
    currentKeyStatus.textContent = 'No Gemini API key set (running local solver & knowledge engine).';
    currentKeyStatus.style.color = 'var(--warning)';
    if (commercialBanner) commercialBanner.style.display = 'flex';
  }
  if (localModel) {
    modelSelect.value = localModel;
  }
}

// Direct Client-Side Gemini Fallback (Zero-Cost Serverless Execution)
async function callGeminiClientDirect(promptText, apiKey, modelName) {
  const model = modelName || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build conversation history for context (last 8 messages)
  const contents = [];
  const historySlice = chatHistory.slice(-8);
  for (const msg of historySlice) {
    if (msg.sender === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.text }] });
    } else if (msg.sender === 'bot' && msg.text) {
      contents.push({ role: 'model', parts: [{ text: msg.text }] });
    }
  }
  // Add the current prompt
  contents.push({ role: 'user', parts: [{ text: promptText }] });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{
        text: "You are Vikola, a state-of-the-art commercial AI assistant powered by Google Gemini. " +
              "You answer all questions with high intelligence, factual accuracy, precision, and clarity across " +
              "all disciplines: mathematics, coding, computer science, physics, chemistry, biology, history, business, logic puzzles, and creative tasks. " +
              "When providing code, always write clean, production-grade code with appropriate language markdown fences. " +
              "Format your answers with professional Markdown (headers, bullet points, bold key terms, tables where helpful)."
      }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API HTTP ${res.status}`);
  }

  const data = await res.json();
  // Collect ALL text parts (thinking models return thoughtSignature in separate parts)
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => p.text).map(p => p.text).join('').trim();
  if (!text) throw new Error('No response text returned.');
  return text;
}

// ==========================================
// CLIENT-SIDE JAVASCRIPT KNOWLEDGE ENGINE
// Handles basic questions when server is offline/sleeping
// ==========================================
const jsKnowledge = {
  greet(q) {
    const nq = q.toLowerCase();
    if (/\b(hi|hello|hey|good\s*(morning|afternoon|evening|day)|greetings)\b/.test(nq)) {
      return "Hello! 👋 I am **Vikola**, your AI assistant powered by **Google Gemini**.\n\nI can answer questions about math, science, coding, history, and more. How can I help you today?\n\n> 💡 *The server is starting up — your next message will be handled by full Gemini AI!*";
    }
    return null;
  },
  identity(q) {
    const nq = q.toLowerCase();
    if (/who are you|what('?s| is) your name|your name/.test(nq)) {
      return "I am **Vikola** 🤖 — your personal AI assistant powered by **Google Gemini**.\n\nI can solve math problems, explain science, write code, analyze images, and much more!";
    }
    if (/what can you do|what do you do|your (capabilities|features|abilities)/.test(nq)) {
      return "Here's what I can do:\n\n- 🧮 **Mathematics** — algebra, calculus, statistics\n- 💻 **Programming** — Python, JavaScript, web dev, debugging\n- 🔬 **Science** — physics, chemistry, biology\n- 📚 **General Knowledge** — history, geography, language\n- 🖼️ **Image Analysis** — send a photo and I'll analyze it\n- 🎙️ **Voice Input** — record audio and I'll transcribe & respond";
    }
    return null;
  },
  math(q) {
    // Simple arithmetic
    const expr = q.replace(/[^0-9+\-*/.() ]/g, '').trim();
    if (/^[0-9+\-*/.() ]+$/.test(expr) && /[+\-*/]/.test(expr) && expr.length > 2) {
      try {
        const result = Function('"use strict"; return (' + expr + ')')();
        if (typeof result === 'number' && isFinite(result)) {
          return `**Math Result:**\n\n\`${expr.trim()}\` = **${Number.isInteger(result) ? result : result.toFixed(4)}**`;
        }
      } catch(e) {}
    }
    // Percentage
    const pct = q.match(/(\d+\.?\d*)%\s*of\s*(\d+\.?\d*)/i);
    if (pct) {
      const result = (parseFloat(pct[1]) / 100) * parseFloat(pct[2]);
      return `**${pct[1]}%** of **${pct[2]}** = **${Number.isInteger(result) ? result : result.toFixed(2)}**`;
    }
    return null;
  },
  common(q) {
    const nq = q.toLowerCase();
    const today = new Date();
    if (/what('?s| is) the (date|today|day)/.test(nq)) {
      return `Today is **${today.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}**.`;
    }
    if (/what('?s| is) the time/.test(nq)) {
      return `The current time is **${today.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}**.`;
    }
    if (/\b(thank you|thanks|thank u)\b/.test(nq)) {
      return "You're welcome! 😊 Ask me anything else!";
    }
    if (/\b(ok|okay|got it|sure|alright)\b/.test(nq)) {
      return "Got it! Feel free to ask me anything — math, coding, science, or any other topic. 😊";
    }
    if (/\b(bye|goodbye|see you|cya)\b/.test(nq)) {
      return "Goodbye! 👋 Come back anytime you need help. Have a great day!";
    }
    return null;
  },
  answer(question) {
    return this.greet(question)
        || this.identity(question)
        || this.math(question)
        || this.common(question)
        || null;
  }
};

// ==========================================
// QUESTION SUBMISSION
// ==========================================
async function sendQuestion(question) {
  showTypingIndicator();

  let handled = false;

  // --- Step 1: Try the backend server (with generous timeout for Render wake-up) ---
  try {
    let response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s to let Render wake up

    if (attachedImageFile || recordedAudioBlob) {
      const formData = new FormData();
      formData.append('question', question);
      if (attachedImageFile) formData.append('image', attachedImageFile, attachedImageFile.name);
      if (recordedAudioBlob) formData.append('audio', recordedAudioBlob, 'voice_recording.webm');
      response = await fetch(`${API_BASE}/ask`, { method: 'POST', body: formData, signal: controller.signal });
    } else {
      response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const answer = data.answer || 'No response received.';
      hideTypingIndicator();
      streamBotMessage(answer, data.engine, data.model);
      handled = true;
      if (data.engine === 'gemini') {
        engineBadge.className = 'status-pill online';
        engineBadge.textContent = `✨ ${data.model} (Online)`;
      }
    }
  } catch (err) {
    // Server is sleeping or unreachable — continue to fallbacks
  }

  // --- Step 2: Try direct client-side Gemini call if user has an API key saved ---
  if (!handled) {
    const clientKey = localStorage.getItem('gemini_api_key_client');
    const clientModel = localStorage.getItem('gemini_model_client') || 'gemini-3.6-flash';
    if (clientKey) {
      try {
        const directAnswer = await callGeminiClientDirect(question, clientKey, clientModel);
        hideTypingIndicator();
        streamBotMessage(directAnswer, 'gemini-direct', clientModel);
        engineBadge.className = 'status-pill online';
        engineBadge.textContent = `✨ ${clientModel} (Direct)`;
        handled = true;
      } catch (geminiErr) {
        // Direct Gemini also failed — continue to local fallback
      }
    }
  }

  // --- Step 3: Client-side JS knowledge engine (always works, no internet needed) ---
  if (!handled) {
    const localAnswer = jsKnowledge.answer(question);
    if (localAnswer) {
      hideTypingIndicator();
      streamBotMessage(localAnswer, 'local', 'offline-mode');
      engineBadge.className = 'status-pill fallback';
      engineBadge.textContent = '⚡ Local Mode';
      handled = true;
    }
  }

  // --- Step 4: Friendly "server is starting up" message (instead of cold "Offline" error) ---
  if (!handled) {
    hideTypingIndicator();
    const retryMsg = document.createElement('div');
    retryMsg.className = 'message-row bot';
    retryMsg.innerHTML = `
      <div class="avatar">✨</div>
      <div class="message-content">
        <div class="message-bubble">
          <p>⏳ <strong>Server is starting up…</strong></p>
          <p>Vikola's server went to sleep after inactivity (free hosting). It usually wakes up in <strong>10–20 seconds</strong>.</p>
          <p style="margin-top:10px">
            <button onclick="retryQuestion(${JSON.stringify(question)})" style="background:#6c63ff;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:14px;">
              🔄 Retry Now
            </button>
          </p>
          <p style="margin-top:10px;font-size:13px;opacity:0.75">💡 <em>Tip: Add your free Gemini API key in <strong>Settings (⚙️)</strong> for instant replies even when the server is sleeping.</em></p>
        </div>
        <div class="message-meta"><span class="message-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>
      </div>`;
    chatBox.appendChild(retryMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    engineBadge.className = 'status-pill fallback';
    engineBadge.textContent = '⚡ Server Starting…';

    // Auto-retry after 12 seconds
    setTimeout(() => {
      if (retryMsg.parentNode) {
        retryMsg.remove();
        sendQuestion(question);
      }
    }, 12000);
  }

  // Clear attachments
  clearAttachments();
}

// Exposed for the retry button inside the message bubble
window.retryQuestion = function(question) {
  sendQuestion(question);
};

function clearAttachments() {
  attachedImageFile = null;
  recordedAudioBlob = null;
  imageInput.value = '';
  preview.innerHTML = '';
}

// ==========================================
// INPUT CONTROLS & AUTO-EXPAND
// ==========================================
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
});

// Handle Enter to submit, Shift+Enter for newline
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Form Submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text && !attachedImageFile && !recordedAudioBlob) return;

  let displayLabel = text;
  if (!displayLabel) {
    if (attachedImageFile && recordedAudioBlob) {
      displayLabel = `[Sent image "${attachedImageFile.name}" and voice recording]`;
    } else if (attachedImageFile) {
      displayLabel = `[Sent image: "${attachedImageFile.name}"]`;
    } else if (recordedAudioBlob) {
      displayLabel = `[Sent voice recording]`;
    }
  }

  lastUserPrompt = text;
  addMessage(displayLabel, 'user');
  userInput.value = '';
  userInput.style.height = 'auto';

  sendQuestion(text);
});

// Image Input
imageInput.addEventListener('change', () => {
  const file = imageInput.files && imageInput.files[0];
  if (file) {
    attachedImageFile = file;
    renderPreview();
  }
});

// Voice Recording
recordBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordBtn.classList.remove('recording');
    recordBtn.title = 'Voice Input';
    if (recordingTimer) clearInterval(recordingTimer);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      recordedAudioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      renderPreview();
    };

    mediaRecorder.start();
    recordBtn.classList.add('recording');
    recordBtn.title = 'Click to Stop Recording';

    recordingTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - recordingStartTime) / 1000);
      recordBtn.title = `Recording... ${elapsed}s (Click to stop)`;
    }, 500);
  } catch (err) {
    alert('Microphone access was denied or is not available.');
  }
});

// Render Attachment Previews
function renderPreview() {
  preview.innerHTML = '';

  if (attachedImageFile) {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(attachedImageFile);

    const name = document.createElement('span');
    name.textContent = attachedImageFile.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
      attachedImageFile = null;
      imageInput.value = '';
      renderPreview();
    };

    item.appendChild(img);
    item.appendChild(name);
    item.appendChild(removeBtn);
    preview.appendChild(item);
  }

  if (recordedAudioBlob) {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const label = document.createElement('span');
    label.textContent = '🎙️ Voice Recording Ready';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'preview-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
      recordedAudioBlob = null;
      renderPreview();
    };

    item.appendChild(label);
    item.appendChild(removeBtn);
    preview.appendChild(item);
  }
}

function handleClearChat() {
  if (confirm('Start a new conversation?')) {
    chatHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    try {
      fetch(`${API_BASE}/api/clear`, { method: 'POST' });
    } catch (e) {}
    chatBox.innerHTML = `
      <div id="welcomeHero" class="welcome-hero">
        <div class="hero-sparkle">✨</div>
        <h1 class="hero-title">How can I help you today?</h1>
        <p class="hero-sub">Ask anything across math, programming, science, creative ideas, or upload images & audio.</p>
        
        <div class="prompt-grid">
          <button class="prompt-card suggestion-chip" data-prompt="Solve for x: 3x + 15 = 45">
            <span class="prompt-icon">📐</span>
            <span class="prompt-text"><strong>Solve Equation</strong><small>Solve 3x + 15 = 45</small></span>
          </button>
          <button class="prompt-card suggestion-chip" data-prompt="Write a Python one-liner to check if a string is a palindrome.">
            <span class="prompt-icon">🐍</span>
            <span class="prompt-text"><strong>Python Code</strong><small>Check palindrome string</small></span>
          </button>
          <button class="prompt-card suggestion-chip" data-prompt="State Charles's law in chemistry and give an example.">
            <span class="prompt-icon">⚖️</span>
            <span class="prompt-text"><strong>Chemistry Law</strong><small>Explain Charles's Law</small></span>
          </button>
          <button class="prompt-card suggestion-chip" data-prompt="Explain quantum computing in simple terms.">
            <span class="prompt-icon">⚛️</span>
            <span class="prompt-text"><strong>Explain Concept</strong><small>Quantum computing basics</small></span>
          </button>
        </div>
      </div>
    `;
    attachPromptListeners();
  }
}
clearChatBtn.addEventListener('click', handleClearChat);

// ==========================================
// EXPORT CHAT (Markdown / TXT)
// ==========================================
if (exportChatBtn) {
  exportChatBtn.addEventListener('click', () => {
    if (!chatHistory.length) {
      alert('No messages to export yet.');
      return;
    }

    let exportContent = `# Vikola AI - Chat Export\n`;
    exportContent += `Exported on: ${new Date().toLocaleString()}\n`;
    exportContent += `Total messages: ${chatHistory.length}\n\n`;
    exportContent += `---\n\n`;

    chatHistory.forEach((msg) => {
      const role = msg.sender === 'user' ? '👤 User' : '✨ Vikola';
      exportContent += `### ${role} (${msg.timestamp})\n\n`;
      exportContent += `${msg.text}\n\n`;
      exportContent += `---\n\n`;
    });

    const blob = new Blob([exportContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gemini_chat_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

// ==========================================
// IN-CHAT SEARCH
// ==========================================
if (searchToggleBtn && searchBarContainer) {
  searchToggleBtn.addEventListener('click', () => {
    const isHidden = searchBarContainer.style.display === 'none';
    searchBarContainer.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      chatSearchInput.focus();
    } else {
      clearSearchHighlights();
    }
  });

  closeSearchBtn.addEventListener('click', () => {
    searchBarContainer.style.display = 'none';
    clearSearchHighlights();
  });

  chatSearchInput.addEventListener('input', () => {
    const query = chatSearchInput.value.trim().toLowerCase();
    if (!query) {
      clearSearchHighlights();
      searchMatchCount.textContent = '';
      return;
    }

    let matchCount = 0;
    let firstMatchEl = null;

    document.querySelectorAll('.message-bubble').forEach((bubble) => {
      const text = bubble.innerText || '';
      if (text.toLowerCase().includes(query)) {
        matchCount++;
        bubble.closest('.message-row').style.opacity = '1';
        if (!firstMatchEl) firstMatchEl = bubble;
      } else {
        bubble.closest('.message-row').style.opacity = '0.4';
      }
    });

    searchMatchCount.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
    if (firstMatchEl) {
      firstMatchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function clearSearchHighlights() {
  if (chatSearchInput) chatSearchInput.value = '';
  if (searchMatchCount) searchMatchCount.textContent = '';
  document.querySelectorAll('.message-row').forEach((row) => {
    row.style.opacity = '1';
  });
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
window.addEventListener('keydown', (e) => {
  // Ctrl+L or Cmd+L to clear chat
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    handleClearChat();
  }
  // Escape to close modals and search
  if (e.key === 'Escape') {
    if (settingsModal.style.display === 'flex') {
      settingsModal.style.display = 'none';
    }
    if (searchBarContainer && searchBarContainer.style.display === 'flex') {
      searchBarContainer.style.display = 'none';
      clearSearchHighlights();
    }
  }
});

// ==========================================
// SETTINGS MODAL HANDLERS
// ==========================================
openSettingsBtn.addEventListener('click', () => {
  settingsFeedback.style.display = 'none';
  settingsModal.style.display = 'flex';
  apiKeyInput.focus();
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

cancelSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

toggleKeyVisibility.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleKeyVisibility.textContent = '🙈';
  } else {
    apiKeyInput.type = 'password';
    toggleKeyVisibility.textContent = '👁️';
  }
});

saveSettingsBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  saveSettingsBtn.disabled = true;
  saveSettingsBtn.textContent = 'Verifying...';
  settingsFeedback.style.display = 'none';

  // Cache to localStorage for client-side / serverless execution
  if (apiKey) {
    localStorage.setItem('gemini_api_key_client', apiKey);
  }
  if (model) {
    localStorage.setItem('gemini_model_client', model);
  }

  let backendSuccess = false;
  try {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      settingsFeedback.style.display = 'block';
      settingsFeedback.className = 'settings-feedback success';
      settingsFeedback.textContent = '✓ ' + data.message;
      backendSuccess = true;
    }
  } catch (err) {
    // Backend unavailable, fallback to client-side validation
  }

  if (!backendSuccess && apiKey) {
    // Validate key directly against Google Gemini
    try {
      await callGeminiClientDirect('Test', apiKey, model);
      settingsFeedback.style.display = 'block';
      settingsFeedback.className = 'settings-feedback success';
      settingsFeedback.textContent = '✓ Connected successfully (Direct PWA mode)!';
      backendSuccess = true;
    } catch (e) {
      settingsFeedback.style.display = 'block';
      settingsFeedback.className = 'settings-feedback error';
      settingsFeedback.textContent = '✕ Gemini verification failed: ' + e.message;
    }
  }

  if (backendSuccess) {
    apiKeyInput.value = '';
    await refreshSettingsStatus();
    setTimeout(() => {
      settingsModal.style.display = 'none';
    }, 1200);
  }

  saveSettingsBtn.disabled = false;
  saveSettingsBtn.textContent = 'Verify & Save';
});

// Global Copy Code Helper
window.copyCode = function (btn) {
  const wrapper = btn.closest('.code-block-wrapper');
  const codeEl = wrapper ? wrapper.querySelector('code') : null;
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied! ✓';
      btn.style.color = 'var(--success)';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.color = '';
      }, 1500);
    });
  }
};

// Commercial Banner Activation Button
if (activateKeyBtn) {
  activateKeyBtn.addEventListener('click', () => {
    settingsFeedback.style.display = 'none';
    settingsModal.style.display = 'flex';
    apiKeyInput.focus();
  });
}

function attachPromptListeners() {
  document.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.onclick = () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        userInput.value = prompt;
        userInput.focus();
        chatForm.dispatchEvent(new Event('submit'));
      }
    };
  });
}

// Prompt Suggestion Chips Click
attachPromptListeners();

// ==========================================
// PWA INSTALLATION & SERVICE WORKER
// ==========================================
let deferredPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Vikola Service Worker active:', reg.scope))
      .catch((err) => console.warn('Service Worker registration failed:', err));
  });
}

// Check if running as standalone PWA
function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Check iOS device
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Capture browser native install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Trigger install flow
function triggerInstallFlow() {
  if (isRunningStandalone()) {
    alert('Vikola is already installed as a standalone app on this device!');
    return;
  }

  if (isIOSDevice()) {
    if (nativeInstallSection) nativeInstallSection.style.display = 'none';
    if (iosInstallSection) iosInstallSection.style.display = 'block';
    if (installModal) installModal.style.display = 'flex';
    return;
  }

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
    });
  } else {
    if (nativeInstallSection) nativeInstallSection.style.display = 'block';
    if (iosInstallSection) iosInstallSection.style.display = 'none';
    if (installModal) installModal.style.display = 'flex';
  }
}

// Install Buttons Click Handlers
document.querySelectorAll('.install-trigger-btn').forEach((btn) => {
  btn.addEventListener('click', triggerInstallFlow);
});

if (executeInstallBtn) {
  executeInstallBtn.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        if (installModal) installModal.style.display = 'none';
        deferredPrompt = null;
      });
    } else {
      alert('To install on this browser: Tap your browser menu (⋮) and select "Install app" or "Add to Home screen".');
    }
  });
}

if (closeInstallModalBtn) {
  closeInstallModalBtn.addEventListener('click', () => {
    if (installModal) installModal.style.display = 'none';
  });
}

if (cancelInstallModalBtn) {
  cancelInstallModalBtn.addEventListener('click', () => {
    if (installModal) installModal.style.display = 'none';
  });
}

// App installed successfully event
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installModal) installModal.style.display = 'none';
});

// ==========================================
// INITIALIZATION ON PAGE LOAD
// ==========================================
window.addEventListener('load', () => {
  loadHistory();

  if (chatHistory.length > 0) {
    const hero = document.getElementById('welcomeHero');
    if (hero) hero.style.display = 'none';
    chatHistory.forEach((msg) => renderMessageToDOM(msg, false));
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    attachPromptListeners();
  }

  refreshSettingsStatus();
});
