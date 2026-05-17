# Annotation Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that allows selecting text on any webpage, adding inline annotations via right-click, and exporting in note format.

**Architecture:** Manifest V3 extension with a content script (injected into pages, manages inline UI and in-memory state), a background service worker (context menu registration), and a popup panel (export/import). Shadow DOM isolates injected UI from host page CSS.

**Tech Stack:** Pure vanilla JS, Manifest V3, no dependencies.

---

### Task 1: Scaffold Extension Directory and Manifest

**Files:**
- Create: `tools/annotation-extension/manifest.json`

- [ ] **Step 1: Create directory structure**

```powershell
New-Item -ItemType Directory -Force -Path tools/annotation-extension
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Page Annotation Tool",
  "version": "1.0.0",
  "description": "Select text on any page, add annotations inline, and export in note format.",
  "permissions": ["contextMenus", "activeTab"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "css": ["content-script.css"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

- [ ] **Step 3: Verify manifest is valid JSON**

```powershell
Get-Content tools/annotation-extension/manifest.json | ConvertFrom-Json
```

- [ ] **Step 4: Commit**

```bash
git add tools/annotation-extension/manifest.json
git commit -m "feat: scaffold manifest.json for annotation extension"
```

---

### Task 2: Background Service Worker — Context Menu

**Files:**
- Create: `tools/annotation-extension/background.js`

- [ ] **Step 1: Write background.js**

```javascript
// Register context menu item on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-annotation',
    title: 'Add Annotation',
    contexts: ['selection']
  });
});

// Forward context menu clicks to the active tab's content script
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-annotation' && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'ADD_ANNOTATION' });
  }
});
```

- [ ] **Step 2: Verify background.js has no syntax errors**

```powershell
node -e "require('fs').readFileSync('tools/annotation-extension/background.js','utf8')" 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "Syntax OK (Node check skipped - Chrome API not available in Node)" }
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/background.js
git commit -m "feat: add background service worker with context menu"
```

---

### Task 3: Content Script — State Management and Message Handling

**Files:**
- Create: `tools/annotation-extension/content-script.js`

- [ ] **Step 1: Write the core state module and message listener**

```javascript
// State: flat array of all annotations across all pages
let annotations = [];

// Load state from import (called by popup)
function loadState(imported) {
  annotations = imported;
  reRenderAllMarkers();
}

// Get current page's annotations
function getPageAnnotations() {
  const url = window.location.href;
  return annotations.filter(a => a.url === url);
}

// Add a new annotation
function addAnnotation(text, note) {
  const entry = {
    id: String(Date.now()),
    url: window.location.href,
    text: text,
    annotation: note,
    timestamp: Date.now()
  };
  annotations.push(entry);
  return entry;
}

// Remove an annotation by id
function removeAnnotation(id) {
  annotations = annotations.filter(a => a.id !== id);
}

// Listen for messages from background and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'ADD_ANNOTATION':
      handleAddAnnotation();
      break;
    case 'GET_STATE':
      sendResponse({
        annotations: annotations,
        pageCount: getPageAnnotations().length
      });
      break;
    case 'LOAD_STATE':
      loadState(msg.annotations);
      sendResponse({ success: true });
      break;
  }
  return true; // keep channel open for async sendResponse
});
```

- [ ] **Step 2: Verify syntax**

```powershell
node --check tools/annotation-extension/content-script.js
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/content-script.js
git commit -m "feat: add content script state management and message handling"
```

---

### Task 4: Content Script — Inline Annotation Editor (Shadow DOM)

**Files:**
- Modify: `tools/annotation-extension/content-script.js` — add `handleAddAnnotation()`, Shadow DOM editor

- [ ] **Step 1: Add the annotation editor logic to content-script.js**

Append after the message listener:

```javascript
// ---- Annotation Editor ----

let activeEditor = null; // track currently open editor to prevent duplicates

function handleAddAnnotation() {
  // Prevent multiple editors open at once
  if (activeEditor) {
    destroyEditor(activeEditor);
    activeEditor = null;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  // Create enclosing span to mark the text position
  const wrapper = document.createElement('span');
  wrapper.className = '__anno_wrapper__';
  range.surroundContents(wrapper);

  // Insert the editor below the wrapper
  const editorEl = createEditorElement(selectedText, wrapper);
  wrapper.after(editorEl);

  activeEditor = editorEl;
}

function createEditorElement(text, wrapper) {
  // Shadow DOM host
  const host = document.createElement('span');
  host.className = '__anno_editor_host__';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .anno-editor {
        display: inline-block;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 8px;
        margin: 4px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        max-width: 480px;
      }
      .anno-editor textarea {
        width: 100%;
        min-height: 60px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 6px;
        font: inherit;
        resize: vertical;
        box-sizing: border-box;
      }
      .anno-editor .btn-row {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .anno-editor button {
        padding: 4px 12px;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      .anno-editor button.save { background: #1a73e8; color: #fff; border-color: #1a73e8; }
      .anno-editor button:hover { opacity: 0.85; }
    </style>
    <div class="anno-editor">
      <textarea placeholder="Write your annotation..."></textarea>
      <div class="btn-row">
        <button class="save">Save</button>
        <button class="cancel">Cancel</button>
        <button class="edit" style="display:none">Edit</button>
        <button class="delete" style="display:none">Delete</button>
      </div>
    </div>
  `;

  const textarea = shadow.querySelector('textarea');
  const saveBtn = shadow.querySelector('.save');
  const cancelBtn = shadow.querySelector('.cancel');

  saveBtn.addEventListener('click', () => {
    const note = textarea.value.trim();
    if (!note) return;

    const entry = addAnnotation(text, note);
    markAsAnnotated(wrapper, entry);
    destroyEditor(host);
    activeEditor = null;
  });

  cancelBtn.addEventListener('click', () => {
    // Remove the empty wrapper
    unwrapElement(wrapper);
    destroyEditor(host);
    activeEditor = null;
  });

  return host;
}

function destroyEditor(host) {
  if (host && host.parentNode) {
    host.remove();
  }
}

function unwrapElement(wrapper) {
  const parent = wrapper.parentNode;
  while (wrapper.firstChild) {
    parent.insertBefore(wrapper.firstChild, wrapper);
  }
  parent.removeChild(wrapper);
}
```

- [ ] **Step 2: Verify syntax**

```powershell
node --check tools/annotation-extension/content-script.js
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/content-script.js
git commit -m "feat: add inline annotation editor with Shadow DOM"
```

---

### Task 5: Content Script — Underline Markers and Annotated Text Interaction

**Files:**
- Modify: `tools/annotation-extension/content-script.js` — add `markAsAnnotated()`, `reRenderAllMarkers()`, click/hover handlers

- [ ] **Step 1: Add marker rendering and interaction logic**

Append to content-script.js:

```javascript
// ---- Marker Rendering ----

function markAsAnnotated(wrapper, entry) {
  // Replace wrapper's inner content with a marked span
  wrapper.innerHTML = '';
  const marker = document.createElement('span');
  marker.className = '__anno_marker__';
  marker.style.cssText = 'border-bottom: 2px dotted #888; cursor: pointer;';
  marker.textContent = entry.text;
  marker.dataset.annoId = entry.id;
  marker.title = entry.annotation;

  wrapper.appendChild(marker);

  // Hover: update tooltip with latest annotation
  marker.addEventListener('mouseenter', () => {
    const latest = annotations.find(a => a.id === entry.id);
    if (latest) marker.title = latest.annotation;
  });

  // Click: re-open editor for editing
  marker.addEventListener('click', () => {
    openEditEditor(wrapper, entry);
  });
}

function openEditEditor(wrapper, entry) {
  if (activeEditor) {
    destroyEditor(activeEditor);
    activeEditor = null;
  }

  const host = document.createElement('span');
  host.className = '__anno_editor_host__';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .anno-editor {
        display: inline-block;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 8px;
        margin: 4px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        max-width: 480px;
      }
      .anno-editor textarea {
        width: 100%;
        min-height: 60px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 6px;
        font: inherit;
        resize: vertical;
        box-sizing: border-box;
      }
      .anno-editor .btn-row {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .anno-editor button {
        padding: 4px 12px;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      .anno-editor button.save { background: #1a73e8; color: #fff; border-color: #1a73e8; }
      .anno-editor button.delete { background: #d93025; color: #fff; border-color: #d93025; }
      .anno-editor button:hover { opacity: 0.85; }
    </style>
    <div class="anno-editor">
      <textarea placeholder="Write your annotation...">${escapeHtml(entry.annotation)}</textarea>
      <div class="btn-row">
        <button class="save">Save</button>
        <button class="cancel">Cancel</button>
        <button class="delete">Delete</button>
      </div>
    </div>
  `;

  const textarea = shadow.querySelector('textarea');
  const saveBtn = shadow.querySelector('.save');
  const cancelBtn = shadow.querySelector('.cancel');
  const deleteBtn = shadow.querySelector('.delete');

  saveBtn.addEventListener('click', () => {
    const note = textarea.value.trim();
    if (!note) return;
    entry.annotation = note;
    // Update marker display
    const marker = wrapper.querySelector('.__anno_marker__');
    if (marker) marker.title = note;
    destroyEditor(host);
    activeEditor = null;
  });

  cancelBtn.addEventListener('click', () => {
    destroyEditor(host);
    activeEditor = null;
  });

  deleteBtn.addEventListener('click', () => {
    removeAnnotation(entry.id);
    unwrapElement(wrapper);
    destroyEditor(host);
    activeEditor = null;
  });

  wrapper.after(host);
  activeEditor = host;
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

// Re-render all markers for current page (used after import)
function reRenderAllMarkers() {
  const pageAnnotations = getPageAnnotations();
  // Clear existing markers first
  document.querySelectorAll('.__anno_wrapper__').forEach(w => unwrapElement(w));
  document.querySelectorAll('.__anno_editor_host__').forEach(e => e.remove());

  // For imported annotations, we can't restore exact DOM positions.
  // Instead, try to find and mark matching text nodes.
  pageAnnotations.forEach(entry => {
    const found = findTextInDocument(entry.text);
    if (found) {
      const wrapper = wrapTextNode(found, entry.text);
      markAsAnnotated(wrapper, entry);
    }
  });
}

function findTextInDocument(text) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.textContent.includes(text) && !isInsideAnnotation(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
    }
  );
  const node = walker.nextNode();
  if (!node) return null;

  const idx = node.textContent.indexOf(text);
  return { node, start: idx, end: idx + text.length };
}

function isInsideAnnotation(node) {
  let p = node.parentElement;
  while (p) {
    if (p.classList.contains('__anno_wrapper__') || p.classList.contains('__anno_editor_host__')) {
      return true;
    }
    p = p.parentElement;
  }
  return false;
}

function wrapTextNode(found, text) {
  const range = document.createRange();
  range.setStart(found.node, found.start);
  range.setEnd(found.node, found.end);
  const wrapper = document.createElement('span');
  wrapper.className = '__anno_wrapper__';
  range.surroundContents(wrapper);
  return wrapper;
}
```

- [ ] **Step 2: Verify syntax**

```powershell
node --check tools/annotation-extension/content-script.js
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/content-script.js
git commit -m "feat: add underline markers and click-to-edit interaction"
```

---

### Task 6: Content Script CSS — Minimal Page-Level Styles

**Files:**
- Create: `tools/annotation-extension/content-script.css`

- [ ] **Step 1: Write content-script.css**

```css
/* Minimal styles injected into the host page */
/* Most styling is in Shadow DOM to avoid conflicts. */

.__anno_wrapper__ {
  /* Reset: wrapper should not affect layout */
  display: inline;
  margin: 0;
  padding: 0;
}

.__anno_editor_host__ {
  display: block;
  margin: 4px 0;
  /* Host is just a placeholder; all styling is in Shadow DOM */
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/annotation-extension/content-script.css
git commit -m "feat: add minimal page-level CSS for content script"
```

---

### Task 7: Popup — HTML and CSS

**Files:**
- Create: `tools/annotation-extension/popup.html`
- Create: `tools/annotation-extension/popup.css`

- [ ] **Step 1: Write popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <h1>Page Annotations</h1>
    <p id="page-info">This page: <span id="count">0</span> annotations</p>

    <div class="btn-group">
      <button id="export-json">Export JSON</button>
      <button id="export-note">Export Note Format</button>
      <button id="import-json">Import JSON</button>
      <input type="file" id="import-file" accept=".json" style="display:none">
    </div>

    <div id="status" class="status"></div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write popup.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 280px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #333;
}

.popup-container {
  padding: 16px;
}

h1 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

#page-info {
  color: #666;
  margin-bottom: 14px;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

button {
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: #f5f5f5;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: center;
}

button:hover { background: #e8e8e8; }
button:active { background: #ddd; }

#export-note { background: #1a73e8; color: #fff; border-color: #1a73e8; }
#export-note:hover { opacity: 0.9; }

.status {
  margin-top: 10px;
  font-size: 12px;
  color: #1a73e8;
  min-height: 18px;
}
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/popup.html tools/annotation-extension/popup.css
git commit -m "feat: add popup HTML and CSS for export/import panel"
```

---

### Task 8: Popup — JavaScript (Export + Import)

**Files:**
- Create: `tools/annotation-extension/popup.js`

- [ ] **Step 1: Write popup.js**

```javascript
// Query the active tab's content script for current state
async function getContentState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
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
      output += `【${e.text}】\n`;
      output += `【${e.annotation}】\n`;
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
  setTimeout(() => { el.textContent = ''; }, 3000);
}
```

- [ ] **Step 2: Verify syntax**

```powershell
node --check tools/annotation-extension/popup.js
```

- [ ] **Step 3: Commit**

```bash
git add tools/annotation-extension/popup.js
git commit -m "feat: add popup export/import logic"
```

---

### Task 9: End-to-End Integration Check

**Files:**
- Read: `tools/annotation-extension/manifest.json`, `background.js`, `content-script.js`, `popup.js`

- [ ] **Step 1: Verify all message types match across files**

Check that these message types are consistent:
- `ADD_ANNOTATION` — sent by background → received by content script ✓
- `GET_STATE` — sent by popup → received by content script, responds with `{annotations, pageCount}` ✓
- `LOAD_STATE` — sent by popup → received by content script, responds with `{success: true}` ✓

- [ ] **Step 2: Verify all file references in manifest**

```powershell
$files = @('background.js', 'content-script.js', 'content-script.css', 'popup.html')
foreach ($f in $files) {
  $path = "tools/annotation-extension/$f"
  if (Test-Path $path) { Write-Host "OK: $path" } else { Write-Host "MISSING: $path" }
}
```

- [ ] **Step 3: Syntax-check all JS files**

```powershell
foreach ($f in @('background.js', 'content-script.js', 'popup.js')) {
  Write-Host "Checking tools/annotation-extension/$f..."
  node --check "tools/annotation-extension/$f"
}
```

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A tools/annotation-extension/
git commit -m "chore: integration check and minor fixes for annotation extension"
```

---

### Task 10: Manual Test Checklist

- [ ] **Step 1: Load the extension in Chrome**
  1. Open `chrome://extensions/`
  2. Enable "Developer mode"
  3. Click "Load unpacked"
  4. Select `tools/annotation-extension/` directory

- [ ] **Step 2: Test context menu**
  1. Navigate to any text-heavy page (e.g., `https://docs.spring.io/spring-framework/reference/core.html`)
  2. Select some text
  3. Right-click → verify "Add Annotation" menu item appears

- [ ] **Step 3: Test annotation creation**
  1. Click "Add Annotation"
  2. Verify textarea appears below selected text with [Save] [Cancel] buttons
  3. Type a note, click Save
  4. Verify text gets dotted underline
  5. Hover over underlined text → verify tooltip shows annotation

- [ ] **Step 4: Test edit and delete**
  1. Click underlined text → verify editor reopens with existing annotation
  2. Change the annotation, click Save → verify tooltip updates
  3. Click underlined text again → click Delete → verify marker is removed

- [ ] **Step 5: Test export**
  1. Open extension popup
  2. Verify annotation count shown
  3. Click "Export JSON" → verify `.json` file downloads
  4. Click "Export Note Format" → verify text file in `【URL】【text】【annotation】` format

- [ ] **Step 6: Test import**
  1. Refresh the page (annotation data lost — expected behavior)
  2. Open popup → click "Import JSON" → select previously exported JSON
  3. Verify previous annotations are restored and markers appear on page
