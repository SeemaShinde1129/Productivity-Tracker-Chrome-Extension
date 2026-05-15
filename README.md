# Productivity Tracker

Productivity Tracker is a Manifest V3 Chrome Extension that tracks time spent on websites, categorizes browsing activity, and shows productivity analytics through a popup and dashboard.

This project was built as an internship-level professional project. The goal is practical browser tracking, clean architecture, understandable code, and a polished local analytics experience without unnecessary backend complexity.

## Overview

Modern browsing often mixes work, study, entertainment, and distraction in the same browser session. Productivity Tracker helps users understand their browsing habits by tracking active website usage locally and converting it into simple productivity insights.

The extension can:

- Track active website sessions.
- Detect tab switching and URL changes.
- Pause tracking when Chrome is unfocused or the user is idle.
- Categorize websites as productive, unproductive, or neutral.
- Store usage analytics locally using `chrome.storage.local`.
- Display a quick popup overview.
- Show dashboard charts, top websites, insights, and weekly reports.

## Screenshots

Add screenshots after final testing:

```text
docs/screenshots/popup-overview.png
docs/screenshots/dashboard-summary.png
docs/screenshots/weekly-report.png
```

Suggested screenshots:

- Popup overview with active tracking.
- Dashboard summary cards and charts.
- Weekly productivity report.
- Top websites section.

## Features

### Time Tracking

- Tracks active website time from browser tab events.
- Commits elapsed time safely when the user switches tabs or changes websites.
- Avoids counting time when Chrome is unfocused.
- Uses idle detection to prevent inflated tracking during inactivity.

### Website Categorization

- Categorizes known domains into:
  - Productive
  - Unproductive
  - Neutral
- Handles subdomains safely.
- Falls back to neutral for unknown websites.

### Popup UI

- Compact extension-friendly interface.
- Shows current active website.
- Shows today's total, productive, unproductive, and neutral time.
- Shows productivity score and top sites for the day.
- Communicates with the background service worker for live state.

### Analytics Dashboard

- Full-page analytics view.
- Summary cards.
- Daily usage chart.
- Productive vs unproductive chart.
- Weekly productivity trend.
- Top websites and most visited websites.
- Productivity insights.
- Weekly productivity report.

### Weekly Reports

- Weekly productivity score.
- Average daily tracked time.
- Most productive day.
- Top productive website.
- Most distracting website.
- Trend summary based on tracked days.

## Tech Stack

- React
- Vite
- Tailwind CSS
- Manifest V3
- Chrome Extension APIs
- Chart.js
- `react-chartjs-2`
- JavaScript
- pnpm

## Architecture Overview

This is not a normal single-page React app. It is a Chrome Extension with multiple environments:

- Background service worker
- Popup UI
- Dashboard page
- Utility modules

The background service worker owns all tracking behavior. The popup and dashboard only display analytics and request live state.

```text
Chrome Events
  -> Background Service Worker
    -> Tracking Engine
      -> chrome.storage.local
        -> Popup UI
        -> Dashboard UI
```

## Folder Structure

```text
src/
  background/
    background.js              # MV3 service worker and event orchestration

  popup/
    Popup.jsx                  # Popup interface
    popupData.js               # Popup data loading and messaging
    popupMetrics.js            # Popup display calculations

  dashboard/
    Dashboard.jsx              # Dashboard page
    dashboardAnalytics.js      # Analytics aggregation
    dashboardSections.jsx      # Dashboard sections
    dashboardChartComponents.jsx
    dashboardCharts.js

  hooks/
    usePopupData.js
    useDashboardData.js
    useCurrentTime.js

  utils/
    storage.js                 # chrome.storage.local wrapper
    tracker.js                 # Session tracking engine
    categorize.js              # Domain parsing and categorization
    categoryConfig.js          # Domain lists
    messages.js                # Message constants
    runtimeMessaging.js        # Safe runtime messaging
    liveSessionTime.js         # Live elapsed time helper
    diagnostics.js
    validation.js
```

## Storage Design

The extension uses `chrome.storage.local` as the source of truth.

Main keys:

```text
appMeta
settings
dailyStats
activeSession
```

`dailyStats` stores committed analytics by date. `activeSession` stores the currently active or paused session so the extension can recover safely after service worker suspension or browser restart.

## Setup Instructions

Install dependencies:

```bash
pnpm install
```

Run Vite development server:

```bash
pnpm dev
```

Build the extension:

```bash
pnpm build:extension
```

Lint the project:

```bash
pnpm lint
```

## Loading the Extension in Chrome

1. Run:

```bash
pnpm build:extension
```

2. Open Chrome and go to:

```text
chrome://extensions
```

3. Enable Developer mode.

4. Click "Load unpacked".

5. Select the generated `dist` folder.

6. Pin the extension and open the popup.

7. Open the dashboard from the popup or from Extension details -> Extension options.

Important: do not open `dashboard.html` directly with `file://`. It should run as a Vite page during development or as a Chrome Extension page after build.

## Testing Checklist

- Open a normal website and confirm tracking starts.
- Switch tabs and confirm the previous session is committed.
- Change URL within the same tab and confirm domain changes are detected.
- Minimize Chrome and confirm tracking pauses.
- Return to Chrome and confirm tracking resumes.
- Wait for idle detection and confirm tracking pauses.
- Reload the extension and confirm storage persists.
- Open popup and dashboard together and confirm synchronized analytics.

## Future Improvements

Realistic future improvements:

- Custom user-defined categories.
- Editable productive/unproductive domain lists.
- Export weekly reports as CSV or PDF.
- Daily or weekly productivity goals.
- Optional notification reminders.
- Optional cloud sync.
- Optional authentication for multi-device usage.

## Limitations

- Productivity classification is rule-based, not context-aware.
- Browser tracking cannot perfectly know whether the user is truly productive.
- MV3 service workers can sleep, so tracking must rely on persisted session state.
- Internal Chrome pages and invalid URLs are not tracked.
- Local storage keeps the project simple but does not sync across devices.

## Project Status

Feature complete for internship submission:

- Tracking engine complete
- Popup UI complete
- Dashboard complete
- Weekly reporting complete
- Live synchronization complete
- Local storage persistence complete

## Documentation

- [Architecture Explanation](docs/ARCHITECTURE.md)
- [Viva and Interview Preparation](docs/VIVA_PREP.md)
