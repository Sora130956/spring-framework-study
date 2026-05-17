// Query the active tab's content script for current state
async function getContentState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
  } catch {
    return null;
  }
}

// Initialize: show annotation count for current page
(async function init() {
  const state = await getContentState();
  if (state) {
    document.getElementById('count').textContent = state.pageCount;
  } else {
    document.getElementById('count').textContent = '—';
    document.getElementById('page-info').textContent = '(Could not connect to page. Try refreshing.)';
  }
})();

// ---- Export JSON ----
document.getElementById('export-json').addEventListener('click', async () => {
  const state = await getContentState();
  if (!state || state.annotations.length === 0) {
    showStatus('No annotations to export.');
    return;
  }
  const json = JSON.stringify(state.annotations, null, 2);
  downloadFile(json, 'annotations.json', 'application/json');
  showStatus(`Exported ${state.annotations.length} annotations.`);
});

// ---- Export Note Format ----
document.getElementById('export-note').addEventListener('click', async () => {
  const state = await getContentState();
  if (!state || state.annotations.length === 0) {
    showStatus('No annotations to export.');
    return;
  }

  // Group annotations by URL
  const byUrl = new Map();
  for (const a of state.annotations) {
    if (!byUrl.has(a.url)) byUrl.set(a.url, []);
    byUrl.get(a.url).push(a);
  }

  // Build note format: one block per URL
  let output = '';
  for (const [url, entries] of byUrl) {
    output += `【${url}】\n`;
    for (const e of entries) {
      output += `【${e.text ?? ''}】\n`;
      output += `【${e.annotation ?? ''}】\n`;
    }
    output += '\n';
  }

  downloadFile(output.trim(), 'annotations.txt', 'text/plain');
  showStatus(`Exported ${state.annotations.length} annotations in note format.`);
});

// ---- Import JSON ----
document.getElementById('import-json').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Expected an array');
    for (const item of data) {
      if (!item.url || typeof item.text !== 'string' || typeof item.annotation !== 'string') {
        throw new Error('Invalid annotation format: each entry needs url, text, and annotation');
      }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    await chrome.tabs.sendMessage(tab.id, {
      type: 'LOAD_STATE',
      annotations: data
    });

    showStatus(`Imported ${data.length} annotations.`);
    // Refresh count
    const state = await getContentState();
    if (state) document.getElementById('count').textContent = state.pageCount;
  } catch (err) {
    showStatus('Import failed: ' + err.message);
  }

  // Reset file input
  e.target.value = '';
});

// ---- Helpers ----
let statusTimer = null;
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ''; statusTimer = null; }, 3000);
}
