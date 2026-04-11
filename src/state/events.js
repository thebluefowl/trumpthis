const listeners = new Map();

export const events = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  },

  off(event, handler) {
    const handlers = listeners.get(event);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  },

  emit(event, data) {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  },

  clear() {
    listeners.clear();
  },
};
