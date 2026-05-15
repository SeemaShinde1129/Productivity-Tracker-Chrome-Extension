import {
  MESSAGE_TYPES,
  createExtensionMessage,
} from './messages.js';

const DEFAULT_MESSAGE_TIMEOUT_MS = 3000;

function getChromeApi() {
  return globalThis.chrome ?? null;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function createTimeoutError(type, timeoutMs) {
  return new Error(`Background message "${type}" timed out after ${timeoutMs}ms.`);
}

export function canUseRuntimeMessaging() {
  return Boolean(getChromeApi()?.runtime?.sendMessage);
}

export function sendRuntimeMessage(type, payload = {}, options = {}) {
  const chromeApi = getChromeApi();
  const timeoutMs = options.timeoutMs ?? DEFAULT_MESSAGE_TIMEOUT_MS;

  if (!chromeApi?.runtime?.sendMessage) {
    return Promise.reject(new Error('Chrome runtime messaging is unavailable.'));
  }

  return new Promise((resolve, reject) => {
    let isSettled = false;
    const timeoutId = setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      reject(createTimeoutError(type, timeoutMs));
    }, timeoutMs);

    try {
      chromeApi.runtime.sendMessage(
        createExtensionMessage(type, payload),
        (response) => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          clearTimeout(timeoutId);

          const runtimeError = chromeApi.runtime.lastError;

          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error ?? 'Background request failed.'));
            return;
          }

          resolve(response.data);
        },
      );
    } catch (error) {
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

export async function requestLiveTrackingState(options = {}) {
  try {
    return await sendRuntimeMessage(
      MESSAGE_TYPES.GET_LIVE_TRACKING_STATE,
      {},
      options,
    );
  } catch (error) {
    throw new Error(`Unable to load live tracking state: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
}
