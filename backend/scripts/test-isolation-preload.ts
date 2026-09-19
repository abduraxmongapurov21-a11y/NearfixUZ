import { authorizeTestProcess, type IsolationGrant } from "./test-isolation.js";

// First dependency of every protected test AND a Node --import for runner
// children, including Prisma CLI. Direct invocation has no live parent IPC.
try {
  await authorizeTestProcess(process.env, process.connected && process.send ? (claim, nonce) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { finish(); reject(new Error("TEST_ISOLATION_REFUSED")); }, 5000);
    const receive = (message: unknown) => {
      const reply = message as { type?: string; grant?: IsolationGrant };
      if (reply?.type !== "nearfix-isolation-grant" || reply.grant?.nonce !== nonce) return;
      finish(); resolve(reply.grant);
    };
    function finish() { clearTimeout(timeout); process.off("message", receive); }
    process.on("message", receive);
    process.send!({ type: "nearfix-isolation-request", claim, nonce });
  }) : undefined);
  if (process.connected) process.disconnect();
} catch {
  console.error("[F2.1] TEST_ISOLATION_REFUSED before test/bootstrap; use the disposable runner");
  process.exit(1);
}

// Test-only transport floor. Tests may install stricter stubs, but their
// restored fetch remains loopback-only. No real push/SMS/storage traffic.
const localFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("External test transport disabled");
  }
  return localFetch(input, init);
};
