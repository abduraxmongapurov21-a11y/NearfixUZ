import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { startBackend } from "./server-runtime.js";

const runtime = startBackend(env.PORT);
runtime.server.on("listening", () => {
  console.log(`NearFIX backend listening on http://localhost:${env.PORT}`);
});

async function shutdown() {
  await runtime.close();
  await prisma.$disconnect();
}
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
