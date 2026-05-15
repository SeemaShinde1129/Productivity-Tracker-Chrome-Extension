# Productivity Tracker Architecture

This document explains the internal architecture of the Productivity Tracker Chrome Extension.

## High-Level Architecture

Productivity Tracker is a Manifest V3 Chrome Extension. It is split into separate runtime environments:

```text
Background Service Worker
  Owns tracking logic, browser events, recovery, and storage writes.

Popup UI
  Shows a quick live summary. It does not own tracking state.

Dashboard UI
  Shows analytics, charts, insights, and weekly reports.

Utilities
  Shared storage, tracking, categorization, messaging, validation, and formatting helpers.
```

The main design rule is:

```text
Background owns behavior.
Storage owns persisted data.
Popup and dashboard only display data.
```

## Manifest V3 Lifecycle

Manifest V3 uses a service worker instead of a persistent background page.

Important behavior:

- The background service worker starts when Chrome needs it.
- It wakes for events such as tab changes, URL updates, messages, startup, install, idle changes, and window focus changes.
- It can stop when idle.
- In-memory variables can be lost when the worker sleeps.
- Data in `chrome.storage.local` survives worker sleep, extension reload, and browser restart.

Because of this, the project avoids relying on long-lived background memory for tracking. Important session state is persisted in storage.

## Background Service Worker

File:

```text
src/background/background.js
```

Responsibilities:

- Register top-level Chrome event listeners.
- Initialize storage on install/startup.
- Detect active tab changes.
- Detect URL/domain changes.
- Detect Chrome focus/unfocus.
- Detect idle/locked state.
- Start, pause, recover, and commit sessions.
- Respond to popup/dashboard live-state messages.

Important Chrome APIs used:

- `chrome.runtime.onInstalled`
- `chrome.runtime.onStartup`
- `chrome.runtime.onMessage`
- `chrome.tabs.onActivated`
- `chrome.tabs.onUpdated`
- `chrome.tabs.onRemoved`
- `chrome.windows.onFocusChanged`
- `chrome.windows.onRemoved`
- `chrome.idle.onStateChanged`

## Tracking Engine

File:

```text
src/utils/tracker.js
```

The tracking engine manages active website sessions.

An active session represents:

- Current domain
- Current tab ID
- Website category
- Start timestamp
- Last committed timestamp
- Focus state
- Idle state
- Whether it is actively counting

The engine exposes functions for:

- Starting a session
- Committing a session
- Pausing a session
- Clearing a session
- Recovering a session

Elapsed time is validated before being committed. This prevents inflated tracking caused by laptop sleep, stale sessions, or service worker suspension.

## Storage Design

File:

```text
src/utils/storage.js
```

Storage uses `chrome.storage.local`.

Top-level keys:

```text
appMeta
settings
dailyStats
activeSession
```

### `appMeta`

Stores schema and install/update metadata.

### `settings`

Stores user/configuration settings:

- Tracking enabled
- Idle threshold
- Max session gap
- Ignored domains
- Category overrides

### `dailyStats`

Stores committed analytics by date.

Example shape:

```js
{
  "2026-05-09": {
    date: "2026-05-09",
    totalSeconds: 1200,
    productiveSeconds: 700,
    unproductiveSeconds: 300,
    neutralSeconds: 200,
    sites: {
      "github.com": {
        domain: "github.com",
        category: "productive",
        seconds: 500,
        visits: 3,
        lastVisitedAt: 1778300000000
      }
    }
  }
}
```

### `activeSession`

Stores the current active or paused session. This is necessary because Manifest V3 service workers can sleep.

## Categorization System

Files:

```text
src/utils/categorize.js
src/utils/categoryConfig.js
```

The categorization system:

- Extracts hostnames safely from URLs.
- Normalizes domains.
- Removes `www.` safely.
- Handles invalid URLs and Chrome internal pages.
- Matches against productive/unproductive domain sets.
- Returns neutral for unknown sites.

Unknown websites are neutral by default to avoid misleading analytics.

## Popup Responsibilities

Files:

```text
src/popup/
src/hooks/usePopupData.js
```

The popup is a lightweight overview.

It shows:

- Current active website
- Live session time
- Today's totals
- Productivity score
- Top sites today

The popup does not:

- Track sessions directly
- Register browser event listeners
- Own analytics state

It reads committed analytics from storage and requests live state from the background worker.

## Dashboard Responsibilities

Files:

```text
src/dashboard/
src/hooks/useDashboardData.js
```

The dashboard visualizes analytics.

It shows:

- Summary cards
- Daily activity chart
- Productive vs unproductive chart
- Weekly trend chart
- Top websites
- Productivity insights
- Weekly productivity report

The dashboard does not track sessions. It aggregates stored analytics and renders reports.

## Messaging Flow

Files:

```text
src/utils/messages.js
src/utils/runtimeMessaging.js
```

Messaging is used when UI needs live background state.

Example:

```text
Popup opens
  -> requests tracking:get-live-state
    -> background returns activeSession + context
      -> popup renders live state
```

Storage listeners are used for committed analytics updates:

```text
Background commits session
  -> chrome.storage.local changes
    -> popup/dashboard storage listeners refresh data
```

This avoids unnecessary polling and keeps storage as the source of truth.

## Analytics Aggregation

File:

```text
src/dashboard/dashboardAnalytics.js
```

Analytics are built from `dailyStats`.

The dashboard calculates:

- Daily series
- Weekly totals
- Productivity score
- Category percentages
- Top websites
- Most visited websites
- Most productive day
- Most distracting website
- Weekly report

The productivity score is:

```text
productiveSeconds / totalSeconds * 100
```

This is simple, explainable, and suitable for an internship-level project.

## Reliability Decisions

The project includes reliability protections:

- Active sessions are persisted.
- Elapsed time is validated before commit.
- Suspicious long gaps are capped or paused.
- Chrome unfocus pauses tracking.
- Idle state pauses tracking.
- Popup/dashboard do not mutate tracking state.
- Message failures fall back to stored data where appropriate.

## Why This Architecture Is Practical

The architecture is intentionally simple:

- No backend.
- No authentication.
- No cloud sync.
- No complex state manager.
- No fake AI scoring.

This keeps the project realistic, understandable, and maintainable while still demonstrating real Chrome Extension engineering.
