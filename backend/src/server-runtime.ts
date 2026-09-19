import { createApp } from "./http/app.js";
import { startOrderExpiryRunner } from "./modules/orders/order-expiry-runner.js";

// Shared by the actual process entry point and loopback HTTP integration tests.
export function startBackend(port: number, host?: string) {
  const expiry = startOrderExpiryRunner();
  const app = createApp();
  const server = host ? app.listen(port, host) : app.listen(port);
  let closing: Promise<void> | null = null;
  return {
    server,
    close() {
      closing ??= Promise.all([
        expiry.stop(),
        new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      ]).then(() => {});
      return closing;
    }
  };
}
