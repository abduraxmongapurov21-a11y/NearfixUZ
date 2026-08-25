let registrationQueue = Promise.resolve();

export function enqueuePushRegistration(task) {
  const next = registrationQueue.then(task);
  registrationQueue = next.catch(() => null);
  return next;
}

export async function waitForPendingPushRegistration() {
  await registrationQueue.catch(() => null);
}
