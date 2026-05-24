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
