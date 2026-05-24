# Focus Reader Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that enforces focused reading sessions for Spring docs — only whitelisted sites are accessible, reading time is auto-calculated from page word count, and sessions must be completed before time runs out to count toward stats.

**Architecture:** MV3 Chrome extension with Service Worker for timer state machine & DNR URL blocking, Content Script for in-page progress bar & scroll detection, Popup for session start/abandon, standalone Dashboard page (Chart.js) for stats, and a Settings page for WPM preset + daily goal.

**Tech Stack:** Vanilla JS (no bundler), Chart.js 4.x (CDN), Chrome Extension APIs (declarativeNetRequest, storage, alarms, scripting)

---

### Task 1: Project Scaffold & Manifest

**Files:**
- Create: `tools/focus-reader-extension/manifest.json`
- Create: `tools/focus-reader-extension/icons/icon-16.png`
- Create: `tools/focus-reader-extension/icons/icon-48.png`
- Create: `tools/focus-reader-extension/icons/icon-128.png`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p tools/focus-reader-extension/icons
mkdir -p tools/focus-reader-extension/background/rules
mkdir -p tools/focus-reader-extension/popup
mkdir -p tools/focus-reader-extension/content
mkdir -p tools/focus-reader-extension/blocked
mkdir -p tools/focus-reader-extension/dashboard
mkdir -p tools/focus-reader-extension/settings
```

- [ ] **Step 2: Write manifest.json**

Write `tools/focus-reader-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Focus Reader",
  "version": "1.0.0",
  "description": "Enforce focused reading sessions for Spring documentation with automatic time estimation.",
  "permissions": [
    "declarativeNetRequest",
    "storage",
    "alarms",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.spring.io/*",
    "*://chat.deepseek.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Focus Reader",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "block_all",
        "enabled": false,
        "path": "background/rules/dnr-rules.json"
      }
    ]
  },
  "content_scripts": [
    {
      "matches": ["*://*.spring.io/*", "*://chat.deepseek.com/*"],
      "js": ["content/content-script.js"],
      "css": ["content/progress-bar.css"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 3: Generate placeholder icons**

Use a simple solid-color SVG converted to PNG. For now, generate minimal 1-pixel placeholder PNGs via PowerShell:

```powershell
# 16x16 placeholder - solid green
$bytes = [System.IO.File]::ReadAllBytes((Get-Command python).Source -replace 'python.exe','')
# Instead use a simple approach: create minimal valid PNG files via raw bytes
# For v1 development, icons can be any valid PNG; we'll create colored squares

Add-Type -AssemblyName System.Drawing
foreach ($size in @(16, 48, 128)) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(76, 175, 80))
    $g.Dispose()
    $bmp.Save("tools/focus-reader-extension/icons/icon-$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
```

- [ ] **Step 4: Create initial empty source files so directory structure is complete**

```powershell
$null = New-Item -ItemType File -Force tools/focus-reader-extension/background/service-worker.js
$null = New-Item -ItemType File -Force tools/focus-reader-extension/popup/popup.html
$null = New-Item -ItemType File -Force tools/focus-reader-extension/popup/popup.js
$null = New-Item -ItemType File -Force tools/focus-reader-extension/content/content-script.js
$null = New-Item -ItemType File -Force tools/focus-reader-extension/content/progress-bar.css
$null = New-Item -ItemType File -Force tools/focus-reader-extension/blocked/blocked.html
$null = New-Item -ItemType File -Force tools/focus-reader-extension/dashboard/dashboard.html
$null = New-Item -ItemType File -Force tools/focus-reader-extension/dashboard/dashboard.js
$null = New-Item -ItemType File -Force tools/focus-reader-extension/dashboard/dashboard.css
$null = New-Item -ItemType File -Force tools/focus-reader-extension/settings/settings.html
$null = New-Item -ItemType File -Force tools/focus-reader-extension/settings/settings.js
```

- [ ] **Step 5: Commit**

```bash
git add tools/focus-reader-extension/
git commit -m "feat: scaffold Focus Reader extension directory structure and manifest"
```

---

### Task 2: DNR Rules File (Static)

**Files:**
- Write: `tools/focus-reader-extension/background/rules/dnr-rules.json`

- [ ] **Step 1: Write the static DNR rules file**

Write `tools/focus-reader-extension/background/rules/dnr-rules.json`:

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "redirect", "redirect": { "extensionPath": "/blocked/blocked.html" } },
    "condition": {
      "urlFilter": "*",
      "resourceTypes": ["main_frame"]
    }
  },
  {
    "id": 100,
    "priority": 100,
    "action": { "type": "allow" },
    "condition": {
      "urlFilter": "*://*.spring.io/*",
      "resourceTypes": ["main_frame"]
    }
  },
  {
    "id": 101,
    "priority": 100,
    "action": { "type": "allow" },
    "condition": {
      "urlFilter": "*://chat.deepseek.com/*",
      "resourceTypes": ["main_frame"]
    }
  },
  {
    "id": 102,
    "priority": 100,
    "action": { "type": "allow" },
    "condition": {
      "urlFilter": "*://*.spring.io",
      "resourceTypes": ["main_frame"]
    }
  }
]
```

The static rules file contains BOTH the block-all rule AND the allow rules. When enabled, allow rules (priority 100) match first for whitelisted domains, and the catch-all block rule (priority 1, redirect to blocked.html) handles everything else. This avoids needing dynamic rules at all.

- [ ] **Step 2: Commit**

```bash
git add tools/focus-reader-extension/background/rules/dnr-rules.json
git commit -m "feat: add static DNR rules — block-all + whitelist Spring and DeepSeek"
```

---

### Task 3: Background Service Worker — State Machine & Messaging

**Files:**
- Write: `tools/focus-reader-extension/background/service-worker.js`

- [ ] **Step 1: Write the service worker**

Write `tools/focus-reader-extension/background/service-worker.js`:

```javascript
// ---- State Machine ----
const STATE_IDLE = 'IDLE';
const STATE_RUNNING = 'RUNNING';

let currentState = STATE_IDLE;
let sessionStartTime = null;
let sessionDurationSeconds = 0;
let sessionUrl = '';
let sessionTitle = '';
let sessionWordCount = 0;
let sessionWpm = 200;
let alarmName = 'focusReaderTick';

// ---- Init: restore state from session storage ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.set({ state: STATE_IDLE });
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.session.get(['state']);
  currentState = data.state || STATE_IDLE;
  if (currentState === STATE_RUNNING) {
    // Session was active when browser closed → abort it
    await resetToIdle();
  }
});

// ---- Time formatting ----
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---- Enable/disable DNR rules ----
async function enableBlocking() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: ['block_all']
  });
}

async function disableBlocking() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: ['block_all']
  });
}

// ---- Start session ----
async function startSession({ url, title, wordCount, durationSeconds, wpm }) {
  sessionStartTime = Date.now();
  sessionDurationSeconds = durationSeconds;
  sessionUrl = url;
  sessionTitle = title;
  sessionWordCount = wordCount;
  sessionWpm = wpm;
  currentState = STATE_RUNNING;

  await chrome.storage.session.set({
    state: STATE_RUNNING,
    sessionStartTime,
    sessionDurationSeconds,
    sessionUrl,
    sessionTitle,
    sessionWordCount,
    sessionWpm
  });

  await enableBlocking();

  // Set alarm for timeout enforcement
  chrome.alarms.create(alarmName, { delayInMinutes: (durationSeconds / 60) + 0.05 });

  // Broadcast state to all tabs
  broadcastState();
}

// ---- Complete session ----
async function completeSession() {
  const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

  // Persist session record
  const record = {
    id: `session_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}`,
    url: sessionUrl,
    title: sessionTitle,
    wordCount: sessionWordCount,
    estimatedMinutes: Math.ceil(sessionDurationSeconds / 60),
    actualSeconds: elapsedSeconds,
    wpm: sessionWpm,
    completedAt: new Date().toISOString(),
    completed: true
  };

  const { sessions } = await chrome.storage.local.get({ sessions: [] });
  sessions.push(record);
  await chrome.storage.local.set({ sessions });

  await resetToIdle();
  return record;
}

// ---- Abort session ----
async function abortSession() {
  await resetToIdle();
}

// ---- Reset to IDLE ----
async function resetToIdle() {
  currentState = STATE_IDLE;
  sessionStartTime = null;
  sessionDurationSeconds = 0;
  await chrome.storage.session.set({ state: STATE_IDLE });
  await disableBlocking();
  await chrome.alarms.clear(alarmName);
  broadcastState();
}

// ---- Get remaining time ----
function getRemainingSeconds() {
  if (currentState !== STATE_RUNNING || !sessionStartTime) return 0;
  const elapsed = (Date.now() - sessionStartTime) / 1000;
  return Math.max(0, Math.ceil(sessionDurationSeconds - elapsed));
}

// ---- Get full state for popup/content ----
async function getFullState() {
  const todayMin = await getTodayTotal();
  const { sessions } = await chrome.storage.local.get({ sessions: [] });
  const settings = await getSettings();

  return {
    state: currentState,
    sessionUrl,
    sessionTitle,
    sessionWordCount,
    sessionDurationSeconds,
    sessionWpm,
    remainingSeconds: getRemainingSeconds(),
    todayMinutes: todayMin,
    streakDays: settings.streakDays,
    dailyGoalMinutes: settings.dailyGoalMinutes
  };
}

// ---- Today total ----
async function getTodayTotal() {
  const today = new Date().toISOString().slice(0, 10);
  const { sessions } = await chrome.storage.local.get({ sessions: [] });
  const todaySessions = sessions.filter(s => s.completedAt && s.completedAt.startsWith(today));
  const totalSeconds = todaySessions.reduce((sum, s) => sum + s.actualSeconds, 0);
  return Math.floor(totalSeconds / 60);
}

// ---- Settings ----
const DEFAULT_SETTINGS = {
  wpmPreset: 200,
  dailyGoalMinutes: 90,
  streakDays: 0,
  lastCompletedDate: ''
};

async function getSettings() {
  const data = await chrome.storage.local.get({ settings: DEFAULT_SETTINGS });
  return data.settings;
}

async function saveSettings(newSettings) {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };
  await chrome.storage.local.set({ settings: merged });
  return merged;
}

// ---- Streak update after completion ----
async function updateStreak() {
  const settings = await getSettings();
  const today = new Date().toISOString().slice(0, 10);
  const todayMin = await getTodayTotal();

  if (todayMin >= settings.dailyGoalMinutes) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (settings.lastCompletedDate === yesterday || settings.lastCompletedDate === today) {
      settings.streakDays += settings.lastCompletedDate === today ? 0 : 1;
    } else {
      settings.streakDays = 1;
    }
    settings.lastCompletedDate = today;
    await chrome.storage.local.set({ settings });
  }
}

// ---- Broadcast state to content scripts ----
async function broadcastState() {
  const fullState = await getFullState();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && (tab.url.includes('spring.io') || tab.url.includes('deepseek.com'))) {
      chrome.tabs.sendMessage(tab.id, { type: 'STATE_UPDATE', payload: fullState }).catch(() => {});
    }
  }
}

// ---- Alarms (timeout protection) ----
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === alarmName && currentState === STATE_RUNNING) {
    if (getRemainingSeconds() <= 0) {
      // Time's up — abort
      await abortSession();
      // Notify content scripts
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.includes('spring.io')) {
          chrome.tabs.sendMessage(tab.id, { type: 'TIME_UP' }).catch(() => {});
        }
      }
    }
  }
});

// ---- Message handler ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATE':
        sendResponse(await getFullState());
        break;

      case 'ANALYZE_PAGE': {
        const wordCount = countWords(message.text);
        const settings = await getSettings();
        const durationSeconds = Math.ceil((wordCount / settings.wpmPreset) * 60);
        sendResponse({ wordCount, durationSeconds, wpm: settings.wpmPreset });
        break;
      }

      case 'START_SESSION':
        await startSession(message.payload);
        sendResponse({ success: true });
        break;

      case 'COMPLETE_SESSION': {
        const record = await completeSession();
        await updateStreak();
        sendResponse({ success: true, record });
        break;
      }

      case 'ABORT_SESSION':
        await abortSession();
        sendResponse({ success: true });
        break;

      case 'GET_SETTINGS':
        sendResponse(await getSettings());
        break;

      case 'SAVE_SETTINGS':
        sendResponse(await saveSettings(message.payload));
        break;

      case 'GET_SESSIONS': {
        const { sessions } = await chrome.storage.local.get({ sessions: [] });
        sendResponse(sessions);
        break;
      }

      case 'EXPORT_DATA': {
        const data = await chrome.storage.local.get(null);
        sendResponse(data);
        break;
      }

      case 'IMPORT_DATA': {
        const imported = message.payload;
        const existing = await chrome.storage.local.get({ sessions: [] });
        const existingIds = new Set(existing.sessions.map(s => s.id));
        const newSessions = imported.sessions.filter(s => !existingIds.has(s.id));
        const merged = [...existing.sessions, ...newSessions];
        await chrome.storage.local.set({ sessions: merged });
        if (imported.settings) {
          await chrome.storage.local.set({ settings: imported.settings });
        }
        sendResponse({ imported: newSessions.length });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // async response
});

// ---- Helper: count English words ----
function countWords(text) {
  return text
    .split(/\s+/)
    .filter(w => w.length > 0 && /[a-zA-Z]/.test(w))
    .length;
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/focus-reader-extension/background/service-worker.js
git commit -m "feat: add background service worker with state machine, messaging, DNR control"
```

---

### Task 4: Content Script — Word Count & Page Analysis

**Files:**
- Write: `tools/focus-reader-extension/content/content-script.js`
- Write: `tools/focus-reader-extension/content/progress-bar.css`

- [ ] **Step 1: Write progress-bar.css**

Write `tools/focus-reader-extension/content/progress-bar.css`:

```css
#focus-reader-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  z-index: 2147483646;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.3s linear;
  width: 100%;
}

#focus-reader-progress-bar.warning {
  background: linear-gradient(90deg, #ff9800, #f57c00);
}

#focus-reader-progress-bar.danger {
  background: linear-gradient(90deg, #f44336, #d32f2f);
  animation: focus-reader-pulse 1s infinite;
}

@keyframes focus-reader-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

#focus-reader-time-label {
  position: fixed;
  top: 6px;
  right: 12px;
  z-index: 2147483646;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #4caf50;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 8px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

#focus-reader-time-label.warning { color: #ff9800; }
#focus-reader-time-label.danger { color: #f44336; }

#focus-reader-done-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483646;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #4caf50;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
}

#focus-reader-done-btn.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

#focus-reader-done-btn.cooldown {
  background: #9e9e9e;
  cursor: not-allowed;
}

#focus-reader-done-btn.done {
  background: #2196f3;
  pointer-events: none;
}

#focus-reader-status-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483645;
  background: rgba(0, 0, 0, 0.3);
  justify-content: center;
  align-items: center;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

#focus-reader-status-overlay.show {
  display: flex;
}

#focus-reader-status-overlay .message-box {
  background: #fff;
  border-radius: 12px;
  padding: 32px 40px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

#focus-reader-status-overlay h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #f44336;
}

#focus-reader-status-overlay p {
  margin: 0 0 16px;
  color: #666;
  font-size: 14px;
}

#focus-reader-status-overlay button {
  padding: 8px 24px;
  font-size: 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #f44336;
  color: #fff;
}
```

- [ ] **Step 2: Write content-script.js (Part 1 — word counting & page analysis)**

Write `tools/focus-reader-extension/content/content-script.js`:

```javascript
(function () {
  'use strict';

  // ---- State ----
  let timerInterval = null;
  let remainingSeconds = 0;
  let totalSeconds = 0;
  let sessionActive = false;
  let scrolledToBottom = false;
  let doneClicked = false;

  // ---- Extract text for word counting ----
  function extractPageText() {
    // Priority 1: <main> or <article>
    let container = document.querySelector('main') || document.querySelector('article');

    // Priority 2: content/body/doc class
    if (!container) {
      container = document.querySelector('[class*="content"], [id*="content"], [class*="doc"], [id*="doc"], [class*="body"], [id*="body"]');
    }

    // Priority 3: fallback to body
    if (!container) {
      container = document.body;
    }

    // Clone and remove excluded elements
    const clone = container.cloneNode(true);
    const exclude = clone.querySelectorAll('nav, footer, header, script, style, noscript');
    exclude.forEach(el => el.remove());

    return clone.textContent || '';
  }

  function countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w)).length;
  }

  // ---- Create progress bar UI ----
  function createProgressBar() {
    const bar = document.createElement('div');
    bar.id = 'focus-reader-progress-bar';
    document.body.appendChild(bar);

    const label = document.createElement('div');
    label.id = 'focus-reader-time-label';
    document.body.appendChild(label);

    // Push page content down
    document.documentElement.style.paddingTop = '4px';
  }

  function createDoneButton() {
    const btn = document.createElement('button');
    btn.id = 'focus-reader-done-btn';
    btn.textContent = 'Done Reading ✓';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      if (btn.classList.contains('cooldown') || btn.classList.contains('done')) return;

      // Cooldown
      btn.classList.add('cooldown');
      btn.textContent = 'Confirm...';
      setTimeout(() => {
        if (!doneClicked) {
          btn.classList.remove('cooldown');
          btn.textContent = 'Done Reading ✓';
        }
      }, 2000);

      // Second click within cooldown
      btn.addEventListener('click', function handler() {
        if (btn.classList.contains('cooldown') && !doneClicked) {
          doneClicked = true;
          btn.classList.remove('cooldown');
          btn.classList.add('done');
          btn.textContent = 'Done ✓ Recorded';
          chrome.runtime.sendMessage({ type: 'COMPLETE_SESSION' });
        }
        btn.removeEventListener('click', handler);
      });
    });
  }

  function createTimeUpOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'focus-reader-status-overlay';
    overlay.innerHTML = `
      <div class="message-box">
        <h2>Time's Up</h2>
        <p>This session will not be counted.</p>
        <button id="focus-reader-abandon-btn">OK</button>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#focus-reader-abandon-btn').addEventListener('click', () => {
      overlay.classList.remove('show');
      chrome.runtime.sendMessage({ type: 'ABORT_SESSION' });
    });
  }

  // ---- Update progress bar ----
  function updateProgressBar() {
    if (!sessionActive) return;

    const elapsed = totalSeconds - remainingSeconds;
    const pct = (remainingSeconds / totalSeconds) * 100;
    const bar = document.getElementById('focus-reader-progress-bar');
    const label = document.getElementById('focus-reader-time-label');

    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.remove('warning', 'danger');
      if (pct <= 10) bar.classList.add('danger');
      else if (pct <= 30) bar.classList.add('warning');
    }

    if (label) {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      label.textContent = `${m}:${String(s).padStart(2, '0')} remaining`;
      label.classList.remove('warning', 'danger');
      if (pct <= 10) label.classList.add('danger');
      else if (pct <= 30) label.classList.add('warning');
    }
  }

  // ---- Scroll detection ----
  function checkScroll() {
    if (!sessionActive || doneClicked) return;

    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const btn = document.getElementById('focus-reader-done-btn');

    if (docHeight - scrollBottom <= 50 && !scrolledToBottom) {
      scrolledToBottom = true;
      if (btn) btn.classList.add('visible');
    }
  }

  // ---- Timer tick ----
  function tick() {
    if (!sessionActive) return;
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    updateProgressBar();

    if (remainingSeconds <= 0) {
      // Time's up locally
      stopTimer();
    }
  }

  function startTimer(durationSec) {
    totalSeconds = durationSec;
    remainingSeconds = durationSec;
    sessionActive = true;
    updateProgressBar();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    sessionActive = false;
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ---- Visibility change — sync with SW ----
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(timerInterval);
      timerInterval = null;
    } else if (sessionActive) {
      // Re-sync with service worker
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
        if (state && state.state === 'RUNNING') {
          remainingSeconds = state.remainingSeconds;
          totalSeconds = state.sessionDurationSeconds;
          updateProgressBar();
          timerInterval = setInterval(tick, 1000);
        }
      });
    }
  });

  // ---- Periodic re-sync (every 30s) ----
  setInterval(() => {
    if (!sessionActive) return;
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
      if (state && state.state === 'RUNNING') {
        remainingSeconds = state.remainingSeconds;
      } else if (!state || state.state !== 'RUNNING') {
        stopTimer();
        cleanupUI();
      }
    });
  }, 30000);

  // ---- Scroll listener ----
  window.addEventListener('scroll', checkScroll, { passive: true });

  // ---- Cleanup ----
  function cleanupUI() {
    ['focus-reader-progress-bar', 'focus-reader-time-label', 'focus-reader-done-btn', 'focus-reader-status-overlay']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    document.documentElement.style.paddingTop = '';
  }

  // ---- Message listener ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'STATE_UPDATE': {
        const { state, remainingSeconds: rem } = message.payload;
        if (state === 'RUNNING' && !sessionActive) {
          startTimer(rem);
        } else if (state !== 'RUNNING' && sessionActive) {
          stopTimer();
          cleanupUI();
        }
        break;
      }
      case 'TIME_UP': {
        stopTimer();
        const overlay = document.getElementById('focus-reader-status-overlay');
        if (overlay) overlay.classList.add('show');
        break;
      }
      case 'GET_PAGE_TEXT': {
        const text = extractPageText();
        sendResponse({ text, wordCount: countWords(text), title: document.title, url: location.href });
        return true;
      }
    }
  });

  // ---- Initialize ----
  createProgressBar();
  createDoneButton();
  createTimeUpOverlay();
  updateProgressBar();
})();
```

- [ ] **Step 3: Commit**

```bash
git add tools/focus-reader-extension/content/
git commit -m "feat: add content script — word count, progress bar, scroll detection, done button"
```

---

### Task 5: Blocked Page (Interception)

**Files:**
- Write: `tools/focus-reader-extension/blocked/blocked.html`

- [ ] **Step 1: Write blocked.html**

Write `tools/focus-reader-extension/blocked/blocked.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Reader — Blocked</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f5f5;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      box-shadow: 0 2px 16px rgba(0,0,0,0.08);
      max-width: 400px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
    .info { color: #999; font-size: 12px; margin-bottom: 24px; }
    button {
      padding: 10px 32px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      background: #4caf50;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    button:hover { background: #43a047; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x1F6D1;</div>
    <h1>Focused Reading in Progress</h1>
    <p>This website is not on the whitelist. Only Spring documentation and chat.deepseek.com are accessible during a reading session.</p>
    <p id="remaining" class="info"></p>
    <button id="go-back">Return to Reading</button>
  </div>
  <script src="blocked.js"></script>
</body>
</html>
```

Remove the `<script>` reference — blocked.html cannot load external scripts due to extension CSP. Use inline script instead:

Edit the file to replace the script tag with inline script:

```html
  <script>
    (async () => {
      // Try to go back to the Spring doc tab
      const tabs = await chrome.tabs.query({ url: ['*://*.spring.io/*', '*://chat.deepseek.com/*'] });
      if (tabs.length > 0) {
        document.getElementById('go-back').addEventListener('click', () => {
          chrome.tabs.update(tabs[0].id, { active: true });
        });
        document.getElementById('remaining').textContent =
          `There ${tabs.length === 1 ? 'is' : 'are'} ${tabs.length} allowed tab${tabs.length > 1 ? 's' : ''} open.`;
      } else {
        document.getElementById('go-back').disabled = true;
        document.getElementById('go-back').textContent = 'No reading tab found';
        document.getElementById('remaining').textContent = 'Open a Spring doc page to continue.';
      }
    })();
  </script>
```

- [ ] **Step 2: Commit**

```bash
git add tools/focus-reader-extension/blocked/
git commit -m "feat: add blocked page for non-whitelist URL interception"
```

---

### Task 6: Popup — IDLE View & Start Flow

**Files:**
- Write: `tools/focus-reader-extension/popup/popup.html`
- Write: `tools/focus-reader-extension/popup/popup.js`

- [ ] **Step 1: Write popup.html**

Write `tools/focus-reader-extension/popup/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Reader</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 300px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #333;
      background: #fff;
    }
    .container { padding: 16px; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .header .logo { font-size: 20px; }
    .header h2 { font-size: 16px; font-weight: 700; }

    /* Page info */
    .page-info {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .page-info .title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .page-info .url {
      font-size: 11px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stats-row {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: #666;
    }
    .stats-row span { font-weight: 600; color: #333; }

    /* WPM selector */
    .wpm-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .wpm-row select {
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
    }

    /* Button */
    .btn {
      width: 100%;
      padding: 12px;
      font-size: 14px;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      color: #fff;
    }
    .btn-primary { background: #4caf50; }
    .btn-primary:hover { background: #43a047; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
    .btn-danger { background: #e53935; }
    .btn-danger:hover { background: #c62828; }
    .btn-secondary {
      background: transparent;
      color: #4caf50;
      border: 1px solid #4caf50;
      font-weight: 600;
      font-size: 12px;
      padding: 8px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid #eee;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #999;
    }
    .footer .streak { color: #ff9800; font-weight: 600; }

    /* Running view */
    .timer-display {
      text-align: center;
      font-size: 36px;
      font-weight: 700;
      color: #4caf50;
      margin: 8px 0;
    }
    .timer-display.danger { color: #f44336; }
    .timer-display.warning { color: #ff9800; }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #eee;
      border-radius: 3px;
      margin: 8px 0 16px;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: #4caf50;
      transition: width 0.3s;
    }
    .progress-bar-fill.warning { background: #ff9800; }
    .progress-bar-fill.danger { background: #f44336; }

    .abandon-link {
      display: block;
      text-align: center;
      font-size: 11px;
      color: #ccc;
      cursor: pointer;
      margin-top: 8px;
    }
    .abandon-link:hover { color: #e53935; }

    .hidden { display: none; }
  </style>
</head>
<body>
  <!-- IDLE View -->
  <div id="idle-view" class="container">
    <div class="header">
      <span class="logo">&#x1F50D;</span>
      <h2>Focus Reader</h2>
    </div>

    <div id="page-details" class="page-info hidden">
      <div id="page-title" class="title"></div>
      <div id="page-url" class="url"></div>
      <div class="stats-row">
        Words: <span id="word-count">--</span>
        Est. time: <span id="est-time">--</span>
      </div>
    </div>

    <div id="not-spring-msg" class="page-info hidden">
      <p style="font-size:13px;color:#999;text-align:center;">Please open a Spring documentation page to start reading.</p>
    </div>

    <div class="wpm-row">
      <label>Reading speed</label>
      <select id="wpm-select">
        <option value="150">Slow (150 WPM)</option>
        <option value="200" selected>Normal (200 WPM)</option>
        <option value="250">Fast (250 WPM)</option>
        <option value="300">Skim (300 WPM)</option>
      </select>
    </div>

    <button id="start-btn" class="btn btn-primary" disabled>Start Reading</button>
  </div>

  <!-- RUNNING View -->
  <div id="running-view" class="container hidden">
    <div class="header">
      <span class="logo">&#x23F3;</span>
      <h2>Reading in focus...</h2>
    </div>
    <div id="running-title" class="page-info" style="text-align:center;">
      <div class="title"></div>
    </div>
    <div id="timer-display" class="timer-display">--:--</div>
    <div class="progress-bar-bg">
      <div id="progress-fill" class="progress-bar-fill" style="width:100%;"></div>
    </div>
    <p style="text-align:center;font-size:12px;color:#999;">Finish reading before time's up</p>
    <span id="abandon-link" class="abandon-link">Abandon reading</span>
  </div>

  <!-- ABANDON Confirm -->
  <div id="abandon-confirm" class="container hidden">
    <p style="text-align:center;margin-bottom:12px;">Confirm abandon?</p>
    <p style="text-align:center;font-size:12px;color:#e53935;margin-bottom:12px;">&#x274C; This session won't be counted.</p>
    <button id="abandon-yes" class="btn btn-danger" style="margin-bottom:8px;">Yes, Abandon</button>
    <button id="abandon-no" class="btn btn-secondary">Keep Reading</button>
  </div>

  <!-- Footer -->
  <div id="footer-bar" class="footer">
    <span id="footer-today">Today: -- min</span>
    <span id="footer-streak" class="streak">--</span>
    <a href="#" id="open-dashboard" style="color:#4caf50;text-decoration:none;">Full stats &rarr;</a>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write popup.js**

Write `tools/focus-reader-extension/popup/popup.js`:

```javascript
(function () {
  'use strict';

  // ---- Elements ----
  const idleView = document.getElementById('idle-view');
  const runningView = document.getElementById('running-view');
  const abandonConfirm = document.getElementById('abandon-confirm');
  const pageDetails = document.getElementById('page-details');
  const notSpringMsg = document.getElementById('not-spring-msg');
  const pageTitle = document.getElementById('page-title');
  const pageUrl = document.getElementById('page-url');
  const wordCount = document.getElementById('word-count');
  const estTime = document.getElementById('est-time');
  const wpmSelect = document.getElementById('wpm-select');
  const startBtn = document.getElementById('start-btn');
  const timerDisplay = document.getElementById('timer-display');
  const progressFill = document.getElementById('progress-fill');
  const runningTitle = document.getElementById('running-title').querySelector('.title');
  const abandonLink = document.getElementById('abandon-link');
  const abandonYes = document.getElementById('abandon-yes');
  const abandonNo = document.getElementById('abandon-no');
  const footerToday = document.getElementById('footer-today');
  const footerStreak = document.getElementById('footer-streak');
  const openDashboard = document.getElementById('open-dashboard');

  let pageWordCount = 0;
  let estimatedDuration = 0;
  let currentWpm = 200;
  let isSpringPage = false;
  let timerInterval = null;

  // ---- Load current WPM from settings ----
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
    if (settings && settings.wpmPreset) {
      currentWpm = settings.wpmPreset;
      wpmSelect.value = currentWpm;
    }
  });

  // ---- Check current tab ----
  async function checkCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return;

    isSpringPage = tab.url && tab.url.includes('spring.io');

    if (isSpringPage) {
      pageDetails.classList.remove('hidden');
      notSpringMsg.classList.add('hidden');
      startBtn.disabled = false;
      pageTitle.textContent = tab.title || '';
      pageUrl.textContent = new URL(tab.url).hostname;

      // Get page text for word count
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_TEXT' });
        pageWordCount = response.wordCount;
        wordCount.textContent = pageWordCount.toLocaleString();
        updateEstimate();
      } catch (e) {
        wordCount.textContent = '--';
        estTime.textContent = '--';
      }
    } else {
      pageDetails.classList.add('hidden');
      notSpringMsg.classList.remove('hidden');
      startBtn.disabled = true;
    }
  }

  function updateEstimate() {
    estimatedDuration = Math.ceil((pageWordCount / currentWpm) * 60);
    const m = Math.ceil(estimatedDuration / 60);
    estTime.textContent = `~${m} min`;
  }

  wpmSelect.addEventListener('change', () => {
    currentWpm = parseInt(wpmSelect.value);
    updateEstimate();
  });

  // ---- Start session ----
  startBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    chrome.runtime.sendMessage({
      type: 'START_SESSION',
      payload: {
        url: tab.url,
        title: tab.title,
        wordCount: pageWordCount,
        durationSeconds: estimatedDuration,
        wpm: currentWpm
      }
    }, (response) => {
      if (response && response.success) {
        showRunningView();
      }
    });
  });

  // ---- Show running view ----
  function showRunningView() {
    idleView.classList.add('hidden');
    abandonConfirm.classList.add('hidden');
    runningView.classList.remove('hidden');

    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
      if (state && state.state === 'RUNNING') {
        runningTitle.textContent = state.sessionTitle || '';
        startRunningTimer(state.remainingSeconds, state.sessionDurationSeconds);
      }
    });
  }

  function startRunningTimer(remaining, total) {
    let rem = remaining;
    const totalSec = total;
    timerDisplay.textContent = formatTime(rem);
    updateProgressBar(rem, totalSec);

    timerInterval = setInterval(() => {
      rem = Math.max(0, rem - 1);
      timerDisplay.textContent = formatTime(rem);
      updateProgressBar(rem, totalSec);

      if (rem <= 0) {
        clearInterval(timerInterval);
      }
    }, 1000);
  }

  function updateProgressBar(remaining, total) {
    const pct = (remaining / total) * 100;
    progressFill.style.width = pct + '%';
    progressFill.classList.remove('warning', 'danger');
    timerDisplay.classList.remove('warning', 'danger');

    if (pct <= 10) {
      progressFill.classList.add('danger');
      timerDisplay.classList.add('danger');
    } else if (pct <= 30) {
      progressFill.classList.add('warning');
      timerDisplay.classList.add('warning');
    }
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---- Abandon ----
  abandonLink.addEventListener('click', () => {
    runningView.classList.add('hidden');
    abandonConfirm.classList.remove('hidden');
  });

  abandonNo.addEventListener('click', () => {
    abandonConfirm.classList.add('hidden');
    runningView.classList.remove('hidden');
  });

  abandonYes.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'ABORT_SESSION' }, () => {
      clearInterval(timerInterval);
      abandonConfirm.classList.add('hidden');
      idleView.classList.remove('hidden');
      loadFooter();
      checkCurrentTab();
    });
  });

  // ---- Dashboard link ----
  openDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  // ---- Footer stats ----
  async function loadFooter() {
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (state) {
      footerToday.textContent = `Today: ${state.todayMinutes} min`;
      if (state.streakDays > 0) {
        footerStreak.innerHTML = `&#x1F525; ${state.streakDays}d`;
      } else {
        footerStreak.textContent = '';
      }
    }
  }

  // ---- Init ----
  async function init() {
    // Check current state first
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

    if (state && state.state === 'RUNNING') {
      showRunningView();
    } else {
      await checkCurrentTab();
    }

    await loadFooter();
  }

  init();
})();
```

- [ ] **Step 3: Commit**

```bash
git add tools/focus-reader-extension/popup/
git commit -m "feat: add popup with IDLE/RUNNING views, WPM selector, and abandon flow"
```

---

### Task 7: Dashboard Page

**Files:**
- Write: `tools/focus-reader-extension/dashboard/dashboard.html`
- Write: `tools/focus-reader-extension/dashboard/dashboard.js`
- Write: `tools/focus-reader-extension/dashboard/dashboard.css`

- [ ] **Step 1: Write dashboard.html**

Write `tools/focus-reader-extension/dashboard/dashboard.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Reader — Stats</title>
  <link rel="stylesheet" href="dashboard.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="app">
    <header>
      <h1>&#x1F4CA; Focus Stats</h1>
      <a href="#" id="open-settings" class="settings-link">&#x2699; Settings</a>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Today</div>
        <div id="stat-today" class="stat-value">-- min</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Streak</div>
        <div id="stat-streak" class="stat-value">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Words</div>
        <div id="stat-total-words" class="stat-value">--</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Daily Goal</div>
        <div id="stat-goal" class="stat-value">-- / -- min</div>
        <div class="goal-bar-bg"><div id="goal-bar-fill" class="goal-bar-fill"></div></div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-container">
        <h3>Weekly Focus (minutes)</h3>
        <canvas id="weekly-chart"></canvas>
      </div>
      <div class="chart-container">
        <h3>Reading Speed Trend (WPM)</h3>
        <canvas id="speed-chart"></canvas>
      </div>
    </div>

    <div class="sessions-section">
      <h3>Recent Sessions</h3>
      <div id="sessions-list"></div>
    </div>

    <div class="export-section">
      <button id="export-btn">Export JSON</button>
      <button id="import-btn">Import JSON</button>
      <input type="file" id="import-file" accept=".json" style="display:none;">
    </div>
  </div>

  <script src="dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write dashboard.css**

Write `tools/focus-reader-extension/dashboard/dashboard.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #f9fafb;
  color: #333;
}
.app { max-width: 800px; margin: 0 auto; padding: 32px 20px; }

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
header h1 { font-size: 24px; }
.settings-link {
  color: #4caf50;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.stat-label { font-size: 11px; color: #999; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 22px; font-weight: 700; }
.goal-bar-bg {
  width: 100%;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  margin-top: 8px;
}
.goal-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: #4caf50;
  transition: width 0.3s;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}
.chart-container {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.chart-container h3 { font-size: 13px; color: #666; margin-bottom: 12px; }
.chart-container canvas { max-height: 200px; }

.sessions-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 24px;
}
.sessions-section h3 { font-size: 13px; color: #666; margin-bottom: 12px; }
.session-row {
  display: grid;
  grid-template-columns: 60px 1fr 70px 50px 30px;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}
.session-row:last-child { border-bottom: none; }
.session-date { color: #999; font-size: 12px; }
.session-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-est { color: #999; font-size: 12px; }
.session-actual { font-weight: 600; }

.export-section {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.export-section button {
  padding: 8px 20px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.export-section button:hover { background: #f5f5f5; }
```

- [ ] **Step 3: Write dashboard.js**

Write `tools/focus-reader-extension/dashboard/dashboard.js`:

```javascript
(function () {
  'use strict';

  let weeklyChart = null;
  let speedChart = null;

  // ---- Load data ----
  async function loadDashboard() {
    const sessions = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' });
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

    renderStats(sessions, settings);
    renderWeeklyChart(sessions);
    renderSpeedChart(sessions);
    renderSessionsList(sessions);
  }

  // ---- Stats cards ----
  function renderStats(sessions, settings) {
    const today = new Date().toISOString().slice(0, 10);
    const todaySessions = sessions.filter(s => s.completedAt && s.completedAt.startsWith(today));
    const todaySeconds = todaySessions.reduce((sum, s) => sum + s.actualSeconds, 0);
    const todayMin = Math.floor(todaySeconds / 60);
    const totalWords = sessions.reduce((sum, s) => sum + (s.wordCount || 0), 0);

    document.getElementById('stat-today').textContent = todayMin + ' min';
    document.getElementById('stat-streak').innerHTML =
      settings.streakDays > 0 ? `&#x1F525; ${settings.streakDays}d` : '--';
    document.getElementById('stat-total-words').textContent = totalWords.toLocaleString();
    document.getElementById('stat-goal').textContent =
      `${todayMin} / ${settings.dailyGoalMinutes} min`;

    const goalPct = Math.min(100, (todayMin / settings.dailyGoalMinutes) * 100);
    const goalBar = document.getElementById('goal-bar-fill');
    goalBar.style.width = goalPct + '%';
    if (todayMin >= settings.dailyGoalMinutes) {
      goalBar.style.background = '#4caf50';
    }
  }

  // ---- Weekly chart ----
  function renderWeeklyChart(sessions) {
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    if (weeklyChart) weeklyChart.destroy();

    const days = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      const daySessions = sessions.filter(s => s.completedAt && s.completedAt.startsWith(dateStr));
      const totalMin = Math.floor(daySessions.reduce((sum, s) => sum + s.actualSeconds, 0) / 60);
      days.push(dayLabel);
      data.push(totalMin);
    }

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Minutes',
          data,
          backgroundColor: '#4caf50',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 11 } } },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ---- Speed trend chart ----
  function renderSpeedChart(sessions) {
    const ctx = document.getElementById('speed-chart').getContext('2d');
    if (speedChart) speedChart.destroy();

    const completed = sessions.filter(s => s.completed).slice(-30);
    const labels = completed.map(s => {
      const d = new Date(s.completedAt);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const wpms = completed.map(s => {
      if (!s.actualSeconds || s.actualSeconds <= 0) return null;
      return Math.round((s.wordCount / s.actualSeconds) * 60);
    });

    speedChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'WPM',
          data: wpms,
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33,150,243,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, ticks: { font: { size: 11 } } },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ---- Sessions list ----
  function renderSessionsList(sessions) {
    const list = document.getElementById('sessions-list');
    const recent = [...sessions].filter(s => s.completed).reverse().slice(0, 20);

    list.innerHTML = recent.map(s => {
      const date = new Date(s.completedAt);
      const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const estMin = Math.ceil(s.actualSeconds / 60);
      return `
        <div class="session-row">
          <span class="session-date">${dateStr}</span>
          <span class="session-title" title="${s.title}">${s.title}</span>
          <span class="session-est">~${s.estimatedMinutes}m</span>
          <span class="session-actual">${Math.floor(s.actualSeconds / 60)}m ${s.actualSeconds % 60}s</span>
          <span style="color:#4caf50;">&#x2713;</span>
        </div>`;
    }).join('');

    if (recent.length === 0) {
      list.innerHTML = '<p style="color:#999;text-align:center;padding:24px;">No completed sessions yet. Start reading on a Spring doc page!</p>';
    }
  }

  // ---- Export ----
  document.getElementById('export-btn').addEventListener('click', async () => {
    const data = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---- Import ----
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      alert('Invalid JSON file.');
      return;
    }
    const result = await chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: data });
    alert(`Imported ${result.imported} new session(s).`);
    loadDashboard();
  });

  // ---- Settings link ----
  document.getElementById('open-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });

  // ---- Init ----
  loadDashboard();
})();
```

- [ ] **Step 4: Commit**

```bash
git add tools/focus-reader-extension/dashboard/
git commit -m "feat: add dashboard page with Chart.js stats, session list, and data export/import"
```

---

### Task 8: Settings Page

**Files:**
- Write: `tools/focus-reader-extension/settings/settings.html`
- Write: `tools/focus-reader-extension/settings/settings.js`

- [ ] **Step 1: Write settings.html**

Write `tools/focus-reader-extension/settings/settings.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Reader — Settings</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #f9fafb;
      color: #333;
    }
    .app { max-width: 480px; margin: 0 auto; padding: 32px 20px; }
    header { margin-bottom: 24px; }
    header h1 { font-size: 20px; }
    header a { color: #4caf50; text-decoration: none; font-size: 13px; }
    .section {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .section h3 { font-size: 14px; margin-bottom: 12px; color: #666; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 13px; margin-bottom: 4px; font-weight: 600; }
    .field select, .field input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    }
    .hint { font-size: 11px; color: #999; margin-top: 4px; }
    .save-btn {
      width: 100%;
      padding: 12px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: #4caf50;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .save-btn:hover { background: #43a047; }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 24px;
      border-radius: 20px;
      font-size: 13px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>&#x2699; Settings</h1>
      <a href="#" id="back-link">&larr; Back to Dashboard</a>
    </header>

    <div class="section">
      <h3>Reading Speed</h3>
      <div class="field">
        <label for="wpm-preset">WPM Preset</label>
        <select id="wpm-preset">
          <option value="150">Slow (150 WPM) — New to English technical reading</option>
          <option value="200">Normal (200 WPM) — Comfortable pace</option>
          <option value="250">Fast (250 WPM) — Experienced reader</option>
          <option value="300">Skim (300 WPM) — Scanning / review</option>
        </select>
        <p class="hint">Estimated reading time = page word count / WPM. Higher WPM = less time given per page.</p>
      </div>
    </div>

    <div class="section">
      <h3>Daily Goal</h3>
      <div class="field">
        <label for="daily-goal">Daily focus target (minutes)</label>
        <input type="number" id="daily-goal" min="10" max="480" step="5">
        <p class="hint">Must reach this target for the day to count toward your streak. Recommended: 30–120 min.</p>
      </div>
    </div>

    <button id="save-btn" class="save-btn">Save Settings</button>
  </div>

  <div id="toast" class="toast">Settings saved</div>

  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write settings.js**

Write `tools/focus-reader-extension/settings/settings.js`:

```javascript
(function () {
  'use strict';

  const wpmSelect = document.getElementById('wpm-preset');
  const dailyGoalInput = document.getElementById('daily-goal');
  const saveBtn = document.getElementById('save-btn');
  const toast = document.getElementById('toast');
  const backLink = document.getElementById('back-link');

  // Load current settings
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
    if (settings) {
      wpmSelect.value = settings.wpmPreset || 200;
      dailyGoalInput.value = settings.dailyGoalMinutes || 90;
    }
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      wpmPreset: parseInt(wpmSelect.value),
      dailyGoalMinutes: parseInt(dailyGoalInput.value)
    };
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: newSettings });

    // Show toast
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });

  // Back
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });
})();
```

- [ ] **Step 3: Commit**

```bash
git add tools/focus-reader-extension/settings/
git commit -m "feat: add settings page for WPM preset and daily goal configuration"
```

---

### Task 9: Integration — End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Load the extension in Chrome**

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `tools/focus-reader-extension/`
4. Verify extension appears with green icon and no errors

- [ ] **Step 2: Verify IDLE popup on Spring page**

1. Navigate to `https://docs.spring.io/spring-framework/reference/core/beans/definition.html`
2. Click the extension icon
3. Verify: popup shows page title, word count, estimated time, WPM selector, "Start Reading" button enabled

- [ ] **Step 3: Verify popup on non-Spring page**

1. Navigate to `https://www.google.com`
2. Click the extension icon
3. Verify: "Please open a Spring documentation page" message, start button disabled

- [ ] **Step 4: Verify start flow**

1. Navigate to a Spring doc page
2. Click "Start Reading" in popup
3. Verify: popup switches to RUNNING view with countdown
4. Verify: page shows green progress bar at top with time label
5. Verify: try navigating to `https://www.google.com` → redirected to blocked.html

- [ ] **Step 5: Verify "Done Reading" flow**

1. Scroll to the very bottom of the Spring doc page
2. Verify: green "Done Reading ✓" button appears in bottom-right
3. Click once → button says "Confirm..." (cooldown)
4. Click again → button says "Done ✓ Recorded"
5. Verify: popup returns to IDLE state
6. Navigate to `https://www.google.com` → should succeed (blocking disabled)

- [ ] **Step 6: Verify abandon flow**

1. Start a new session
2. Click extension icon → "Abandon reading" → "Yes, Abandon"
3. Verify: popup returns to IDLE, session not in dashboard

- [ ] **Step 7: Verify timeout behavior**

1. Start a new session on a short page (or set WPM to 300 on a page with few words)
2. Wait for time to run out
3. Verify: progress bar turns red, overlay shows "Time's Up"
4. Verify: session not recorded in dashboard

- [ ] **Step 8: Verify dashboard**

1. Complete at least 2 sessions
2. Open dashboard (click "Full stats →" in popup footer)
3. Verify: today minutes, streak (if goal met), total words, goal progress bar
4. Verify: weekly chart shows completed session minutes
5. Verify: speed trend chart has data points
6. Verify: recent sessions list shows completed sessions

- [ ] **Step 9: Verify settings**

1. Open Settings from dashboard
2. Change WPM to "Fast (250)" and daily goal to 60 min
3. Save → verify toast
4. Start a new reading session → verify estimated time recalculated with new WPM

- [ ] **Step 10: Verify export/import**

1. In dashboard, click "Export JSON" → verify file downloads
2. Click "Import JSON" → select the exported file
3. Verify: "Imported 0 new session(s)" (already in storage, deduped)

- [ ] **Step 11: Commit**

```bash
git add tools/focus-reader-extension/
git commit -m "feat: complete Focus Reader extension — end-to-end integration verified"
```

---

## Task Order Summary

```
Task 1  → Scaffold + manifest
Task 2  → DNR rules
Task 3  → Service Worker (state machine + messaging)
Task 4  → Content Script (word count + progress bar + scroll + done)
Task 5  → Blocked page
Task 6  → Popup (IDLE + RUNNING views)
Task 7  → Dashboard (stats + charts)
Task 8  → Settings page
Task 9  → Integration verification
```
