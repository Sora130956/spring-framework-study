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
