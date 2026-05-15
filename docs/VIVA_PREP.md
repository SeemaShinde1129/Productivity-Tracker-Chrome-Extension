# Viva and Interview Preparation

This document prepares concise answers for explaining the Productivity Tracker Chrome Extension in a viva, internship review, or interview.

## Project Explanation

### Short Explanation

Productivity Tracker is a Manifest V3 Chrome Extension that tracks how much time users spend on websites and shows productivity analytics through a popup and dashboard. It categorizes websites as productive, unproductive, or neutral, stores data locally, and generates weekly productivity reports.

### 30-Second Explanation

I built a Chrome Extension called Productivity Tracker. It listens to browser events such as tab switching, URL changes, focus changes, and idle state. The background service worker manages session tracking and stores analytics in `chrome.storage.local`. The popup shows a quick live overview, while the dashboard shows charts, top websites, insights, and weekly reports. The project focuses on clean architecture, Manifest V3 lifecycle handling, and practical local analytics.

### 2-Minute Explanation

The project is divided into a background service worker, popup UI, dashboard UI, and utility layers. The background service worker owns the tracking logic because Chrome Extension events are available there. When the user switches tabs or changes websites, the previous session is committed and a new session starts. If Chrome loses focus or the user becomes idle, tracking pauses to avoid inflated time.

All important data is stored in `chrome.storage.local`. This is important because Manifest V3 service workers can sleep, so in-memory variables are not reliable. The popup and dashboard do not track anything themselves. They read stored analytics and request live session state from the background worker.

The dashboard aggregates daily stats into weekly totals, charts, top websites, productivity insights, and a weekly report. The productivity score is calculated as productive time divided by total tracked time.

## What Makes This A Strong Internship Project

- It solves a practical problem.
- It uses real Chrome Extension APIs.
- It handles Manifest V3 lifecycle limitations.
- It has a clean separation between tracking, storage, analytics, and UI.
- It includes real analytics and reports.
- It avoids unnecessary backend complexity.
- It is explainable and maintainable.

## Common Evaluator Focus Areas

Evaluators usually care about:

- Whether the project actually works.
- Whether the architecture is understandable.
- Whether the student understands the lifecycle and edge cases.
- Whether storage and data flow are designed properly.
- Whether the UI is usable and polished.
- Whether the code is modular.
- Whether the student can explain tradeoffs honestly.

## Common Presentation Mistakes

Avoid these mistakes:

- Calling it an AI project when it is rule-based analytics.
- Claiming enterprise-level scalability without backend architecture.
- Ignoring Manifest V3 service worker behavior.
- Saying popup tracks time directly.
- Not explaining how stale sessions are handled.
- Showing only UI without explaining background logic.
- Overcomplicating the explanation with unnecessary terms.

## Architecture Questions

### Q: Why is this not a normal React app?

Because Chrome Extensions have multiple execution environments. The popup, dashboard, and background service worker run separately. The background service worker handles Chrome events, while React is used only for UI pages.

### Q: What does the background service worker do?

It owns the tracking lifecycle. It listens to tab, window, runtime, and idle events. It starts sessions, pauses sessions, commits time, recovers state, and writes analytics to storage.

### Q: Why should popup not handle tracking?

The popup only exists while it is open. When the user closes it, its React state is destroyed. If tracking lived in the popup, tracking would stop whenever the popup closed.

### Q: What does the dashboard do?

The dashboard visualizes analytics. It reads stored usage data, aggregates it, and renders charts, insights, top websites, and weekly reports.

### Q: What is the single source of truth?

`chrome.storage.local` is the persisted source of truth. The background worker updates it, and popup/dashboard read from it.

## Manifest V3 Questions

### Q: What is Manifest V3?

Manifest V3 is the current Chrome Extension platform version. It uses service workers for background logic instead of persistent background pages.

### Q: What is the main challenge with MV3 service workers?

They are not always running. Chrome can start and stop them based on events. This means in-memory variables can be lost.

### Q: How did you handle service worker sleep?

Important state, especially `activeSession`, is persisted in `chrome.storage.local`. When the worker wakes again, it can recover from stored state.

### Q: What wakes the service worker?

Events such as:

- `runtime.onInstalled`
- `runtime.onStartup`
- `runtime.onMessage`
- `tabs.onActivated`
- `tabs.onUpdated`
- `windows.onFocusChanged`
- `idle.onStateChanged`

### Q: What data is lost when the service worker sleeps?

In-memory variables may be lost. Stored data in `chrome.storage.local` survives.

## Tracking Logic Questions

### Q: What is an active session?

An active session represents the current website being tracked. It stores domain, tab ID, category, start time, last committed time, focus state, idle state, and tracking status.

### Q: When does a session start?

A session starts when Chrome has focus, the user is active, and the active tab has a valid trackable URL.

### Q: When does a session pause?

It pauses when Chrome loses focus, the user becomes idle, tracking is disabled, or the session becomes stale.

### Q: When is time committed?

Time is committed when the user switches tabs, changes domain, closes a tracked tab/window, becomes idle, or Chrome loses focus.

### Q: How do you avoid inflated tracking?

The tracker validates elapsed time and caps suspicious gaps. It also pauses during idle or unfocused states.

### Q: Why is laptop sleep a problem?

If a session starts and the laptop sleeps, the elapsed timestamp gap can become very large. Without validation, the extension could count hours incorrectly.

## Storage Questions

### Q: Why use `chrome.storage.local`?

It is built for Chrome Extensions, persists across service worker wake cycles, and does not require a backend.

### Q: What data is stored?

The extension stores app metadata, settings, daily analytics, and active session state.

### Q: Why store activeSession?

Because MV3 service workers can sleep. Persisting `activeSession` allows recovery when the worker wakes again.

### Q: Why not use localStorage?

`localStorage` is not appropriate for service worker-based extension background logic. `chrome.storage.local` is the recommended Chrome Extension storage API.

## Messaging Questions

### Q: Why is messaging needed?

Popup and dashboard sometimes need current live state from the background service worker, such as active session and browser focus state.

### Q: When are storage listeners enough?

Storage listeners are enough for committed analytics because those updates are persisted in `chrome.storage.local`.

### Q: What is a common MV3 messaging mistake?

For async `sendResponse`, forgetting to return `true` from the message listener. That can close the message port before the response is sent.

## Analytics Questions

### Q: How is productivity score calculated?

The score is:

```text
productiveSeconds / totalSeconds * 100
```

This makes the score simple and explainable.

### Q: Why include neutral time in total time?

Neutral time still represents tracked browsing. Including it prevents the score from exaggerating productivity.

### Q: How are weekly reports generated?

The dashboard aggregates the last seven days of `dailyStats`, calculates totals, averages, top sites, most productive day, and trend summary.

### Q: How do charts get their data?

Charts do not calculate from storage directly. They receive prepared data from the analytics helper layer.

## UI Questions

### Q: Why have both popup and dashboard?

The popup is for quick checking. The dashboard is for deeper analytics and reports.

### Q: Why is the popup compact?

Chrome popups have limited space and close when they lose focus, so the UI should be lightweight and focused.

### Q: Why use a dark minimal UI?

It makes analytics easier to scan and gives the extension a modern professional feel without unnecessary visual clutter.

## Challenges Faced

### Service Worker Lifecycle

Manifest V3 service workers can sleep. This made in-memory tracking unreliable, so active session state had to be persisted.

### Stale Sessions

Long gaps from laptop sleep or service worker suspension could inflate tracking. The solution was elapsed-time validation and stale-session protection.

### Popup Lifecycle

The popup is temporary. React state disappears when it closes, so it cannot own tracking logic.

### Synchronization

Popup and dashboard need to stay consistent with background tracking. The solution was storage listeners for committed analytics and runtime messaging for live state.

### Tracking Accuracy

Browser-based tracking cannot perfectly know whether the user is genuinely productive. The project uses practical signals: active tab, focus state, idle state, and domain category.

## Future Improvements

Realistic future improvements:

- Custom domain categories.
- User-editable productive/unproductive lists.
- Export weekly reports as CSV or PDF.
- Productivity goals and daily limits.
- Optional notifications.
- Optional cloud sync.
- Optional authentication for multi-device usage.

## Final Viva Summary

The most important idea in this project is separation of responsibility:

- Background service worker tracks activity.
- Storage persists reliable state.
- Popup shows quick live status.
- Dashboard visualizes analytics.
- Utilities keep tracking, storage, categorization, and messaging modular.

This architecture makes the extension realistic, maintainable, and suitable for an internship-level professional project.
