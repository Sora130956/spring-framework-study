// State: flat array of all annotations across all pages
let annotations = [];

// Load persisted annotations from chrome.storage on init
(async function initStorage() {
  try {
    const result = await chrome.storage.local.get('anno_state');
    if (result.anno_state && Array.isArray(result.anno_state)) {
      annotations = result.anno_state;
      reRenderAllMarkers();
    }
  } catch (_) { /* storage unavailable */ }
})();

function persistState() {
  chrome.storage.local.set({ anno_state: annotations }).catch(function() {});
}

// Load state from import (called by popup)
function loadState(imported) {
  annotations = imported;
  persistState();
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
  persistState();
  return entry;
}

// Remove an annotation by id
function removeAnnotation(id) {
  annotations = annotations.filter(a => a.id !== id);
  persistState();
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
        pageCount: getPageAnnotations().length,
        title: document.title
      });
      break;
    case 'LOAD_STATE':
      loadState(msg.annotations);
      sendResponse({ success: true });
      break;
  }
  return true; // keep channel open for async sendResponse
});

// Space key shortcut: press Space on selection → annotate
let lastSpaceTrigger = 0;
function onSpaceKey(e) {
  if (e.code !== 'Space' && e.key !== ' ') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if (Date.now() - lastSpaceTrigger < 300) return; // debounce keydown+keyup
  lastSpaceTrigger = Date.now();
  e.preventDefault();
  e.stopPropagation();
  handleAddAnnotation();
}
window.addEventListener('keydown', onSpaceKey, true);
document.addEventListener('keyup', onSpaceKey);

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
  try {
    range.surroundContents(wrapper);
  } catch (e) {
    // Selection spans multiple elements; fall back to delete+insert
    range.deleteContents();
    wrapper.textContent = selectedText;
    range.insertNode(wrapper);
  }

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
        background: #171717;
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: #c9c7c2;
        max-width: 480px;
      }
      .anno-editor textarea {
        width: 100%;
        min-height: 56px;
        border: 1px solid #2a2a2a;
        border-radius: 3px;
        padding: 6px 8px;
        font: inherit;
        color: #c9c7c2;
        background: #0d0d0d;
        resize: vertical;
        box-sizing: border-box;
        outline: none;
      }
      .anno-editor textarea:focus { border-color: #444; }
      .anno-editor textarea::placeholder { color: #555; }
      .anno-editor .btn-row { display: flex; gap: 5px; margin-top: 6px; }
      .anno-editor button {
        padding: 3px 10px;
        border: 1px solid #333;
        border-radius: 3px;
        background: transparent;
        color: #999;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .anno-editor button:hover { background: #222; border-color: #444; color: #c9c7c2; }
      .anno-editor button.save { border-color: #c4a35a; color: #c4a35a; }
      .anno-editor button.save:hover { background: rgba(196,163,90,0.1); }
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

// ---- Marker Rendering ----

function markAsAnnotated(wrapper, entry) {
  // Replace wrapper's inner content with a marked span
  wrapper.innerHTML = '';
  const marker = document.createElement('span');
  marker.className = '__anno_marker__';
  marker.style.cssText = 'border-bottom: 2px solid #9a9588; cursor: pointer;';
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
        background: #171717;
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: #c9c7c2;
        max-width: 480px;
      }
      .anno-editor textarea {
        width: 100%;
        min-height: 56px;
        border: 1px solid #2a2a2a;
        border-radius: 3px;
        padding: 6px 8px;
        font: inherit;
        color: #c9c7c2;
        background: #0d0d0d;
        resize: vertical;
        box-sizing: border-box;
        outline: none;
      }
      .anno-editor textarea:focus { border-color: #444; }
      .anno-editor textarea::placeholder { color: #555; }
      .anno-editor .btn-row { display: flex; gap: 5px; margin-top: 6px; }
      .anno-editor button {
        padding: 3px 10px;
        border: 1px solid #333;
        border-radius: 3px;
        background: transparent;
        color: #999;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .anno-editor button:hover { background: #222; border-color: #444; color: #c9c7c2; }
      .anno-editor button.save { border-color: #c4a35a; color: #c4a35a; }
      .anno-editor button.save:hover { background: rgba(196,163,90,0.1); }
      .anno-editor button.delete { border-color: #c94a4a; color: #c94a4a; }
      .anno-editor button.delete:hover { background: rgba(201,74,74,0.1); }
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
    persistState();
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
    wrapper.replaceWith(document.createTextNode(entry.text));
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
  document.querySelectorAll('.__anno_marker__').forEach(m => m.remove());
  document.querySelectorAll('.__anno_editor_host__').forEach(e => e.remove());

  // For imported annotations, we can't restore exact DOM positions.
  // Instead, try to find and mark matching text nodes.
  pageAnnotations.forEach(entry => {
    try {
      const found = findTextInDocument(entry.text);
      if (found) {
        const wrapper = wrapTextNode(found, entry.text);
        markAsAnnotated(wrapper, entry);
      }
    } catch (e) {
      // Skip entries that fail to render — don't break the whole import
      console.warn('Failed to restore annotation:', entry.id, e);
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
  try {
    range.surroundContents(wrapper);
  } catch (e) {
    range.deleteContents();
    wrapper.textContent = text;
    range.insertNode(wrapper);
  }
  return wrapper;
}
