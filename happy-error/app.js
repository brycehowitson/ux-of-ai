import { scenarios } from './scenarios.js';
import { AIService } from './ai-service.js';

// Initialize AI Service
const aiService = new AIService();

// DOM Elements
const aiStatusPill = document.getElementById('aiStatusPill');
const aiStatusText = document.getElementById('aiStatusText');
const presetsGrid = document.getElementById('presetsGrid');
const messageInput = document.getElementById('messageInput');
const charCount = document.getElementById('charCount');
const clearBtn = document.getElementById('clearBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const tabStream = document.getElementById('tabStream');
const tabJson = document.getElementById('tabJson');
const tabPrompt = document.getElementById('tabPrompt');
const terminalMetric = document.getElementById('terminalMetric');
const terminalStatusBadge = document.getElementById('terminalStatusBadge');
const terminalStatusText = document.getElementById('terminalStatusText');
const terminalOutput = document.getElementById('terminalOutput');
const copyJsonBtn = document.getElementById('copyJsonBtn');

const outcomeCard = document.getElementById('outcomeCard');
const outcomeEmpty = document.getElementById('outcomeEmpty');
const outcomeLoading = document.getElementById('outcomeLoading');
const downloadProgressText = document.getElementById('downloadProgressText');
const resultContent = document.getElementById('resultContent');

const deceptiveBanner = document.getElementById('deceptiveBanner');
const statusPill = document.getElementById('statusPill');
const statusIcon = document.getElementById('statusIcon');
const statusLabel = document.getElementById('statusLabel');
const headlineText = document.getElementById('headlineText');
const explanationText = document.getElementById('explanationText');
const actionsSection = document.getElementById('actionsSection');
const actionsList = document.getElementById('actionsList');

const toast = document.getElementById('toast');
const flagsModal = document.getElementById('flagsModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Inspector State
let currentTab = 'stream'; // 'stream' | 'json' | 'prompt'
let currentRawStream = '';
let currentParsedJson = null;
let currentPrompt = '';
let currentLatencyMs = null;
let activeScenarioId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initPresets();
  checkAIStatus();
  setupEventListeners();
  updateInputStats();
});

// Populate Preset Scenario Buttons
function initPresets() {
  presetsGrid.innerHTML = '';
  scenarios.forEach((scenario) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.dataset.id = scenario.id;
    btn.innerHTML = `
      <div class="preset-btn-top">
        <span class="preset-btn-title">${escapeHtml(scenario.title)}</span>
        <span class="preset-btn-badge">${escapeHtml(scenario.badge)}</span>
      </div>
      <div class="preset-btn-desc">${escapeHtml(scenario.description)}</div>
    `;
    btn.addEventListener('click', () => selectScenario(scenario));
    presetsGrid.appendChild(btn);
  });
}

function selectScenario(scenario) {
  activeScenarioId = scenario.id;
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === scenario.id);
  });
  messageInput.value = scenario.text;
  updateInputStats();
}

// Check Chrome Prompt API Status
async function checkAIStatus() {
  const result = await aiService.checkCapabilities();
  
  aiStatusPill.className = `status-pill ${result.status}`;
  
  if (result.status === 'ready') {
    aiStatusText.textContent = '🟢 Prompt API Ready';
    aiStatusPill.title = 'Gemini Nano is available and ready on-device.';
  } else if (result.status === 'downloadable') {
    aiStatusText.textContent = '🟡 Model Download Required';
    aiStatusPill.title = 'Model is available and will download upon first query.';
  } else {
    aiStatusText.textContent = '🔴 Enable Chrome Flags';
    aiStatusPill.title = 'Click for instructions to enable Chrome Prompt API.';
  }
}

// Setup Event Listeners
function setupEventListeners() {
  messageInput.addEventListener('input', () => {
    updateInputStats();
    if (activeScenarioId) {
      activeScenarioId = null;
      document.querySelectorAll('.preset-btn').forEach((btn) => btn.classList.remove('active'));
    }
  });

  clearBtn.addEventListener('click', () => {
    messageInput.value = '';
    updateInputStats();
    activeScenarioId = null;
    document.querySelectorAll('.preset-btn').forEach((btn) => btn.classList.remove('active'));
    resetOutcomeView();
  });

  analyzeBtn.addEventListener('click', handleAnalyze);

  // Inspector Tabs
  [tabStream, tabJson, tabPrompt].forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      currentTab = tabBtn.dataset.tab;
      document.querySelectorAll('.terminal-tab').forEach((t) => t.classList.remove('active'));
      tabBtn.classList.add('active');
      renderTerminalView();
    });
  });

  copyJsonBtn.addEventListener('click', () => {
    let textToCopy = '';
    if (currentTab === 'stream') textToCopy = currentRawStream;
    else if (currentTab === 'json') textToCopy = currentParsedJson ? JSON.stringify(currentParsedJson, null, 2) : currentRawStream;
    else if (currentTab === 'prompt') textToCopy = currentPrompt;

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      showToast('Copied to clipboard!');
    }
  });

  aiStatusPill.addEventListener('click', () => {
    flagsModal.classList.add('open');
  });

  closeModalBtn.addEventListener('click', () => {
    flagsModal.classList.remove('open');
  });

  flagsModal.addEventListener('click', (e) => {
    if (e.target === flagsModal) {
      flagsModal.classList.remove('open');
    }
  });
}

function updateInputStats() {
  const length = messageInput.value.length;
  charCount.textContent = `${length} chars`;
  clearBtn.style.display = length > 0 ? 'inline-flex' : 'none';
  analyzeBtn.disabled = length === 0;
}

// Handle AI Analysis Execution
async function handleAnalyze() {
  const text = messageInput.value.trim();
  if (!text) return;

  // UI state: analyzing
  analyzeBtn.disabled = true;
  outcomeEmpty.style.display = 'none';
  resultContent.style.display = 'none';
  outcomeLoading.style.display = 'flex';
  downloadProgressText.textContent = 'Running on-device prompt session...';

  // Switch to Stream tab automatically during execution
  currentTab = 'stream';
  document.querySelectorAll('.terminal-tab').forEach((t) => t.classList.remove('active'));
  tabStream.classList.add('active');

  terminalStatusBadge.className = 'terminal-badge streaming';
  terminalStatusText.textContent = 'STREAMING TOKENS...';
  terminalMetric.style.display = 'none';
  terminalOutput.innerHTML = '<span class="terminal-cursor"></span>';
  copyJsonBtn.disabled = true;

  currentRawStream = '';
  currentParsedJson = null;
  currentPrompt = '';
  currentLatencyMs = null;

  try {
    const { raw, parsed, prompt, latencyMs } = await aiService.analyzeMessage(text, {
      onToken: (tokens) => {
        currentRawStream = tokens;
        if (currentTab === 'stream') {
          terminalOutput.innerHTML = `${escapeHtml(tokens)}<span class="terminal-cursor"></span>`;
          terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
      },
      onDownloadProgress: (pct) => {
        downloadProgressText.textContent = `Downloading Gemini Nano weights: ${pct}%`;
      }
    });

    currentRawStream = raw;
    currentParsedJson = parsed;
    currentPrompt = prompt;
    currentLatencyMs = latencyMs;

    // Estimate token count (~4 chars per token)
    const tokenEst = Math.max(1, Math.round(raw.length / 4));
    terminalMetric.textContent = `⚡ ${latencyMs}ms • ~${tokenEst} tokens`;
    terminalMetric.style.display = 'inline-block';

    terminalStatusBadge.className = 'terminal-badge';
    terminalStatusText.textContent = 'COMPLETED';
    copyJsonBtn.disabled = false;

    // Automatically switch to Formatted JSON tab on completion for crisp readability
    currentTab = 'json';
    document.querySelectorAll('.terminal-tab').forEach((t) => t.classList.remove('active'));
    tabJson.classList.add('active');
    renderTerminalView();

    // Update status pill to ready since execution succeeded
    aiStatusPill.className = 'status-pill ready';
    aiStatusText.textContent = '🟢 Prompt API Ready';

    // Render outcome card
    renderOutcome(parsed);
  } catch (err) {
    console.error('Analysis failed:', err);
    terminalStatusBadge.className = 'terminal-badge';
    terminalStatusText.textContent = 'ERROR';
    terminalOutput.innerHTML = `<span style="color: var(--color-error);">${escapeHtml(err.message)}</span>`;
    
    outcomeLoading.style.display = 'none';
    outcomeEmpty.style.display = 'flex';
    outcomeEmpty.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <div class="empty-title" style="color: var(--color-error);">Analysis Failed</div>
      <div class="empty-hint">${escapeHtml(err.message)}</div>
      <button class="action-btn" onclick="document.getElementById('flagsModal').classList.add('open')" style="margin-top: 10px;">Check Chrome Flags</button>
    `;
  } finally {
    analyzeBtn.disabled = false;
  }
}

// Render Terminal View based on active Tab
function renderTerminalView() {
  if (currentTab === 'stream') {
    if (!currentRawStream) {
      terminalOutput.innerHTML = '<span style="color: var(--text-muted);">// Raw token stream from Gemini Nano will appear here in real time...</span>';
    } else {
      terminalOutput.innerHTML = escapeHtml(currentRawStream);
    }
  } else if (currentTab === 'json') {
    if (!currentParsedJson) {
      terminalOutput.innerHTML = '<span style="color: var(--text-muted);">// Pretty-printed JSON structure will appear here upon completion...</span>';
    } else {
      const prettyJson = JSON.stringify(currentParsedJson, null, 2);
      terminalOutput.innerHTML = syntaxHighlightJson(prettyJson);
    }
  } else if (currentTab === 'prompt') {
    if (!currentPrompt) {
      terminalOutput.innerHTML = '<span style="color: var(--text-muted);">// Full prompt sent to Gemini Nano will appear here...</span>';
    } else {
      terminalOutput.innerHTML = `<span style="color: #94a3b8;">${escapeHtml(currentPrompt)}</span>`;
    }
  }
}

// Syntax Highlighter for JSON
function syntaxHighlightJson(json) {
  const escaped = escapeHtml(json);
  return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

// Render Structured Outcome
function renderOutcome(data) {
  outcomeLoading.style.display = 'none';
  resultContent.style.display = 'flex';

  const status = (data.status || 'error').toLowerCase();
  const isDeceptive = Boolean(data.isDeceptive);

  // Deceptive banner
  deceptiveBanner.style.display = isDeceptive ? 'flex' : 'none';

  // Status Badge
  statusPill.className = `outcome-pill ${status}`;
  if (status === 'success') {
    statusIcon.textContent = '🟢';
    statusLabel.textContent = 'SUCCESS';
  } else if (status === 'warning') {
    statusIcon.textContent = '⚠️';
    statusLabel.textContent = 'PARTIAL / WARNING';
  } else {
    statusIcon.textContent = '🔴';
    statusLabel.textContent = isDeceptive ? 'DECEPTIVE ERROR' : 'ERROR';
  }

  // Headline & Explanation
  headlineText.textContent = data.headline || 'Outcome Analyzed';
  explanationText.textContent = data.explanation || 'No detailed explanation provided.';

  // Actions List
  actionsList.innerHTML = '';
  const actions = Array.isArray(data.actions) ? data.actions : [];

  if (actions.length === 0) {
    actionsSection.style.display = 'none';
  } else {
    actionsSection.style.display = 'flex';
    actions.forEach((act) => {
      const card = document.createElement('div');
      card.className = 'action-card';

      let icon = '⚡';
      let actionControlHtml = '';
      const type = (act.type || 'action').toLowerCase();

      if (type === 'phone') {
        icon = '📞';
        actionControlHtml = `
          <a href="tel:${escapeHtml(act.target)}" class="action-btn">Call</a>
          <button class="action-btn copy-btn" data-copy="${escapeHtml(act.target)}">Copy</button>
        `;
      } else if (type === 'command') {
        icon = '💻';
        actionControlHtml = `
          <button class="action-btn copy-btn" data-copy="${escapeHtml(act.target)}">Copy Command</button>
        `;
      } else if (type === 'url') {
        icon = '🔗';
        actionControlHtml = `
          <a href="${escapeHtml(act.target)}" target="_blank" rel="noopener noreferrer" class="action-btn">Open Link ↗</a>
        `;
      } else {
        icon = '📋';
        actionControlHtml = `
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" style="accent-color: var(--color-brand); width: 16px; height: 16px;">
            <span>Done</span>
          </label>
        `;
      }

      card.innerHTML = `
        <div class="action-info">
          <span class="action-icon">${icon}</span>
          <div class="action-details">
            <span class="action-label">${escapeHtml(act.label || 'Action Item')}</span>
            <span class="action-target" title="${escapeHtml(act.target || '')}">${escapeHtml(act.target || '')}</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          ${actionControlHtml}
        </div>
      `;

      actionsList.appendChild(card);
    });

    // Wire up dynamic copy buttons
    actionsList.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const textToCopy = btn.dataset.copy;
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy);
          showToast(`Copied "${textToCopy}" to clipboard!`);
        }
      });
    });
  }
}

function resetOutcomeView() {
  outcomeLoading.style.display = 'none';
  resultContent.style.display = 'none';
  outcomeEmpty.style.display = 'flex';
  terminalStatusBadge.className = 'terminal-badge';
  terminalStatusText.textContent = 'STREAM IDLE';
  terminalMetric.style.display = 'none';
  copyJsonBtn.disabled = true;

  currentRawStream = '';
  currentParsedJson = null;
  currentPrompt = '';
  currentLatencyMs = null;
  currentTab = 'stream';

  document.querySelectorAll('.terminal-tab').forEach((t) => t.classList.remove('active'));
  tabStream.classList.add('active');
  renderTerminalView();
}

// Utility: Toast Notification
let toastTimeout;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
