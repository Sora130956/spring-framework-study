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
