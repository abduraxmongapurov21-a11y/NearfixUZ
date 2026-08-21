export function createAccountRequestGuard() {
  let sessionGeneration = 0;
  const requestGenerations = new Map();

  return {
    capture(accountId) {
      return { accountId, sessionGeneration };
    },
    isSessionCurrent(ticket, accountId) {
      return Boolean(
        ticket &&
          ticket.accountId &&
          ticket.accountId === accountId &&
          ticket.sessionGeneration === sessionGeneration
      );
    },
    begin(scope, accountId) {
      const requestGeneration = (requestGenerations.get(scope) || 0) + 1;
      requestGenerations.set(scope, requestGeneration);
      return { scope, accountId, sessionGeneration, requestGeneration };
    },
    isCurrent(ticket, accountId) {
      return Boolean(
        ticket &&
          ticket.accountId &&
          ticket.accountId === accountId &&
          ticket.sessionGeneration === sessionGeneration &&
          requestGenerations.get(ticket.scope) === ticket.requestGeneration
      );
    },
    invalidateSession() {
      sessionGeneration += 1;
      requestGenerations.clear();
    }
  };
}

export function createOperationGuard() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(ticket) {
      return ticket === generation;
    },
    invalidate() {
      generation += 1;
    }
  };
}
