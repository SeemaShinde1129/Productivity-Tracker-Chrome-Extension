import { useSyncExternalStore } from 'react';

function subscribeToClock(callback) {
  const intervalId = setInterval(callback, 1000);

  return () => clearInterval(intervalId);
}

function getClockSnapshot() {
  return Date.now();
}

export function useCurrentTime() {
  return useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getClockSnapshot,
  );
}
