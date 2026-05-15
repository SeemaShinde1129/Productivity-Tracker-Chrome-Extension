const SECOND_IN_MS = 1000;
const DEFAULT_MAX_SESSION_GAP_SECONDS = 300;

function normalizeSeconds(seconds = 0) {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Math.max(0, Math.floor(seconds));
}

export function getLiveElapsedSeconds(session, now, settings = {}) {
  if (!session?.isTracking) {
    return 0;
  }

  const lastCommittedAt = Number(session.lastCommittedAt || session.startedAt);

  if (!Number.isFinite(lastCommittedAt) || now <= lastCommittedAt) {
    return 0;
  }

  const rawSeconds = Math.floor((now - lastCommittedAt) / SECOND_IN_MS);
  const maxGapSeconds =
    Number(settings.maxSessionGapSeconds) || DEFAULT_MAX_SESSION_GAP_SECONDS;

  return normalizeSeconds(Math.min(rawSeconds, maxGapSeconds));
}
