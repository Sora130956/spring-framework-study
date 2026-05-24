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
