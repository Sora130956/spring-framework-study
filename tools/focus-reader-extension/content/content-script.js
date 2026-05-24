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
