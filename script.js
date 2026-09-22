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
    const res = await fetch('/api/settings');
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
  const localModel = localStorage.getItem('gemini_model_client') || 'gemini-2.0-flash';
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
  const model = modelName || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    systemInstruction: {
      parts: [{
        text: "You are Vikola, a state-of-the-art mobile AI assistant. Answer accurately, clearly, and concisely in clean Markdown."
      }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response text returned.');
  return text;
}

// ==========================================
// QUESTION SUBMISSION
// ==========================================
async function sendQuestion(question) {
  showTypingIndicator();

  let handled = false;
  try {
    let response;
    if (attachedImageFile || recordedAudioBlob) {
      const formData = new FormData();
      formData.append('question', question);
      if (attachedImageFile) {
        formData.append('image', attachedImageFile, attachedImageFile.name);
      }
      if (recordedAudioBlob) {
        formData.append('audio', recordedAudioBlob, 'voice_recording.webm');
      }

      response = await fetch('/ask', {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
    }

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
    // Backend fetch failed (e.g. server down or static host)
  }

  // If backend didn't handle it, try direct client-side Gemini call
  if (!handled) {
    const clientKey = localStorage.getItem('gemini_api_key_client');
    const clientModel = localStorage.getItem('gemini_model_client') || 'gemini-2.0-flash';
    if (clientKey) {
      try {
        const directAnswer = await callGeminiClientDirect(question, clientKey, clientModel);
        hideTypingIndicator();
        streamBotMessage(directAnswer, 'gemini-direct', clientModel);
        engineBadge.className = 'status-pill online';
        engineBadge.textContent = `✨ ${clientModel} (Online)`;
        handled = true;
      } catch (geminiErr) {
        hideTypingIndicator();
        addMessage(`⚠️ **Gemini API Error:** ${geminiErr.message}`, 'bot');
        handled = true;
      }
    }
  }

  if (!handled) {
    hideTypingIndicator();
    addMessage(
      `⚠️ **Offline / Standalone Mode:** Unable to connect to server.\n\n` +
      `💡 *Tip: You can use Vikola 100% serverless by adding your free Gemini API key in **Settings (⚙️)**!*`,
      'bot'
    );
  }

  // Clear attachments
  clearAttachments();
}

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

// Clear Chat Button
function handleClearChat() {
  if (confirm('Are you sure you want to clear this conversation?')) {
    chatBox.innerHTML = '';
    chatHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    try {
      fetch('/api/clear', { method: 'POST' });
    } catch (e) {}
    addMessage('Conversation cleared. How can I help you next?', 'bot');
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
    const res = await fetch('/api/settings', {
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

// Prompt Suggestion Chips Click
document.querySelectorAll('.suggestion-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) {
      userInput.value = prompt;
      userInput.focus();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });
});

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

  if (!isRunningStandalone() && !sessionStorage.getItem('pwa_banner_dismissed')) {
    if (pwaInstallBanner) pwaInstallBanner.style.display = 'flex';
  }
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
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
      }
      deferredPrompt = null;
    });
  } else {
    // Show install instructions modal
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
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          if (installModal) installModal.style.display = 'none';
          if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
        }
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

if (dismissBannerBtn) {
  dismissBannerBtn.addEventListener('click', () => {
    if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  });
}

// App installed successfully event
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
  if (installModal) installModal.style.display = 'none';
  addMessage('🎉 **Vikola Mobile App installed successfully!** You can now launch it anytime directly from your Home Screen with offline access.', 'bot');
});

// ==========================================
// MOBILE BOTTOM NAVIGATION
// ==========================================
function setActiveNavTab(activeTab) {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    if (tab !== navTabInstall) {
      tab.classList.toggle('active', tab === activeTab);
    }
  });
}

if (navTabChat) {
  navTabChat.addEventListener('click', () => {
    setActiveNavTab(navTabChat);
    chatBox.scrollTop = chatBox.scrollHeight;
    userInput.focus();
  });
}

if (navTabPrompts) {
  navTabPrompts.addEventListener('click', () => {
    setActiveNavTab(navTabPrompts);
    const tray = document.getElementById('suggestionsTray');
    if (tray) {
      tray.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (navTabSearch) {
  navTabSearch.addEventListener('click', () => {
    setActiveNavTab(navTabSearch);
    if (searchBarContainer) {
      const isHidden = searchBarContainer.style.display === 'none';
      searchBarContainer.style.display = isHidden ? 'flex' : 'none';
      if (isHidden && chatSearchInput) {
        chatSearchInput.focus();
      }
    }
  });
}

if (navTabSettings) {
  navTabSettings.addEventListener('click', () => {
    setActiveNavTab(navTabSettings);
    if (settingsModal) settingsModal.style.display = 'flex';
  });
}

// ==========================================
// INITIALIZATION ON PAGE LOAD
// ==========================================
window.addEventListener('load', () => {
  loadHistory();

  if (chatHistory.length > 0) {
    chatHistory.forEach((msg) => renderMessageToDOM(msg, false));
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    addMessage(
      "Hello! I am **Vikola**, your personal AI assistant powered with **Google Gemini intelligence**.\n\n" +
      "You can ask me any question across math, programming, science, data analysis, or attach images & voice recordings.\n\n" +
      "*Tip: To install Vikola as a standalone mobile app on your phone, tap **Install** in the bottom bar.*",
      'bot'
    );
  }

  refreshSettingsStatus();

  // Show banner on mobile devices if not installed
  if (!isRunningStandalone() && !sessionStorage.getItem('pwa_banner_dismissed')) {
    setTimeout(() => {
      if (pwaInstallBanner) pwaInstallBanner.style.display = 'flex';
    }, 1500);
  }
});
