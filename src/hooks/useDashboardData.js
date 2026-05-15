import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadDashboardState,
  shouldRefreshDashboardData,
} from '../dashboard/dashboardData.js';

const STORAGE_REFRESH_DEBOUNCE_MS = 200;

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (options = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!options.silent) {
      setStatus((currentStatus) =>
        currentStatus === 'ready' ? 'refreshing' : 'loading',
      );
    }

    try {
      const nextState = await loadDashboardState();

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      setDashboardState(nextState);
      setError(null);
      setStatus('ready');

      return nextState;
    } catch (loadError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }

      console.error('[Productivity Tracker][dashboard] refresh failed', loadError);
      setError(loadError.message);
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let refreshTimerId = null;

    const scheduleSilentRefresh = () => {
      clearTimeout(refreshTimerId);
      refreshTimerId = setTimeout(() => {
        refresh({ silent: true });
      }, STORAGE_REFRESH_DEBOUNCE_MS);
    };

    const chromeApi = globalThis.chrome;
    const handleStorageChanged = (changes, areaName) => {
      if (shouldRefreshDashboardData(changes, areaName)) {
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
        refresh();
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
  }, [refresh]);

  return {
    dashboardState,
    error,
    isLoading: status === 'loading' && !dashboardState,
    isRefreshing: status === 'refreshing',
    refresh,
    status,
  };
}
