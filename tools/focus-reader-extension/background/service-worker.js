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
  sessionUrl = '';
  sessionTitle = '';
  sessionWordCount = 0;
  sessionWpm = 200;
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
    dailyGoalMinutes: getEffectiveDailyGoal(settings)
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
  dailyGoalWeekdayMinutes: 120,
  dailyGoalWeekendMinutes: 360,
  streakDays: 0,
  lastCompletedDate: ''
};

function getEffectiveDailyGoal(settings) {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6
    ? settings.dailyGoalWeekendMinutes
    : settings.dailyGoalWeekdayMinutes;
}

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

  if (settings.lastCompletedDate === today) return; // already counted today

  const todayMin = await getTodayTotal();

  if (todayMin >= getEffectiveDailyGoal(settings)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (settings.lastCompletedDate === yesterday) {
      settings.streakDays += 1;
    } else {
      settings.streakDays = 1;
    }
    settings.lastCompletedDate = today;
    await chrome.storage.local.set({ settings });
  }
}

// ---- Broadcast state to content scripts ----
async function broadcastState() {
  try {
    const fullState = await getFullState();
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && (tab.url.includes('spring.io') || tab.url.includes('deepseek.com'))) {
        chrome.tabs.sendMessage(tab.id, { type: 'STATE_UPDATE', payload: fullState }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Focus Reader: broadcastState failed', err);
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
    try {
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
          if (currentState !== STATE_IDLE) {
            sendResponse({ success: false, error: 'Session already in progress' });
            break;
          }
          await startSession(message.payload);
          sendResponse({ success: true });
          break;

        case 'COMPLETE_SESSION': {
          if (currentState !== STATE_RUNNING) {
            sendResponse({ success: false, error: 'No active session' });
            break;
          }
          const record = await completeSession();
          await updateStreak();
          sendResponse({ success: true, record });
          break;
        }

        case 'ABORT_SESSION':
          if (currentState !== STATE_RUNNING) {
            sendResponse({ success: false, error: 'No active session' });
            break;
          }
          await abortSession();
          sendResponse({ success: true });
          break;

        case 'GET_SETTINGS': {
          const s = await getSettings();
          sendResponse({ ...s, dailyGoalMinutes: getEffectiveDailyGoal(s) });
          break;
        }

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
    } catch (err) {
      console.error('Focus Reader: message handler error', err);
      sendResponse({ success: false, error: err.message });
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
