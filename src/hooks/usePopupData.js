import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestPopupState,
  updateTrackingEnabled,
} from '../popup/popupData.js';

const STORAGE_REFRESH_DEBOUNCE_MS = 150;
const STORAGE_KEYS_TO_REFRESH = new Set([
  'activeSession',
  'dailyStats',
  'settings',
]);

function shouldRefreshFromStorageChange(changes, areaName) {
  if (areaName !== 'local') {
    return false;
  }

  return Object.keys(changes).some((key) => STORAGE_KEYS_TO_REFRESH.has(key));
}

export function usePopupData() {
  const [popupState, setPopupState] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadPopupState = useCallback(async (options = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!options.silent) {
      setStatus((currentStatus) =>
        currentStatus === 'ready' ? 'refreshing' : 'loading',
      );
    }

    try {
      const nextState = await requestPopupState();

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      setPopupState(nextState);
      setError(nextState.error ?? null);
      setStatus('ready');

      return nextState;
    } catch (loadError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      setError(loadError.message);
      setStatus('error');
      return null;
    }
  }, []);

  const setTrackingEnabled = useCallback(async (enabled) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsSaving(true);
    setError(null);

    try {
      const nextState = await updateTrackingEnabled(enabled);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      setPopupState(nextState);
      setStatus('ready');

      return nextState;
    } catch (saveError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      setError(saveError.message);
      setStatus('error');
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let refreshTimerId = null;

    const scheduleSilentRefresh = () => {
      clearTimeout(refreshTimerId);
      refreshTimerId = setTimeout(() => {
        loadPopupState({ silent: true });
      }, STORAGE_REFRESH_DEBOUNCE_MS);
    };

    const chromeApi = globalThis.chrome;
    const handleStorageChanged = (changes, areaName) => {
      if (shouldRefreshFromStorageChange(changes, areaName)) {
        scheduleSilentRefresh();
      }
    };
    const handleWindowFocus = () => {
      scheduleSilentRefresh();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleSilentRefresh();
      }
    };

    Promise.resolve().then(() => {
      if (isMountedRef.current) {
        loadPopupState();
      }
    });

    chromeApi?.storage?.onChanged?.addListener(handleStorageChanged);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearTimeout(refreshTimerId);
      chromeApi?.storage?.onChanged?.removeListener(handleStorageChanged);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadPopupState]);

  return {
    error,
    isLoading: status === 'loading' && !popupState,
    isRefreshing: status === 'refreshing',
    isSaving,
    popupState,
    refresh: loadPopupState,
    setTrackingEnabled,
    status,
  };
}
