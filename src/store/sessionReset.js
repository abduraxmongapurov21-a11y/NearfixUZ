const resetHandlers = new Set();

export function registerSessionResetHandler(handler) {
  resetHandlers.add(handler);
  return () => resetHandlers.delete(handler);
}

export function resetRoleStores() {
  resetHandlers.forEach((handler) => {
    try {
      handler();
    } catch {
      // Store reset must not block auth session cleanup.
    }
  });
}
