// Cached state from content script
let cachedState = null;

// Query the active tab's content script for current state
async function getContentState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    cachedState = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
    return cachedState;
  } catch {
    cachedState = null;
    return null;
  }
}

// Sanitize page title into a valid filename
function sanitizeFilename(title) {
  if (!title || !title.trim()) return 'annotation';
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')   // replace invalid filename chars
    .replace(/\s+/g, ' ')            // collapse whitespace
    .replace(/\.+$/, '')             // strip trailing dots
    .substring(0, 120);              // limit length
}

// Get current page URL from active tab
async function getCurrentUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || '';
  } catch {
    return '';
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
  const state = cachedState || await getContentState();
  if (!state || state.annotations.length === 0) {
    showStatus('No annotations to export.');
    return;
  }
  const filename = sanitizeFilename(state.title) + '.json';
  const json = JSON.stringify(state.annotations, null, 2);
  downloadFile(json, filename, 'application/json');
  showStatus('Exported ' + state.annotations.length + ' annotations.');
});

// ---- Export Note Format ----
document.getElementById('export-note').addEventListener('click', async () => {
  const state = cachedState || await getContentState();
  if (!state || state.annotations.length === 0) {
    showStatus('No annotations to export.');
    return;
  }

  const currentUrl = await getCurrentUrl();

  // Filter to current page only
  const pageAnnotations = state.annotations.filter(function(a) {
    return a.url === currentUrl;
  });

  if (pageAnnotations.length === 0) {
    showStatus('No annotations on this page to export.');
    return;
  }

  // Build note format: one block per URL
  var output = '';
  output += '【' + currentUrl + '】\n';
  for (var i = 0; i < pageAnnotations.length; i++) {
    output += '【' + (pageAnnotations[i].text || '') + '】\n';
    output += '【' + (pageAnnotations[i].annotation || '') + '】\n';
  }

  const filename = sanitizeFilename(state.title) + '.txt';
  downloadFile(output.trim(), filename, 'text/plain');
  showStatus('Exported ' + pageAnnotations.length + ' annotations.');
});

// ---- Import JSON ----
document.getElementById('import-json').addEventListener('click', function() {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;

  try {
    var text = await file.text();
    var data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Expected an array');
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!item.url || typeof item.text !== 'string' || typeof item.annotation !== 'string') {
        throw new Error('Invalid annotation format: each entry needs url, text, and annotation');
      }
    }

    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('No active tab');

    await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'LOAD_STATE',
      annotations: data
    });

    showStatus('Imported ' + data.length + ' annotations.');
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
var statusTimer = null;
function downloadFile(content, filename, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showStatus(msg) {
  var el = document.getElementById('status');
  el.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(function() { el.textContent = ''; statusTimer = null; }, 3000);
}
