# Focus Reader — Chrome Extension Design Spec

> **Date:** 2026-05-24
> **Status:** Draft

## Overview

A Chrome extension that enforces focused reading sessions for Spring Framework documentation. During a session, the user can only access Spring docs and chat.deepseek.com. Reading time is calculated from page word count and a configurable WPM preset. Like a Pomodoro timer, the session cannot be paused — the user must finish reading before time runs out to have the session counted.

## Architecture

```
focus-reader-extension/
├── popup/                       Extension popup (entry point)
│   ├── popup.html              — Today's overview + start reading button
│   └── popup.js                — Detect if current page is Spring doc
│
├── content/                    Injected into Spring doc pages
│   ├── content-script.js       — Word count, progress bar UI, scroll detection, "Done" button
│   └── progress-bar.css        — Top countdown bar styles
│
├── background/                 Service Worker
│   ├── service-worker.js       — Timer core, state machine, alarms
│   └── rules/
│       └── dnr-rules.json      — Static declarativeNetRequest rules
│
├── blocked/
│   └── blocked.html            — "Focused reading in progress" interception page
│
├── dashboard/                  Statistics dashboard (standalone tab)
│   ├── dashboard.html          — Full stats view
│   ├── dashboard.js            — Chart.js visualizations, data aggregation
│   └── dashboard.css
│
├── settings/                   WPM preset + daily goal
│   ├── settings.html
│   └── settings.js
│
├── manifest.json               — MV3, permissions
└── _locales/                   (future i18n — hardcoded Chinese for v1)
```

**Permissions:**
- `declarativeNetRequest` — dynamic URL blocking
- `storage` — stats & settings persistence
- `alarms` — countdown timer accuracy
- `activeTab` + `scripting` — content script injection
- `host_permissions: ["*://docs.spring.io/*", "*://*.spring.io/*", "*://chat.deepseek.com/*"]`

**Whitelist domains (hardcoded v1):**
- `*.spring.io` (covers docs.spring.io, spring.io/docs, spring.io/guides, etc.)
- `chat.deepseek.com` (lookup / translation aid)

## Timer State Machine

```
[IDLE] ──"Start Reading"──▶ [RUNNING]
   ▲                            │  │
   │ "Abandon" / Timeout        │  │
   │                            │  │
   └───── [ABORTED] ◄───────────┘  │
   (no stats recorded)             │
                        Scroll to bottom + click "Done"
                                   │
                                   ▼
                              [COMPLETED]
                              (stats persisted)
```

| State | Meaning | Entry condition | Available actions |
|---|---|---|---|
| `IDLE` | Not started | Init / previous session ended | Start reading |
| `RUNNING` | Counting down | User confirmed estimated time | None (cannot pause) |
| `COMPLETED` | Done on time | Scrolled to bottom + clicked "Done" (within time limit) | View stats |
| `ABORTED` | Abandoned / timeout | User gave up OR time ran out | None |

**Key rules:**
1. **No pause** — the popup during RUNNING shows countdown info only, no pause button
2. **Timeout = ABORTED** — time runs out without completion → no stats, no streak
3. **Early completion** — if user finishes before time, `COMPLETED` with actual time (not estimated)
4. **Abandon mechanism** — "Abandon reading" button in popup (requires double-confirm), results in ABORTED
5. **Service Worker sleep protection** — `chrome.alarms` ensures timer survives SW suspension; on alarm fire, check state and enforce timeout

State stored in `chrome.storage.session` (memory-scoped, cleared on browser restart).
Completed stats stored in `chrome.storage.local` (persisted to disk, survives browser restart).

## Content Script

### Word Count

Extract text from the page to compute reading time.

**Extraction sources (in priority order):**
1. `<main>` or `<article>` element text
2. Element with id/class containing "content" / "body" / "doc"
3. Fallback: `document.body` full text

**Rules:**
- Exclude: `<nav>`, `<footer>`, `<header>`, `<script>`, `<style>`
- Code blocks (`<pre>`, `<code>`) **ARE counted** toward word count
- English word segmentation via whitespace, filter pure punctuation tokens

### Top Progress Bar

- Position: `fixed; top: 0; z-index: 99999; height: 4px`
- `<html>` receives `padding-top: 4px` to avoid content overlap
- Colors:
  - Green gradient: remaining > 30%
  - Orange: remaining 10–30%
  - Red: remaining < 10%
- Smooth width transition every second
- Right-side label: `mm:ss remaining`, follows bar color
- When time runs out without completion: red flash 3x, message "Time up — not recorded" + "Abandon" button

### Scroll Detection & "Done" Button

- Scroll position ≤ 50px from bottom → floating button appears (bottom-right)
- "Done Reading ✓" — green, 2s cooldown animation to prevent misclicks
- Click → message to service worker → COMPLETED → release whitelist → button becomes "Done ✓ Recorded"
- Not scrolled to bottom when time expires → no button, forfeit the session

### Timer Sync

- Countdown display updated by content script every 1s (UI-only tick)
- Authoritative time from service worker via `chrome.alarms`, synced every 30s
- On `visibilitychange` (tab hidden): pause UI tick, resume + re-sync from SW on return

## URL Interception

```json
// Static block-all rule (priority 1)
{ "id": 1, "priority": 1, "action": { "type": "block" },
  "condition": { "urlFilter": "*", "resourceTypes": ["main_frame"] } }

// Dynamic allow rules (priority 100, enabled only during RUNNING)
{ "id": 100, "priority": 100, "action": { "type": "allow" },
  "condition": { "urlFilter": "*://*.spring.io/*", "resourceTypes": ["main_frame"] } }
{ "id": 101, "priority": 100, "action": { "type": "allow" },
  "condition": { "urlFilter": "chat.deepseek.com", "resourceTypes": ["main_frame"] } }
```

- Rules applied via `chrome.declarativeNetRequest.updateDynamicRules` at session start
- Rules removed at session end (COMPLETED or ABORTED)
- Non-whitelist navigation → redirected to `blocked.html` which shows remaining time + "Return to reading" button

## Statistics & Data Model

### Session Record

```javascript
{
  id: "session_20260524_143022",
  url: "https://docs.spring.io/spring-framework/reference/core/beans/definition.html",
  title: "Bean Definitions :: Spring Framework",
  wordCount: 2847,
  estimatedMinutes: 14,
  actualSeconds: 832,
  wpm: 200,
  completedAt: "2026-05-24T14:44:12+08:00",
  completed: true
}
```

### Settings

```javascript
{
  wpmPreset: 200,          // Current preset: 150 / 200 / 250 / 300
  dailyGoalMinutes: 90,    // Daily target
  streakDays: 3,
  lastCompletedDate: "2026-05-24"
}
```

### Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  📊 Focus Stats                             [Settings ⚙] │
├──────────┬──────────┬──────────┬──────────────────────────┤
│ Today    │ Streak   │ Total    │ Daily Goal               │
│  45 min  │  🔥 3d   │ 28,450   │ ████████░░ 45/90 min     │
├──────────┴──────────┴──────────┴──────────────────────────┤
│                                                          │
│  Weekly Focus (bar chart via Chart.js)                    │
│  M  T  W  T  F  S  S                                     │
│                                                          │
│  Reading Speed Trend (line chart, last 30 sessions)       │
│  WPM over time                                           │
│                                                          │
│  Recent Sessions (list)                                  │
│  05-24 Bean Definitions        14min  832s  ✓            │
│  05-24 Container Overview       8min  410s  ✓            │
│  ...                                                     │
│                                                          │
│  [Export JSON]  [Import JSON]                             │
└──────────────────────────────────────────────────────────┘
```

### Auto-Calculation Rules

- **Streak days**: daily total focus time ≥ daily goal → day counts; < goal → streak resets
- **Today total**: sum of all COMPLETED sessions' `actualSeconds` for today
- **Weekly chart**: daily focus totals for the past 7 days
- **Speed trend**: `wordCount / actualSeconds * 60` for each session, plotted over last 30 sessions
- **Daily goal**: progress bar; turns green ring when reached, holds green until next day

### Data Export/Import

- Export: serialize `chrome.storage.local` stats to JSON file download
- Import: select JSON file, merge into storage (dedup by session `id`)
- Purpose: backup + migration between browsers/computers

## Popup (Entry Point)

### IDLE / Non-Spring Page

```
┌─────────────────────────┐
│  🔍 Focus Reader         │
│                         │
│  Current page:           │
│  Bean Definitions        │
│  docs.spring.io          │
│                         │
│  Words: 2,847            │
│  Est. time: ~14 min      │
│  (WPM: 200 ▾)           │
│                         │
│  ┌─────────────────────┐│
│  │   Start Reading      ││
│  └─────────────────────┘│
├─────────────────────────┤
│  Today: 45/90 min 🔥3   │
│  [View full stats →]    │
└─────────────────────────┘
```

- Non-Spring page: show "Please use on a Spring doc page" instead of start button
- WPM dropdown (150/200/250/300) updates estimated time instantly

### RUNNING

```
┌─────────────────────────┐
│  ⏳ Reading in focus...  │
│                         │
│  Page:                   │
│  Bean Definitions        │
│                         │
│  Remaining: 14:32        │
│  ████████░░░░░░░░░░     │
│                         │
│  Finish before time's up│
│                         │
│  [Abandon reading] (tiny)│
├─────────────────────────┤
│  ❌ Won't count session  │
└─────────────────────────┘
```

- No pause, no extend
- "Abandon" requires second confirmation: "Confirm abandon? This session won't be counted."

## WPM Presets

Four presets available via dropdown:

| Preset | WPM | Target user |
|---|---|---|
| Slow | 150 | New to English technical reading |
| Normal | 200 | Default, comfortable pace |
| Fast | 250 | Experienced reader |
| Skim | 300 | Scanning / review mode |

Estimates adjust instantly on preset change.
