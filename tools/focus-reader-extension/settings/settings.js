(function () {
  'use strict';

  const wpmSelect = document.getElementById('wpm-preset');
  const weekdayGoalInput = document.getElementById('weekday-goal');
  const weekendGoalInput = document.getElementById('weekend-goal');
  const saveBtn = document.getElementById('save-btn');
  const toast = document.getElementById('toast');
  const backLink = document.getElementById('back-link');

  // Load current settings
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
    if (settings) {
      wpmSelect.value = settings.wpmPreset || 200;
      weekdayGoalInput.value = settings.dailyGoalWeekdayMinutes || 120;
      weekendGoalInput.value = settings.dailyGoalWeekendMinutes || 360;
    }
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      wpmPreset: parseInt(wpmSelect.value),
      dailyGoalWeekdayMinutes: parseInt(weekdayGoalInput.value),
      dailyGoalWeekendMinutes: parseInt(weekendGoalInput.value)
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
