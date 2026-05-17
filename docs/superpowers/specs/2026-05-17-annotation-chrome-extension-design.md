# Chrome Extension: Page Annotation Tool — Design Spec

## Purpose

A Chrome extension that lets the user select text on any webpage, add annotations inline via right-click, and export annotations in a format compatible with this project's note-taking workflow (`【URL】【text】【annotation】...`).

Target user: one person (the repo owner). Version 1 is a personal tool, not a published extension.

## Core Workflow

1. User selects text on a webpage → right-click → "Add Annotation"
2. An inline textarea appears below the selection with [Save] [Cancel] [Edit] [Delete] buttons
3. Annotated text gets a subtle underline visual marker on the page
4. User can export annotations as JSON (for import/backup) or as the note format
5. User can import a previously exported JSON to restore annotations

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Content Script (content-script.js + content-script.css) │
│  Injected into every page. Manages:                       │
│  - Selection detection                                    │
│  - Inline annotation UI (Shadow DOM)                      │
│  - Underline markers                                      │
│  - In-memory state                                        │
└────────────┬─────────────────────────────────────────────┘
             │  messaging
┌────────────▼──────────┐    ┌─────────────────────┐
│  Background SW         │    │  Popup              │
│  (background.js)       │    │  (popup.html + .js) │
│  - Context menu        │    │  - Export JSON       │
│  - Bridge messages     │    │  - Export 笔记格式   │
│                         │    │  - Import JSON       │
└─────────────────────────┘    └─────────────────────┘
```

### Component Responsibilities

**Content Script** (`content-script.js`):
- Listen for messages from background (context menu click)
- Get current selection, wrap it in a `<mark>`-like span for underline
- Create Shadow DOM host below the marked text
- Render textarea + 4 buttons inside Shadow DOM
- Manage all annotations in memory: `[{ url, text, annotation, timestamp }]`
- Re-render existing annotations on page load (if state is re-imported)
- Expose state getter/setter for popup communication

**Background Service Worker** (`background.js`):
- Create right-click context menu item "Add Annotation" (only shown when text is selected)
- Forward context menu click to content script via `chrome.tabs.sendMessage`

**Popup** (`popup.html` + `popup.js`):
- Small panel opened by clicking the extension toolbar icon
- Shows current page's annotation count (fetched from content script)
- Three buttons:
  - "Export JSON" → download `annotations.json`
  - "Export Note Format" → download as text file in `【URL】...` format
  - "Import JSON" → file picker, parse JSON, send to content script to load

## Data Model

```typescript
// In-memory state in content script
interface AnnotationEntry {
  id: string;        // unique ID, e.g. timestamp-based
  url: string;       // page URL at time of annotation
  text: string;      // the selected text
  annotation: string; // user's note
  timestamp: number; // Date.now()
}

interface AnnotationState {
  annotations: AnnotationEntry[]; // flat array, grouped by URL on export
}
```

## Export Formats

**JSON format** (for backup/restore):
```json
[
  {
    "id": "1715900000000",
    "url": "https://docs.spring.io/spring-framework/...",
    "text": "selected paragraph text",
    "annotation": "my note",
    "timestamp": 1715900000000
  }
]
```

**Note format** (for study notes workflow):
```
https://docs.spring.io/spring-framework/...
【selected paragraph text】
【my note】
【selected paragraph text 2】
【my note 2】
```

Annotations are grouped by URL in the note format export.

## UI Behavior

### Inline Annotation Editor
- Positioned directly below the selected/marked text
- Wrapped in Shadow DOM to prevent page CSS interference
- Buttons: [Save] [Cancel]
- After saving: [Edit] [Delete] buttons shown when hovering over the underlined text

### Underline Marker
- `<span>` with bottom border (`border-bottom: 2px dotted #888`)
- Hover triggers a tooltip showing the annotation text
- Clicking on marked text shows the annotation in edit mode

### Popup Panel
- Minimal: header "Page Annotations" + count for current page
- Export/Import section with 3 buttons
- Compact, <300px wide

## File Structure

```
tools/annotation-extension/
├── manifest.json
├── background.js
├── content-script.js
├── content-script.css
├── popup.html
├── popup.js
├── popup.css
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## What's Out of Scope (v1)

- `chrome.storage` persistence — data lives in content script memory, lost on page refresh
- Cross-page annotation search
- Annotation editing after export
- Cloud sync
- Rich text annotations (plain text only)
- Public Chrome Web Store publication — loaded as unpacked extension for personal use

## Technical Notes

- Manifest V3
- `activeTab` permission for content script injection on click
- `contextMenus` permission for right-click menu
- No external dependencies — pure vanilla JS
- Shadow DOM used for all injected UI to prevent CSS conflicts with host page
