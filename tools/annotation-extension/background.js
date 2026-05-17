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
