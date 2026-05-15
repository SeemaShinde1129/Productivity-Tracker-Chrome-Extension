export const MESSAGE_SOURCE = 'productivity-tracker';

export const MESSAGE_TYPES = Object.freeze({
  GET_LIVE_TRACKING_STATE: 'tracking:get-live-state',
  SET_TRACKING_ENABLED: 'popup:set-tracking-enabled',
});

export function createExtensionMessage(type, payload = {}) {
  return {
    source: MESSAGE_SOURCE,
    type,
    payload,
  };
}

export function createSuccessResponse(data) {
  return {
    ok: true,
    data,
  };
}

export function createErrorResponse(error) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

export function isExtensionMessage(message) {
  return message?.source === MESSAGE_SOURCE &&
    Object.values(MESSAGE_TYPES).includes(message.type);
}
