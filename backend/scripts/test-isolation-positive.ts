import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { isolationClaim } from "./test-isolation.js";
const claimBeforeImports = isolationClaim(process.env);
const { prisma } = await import("../src/db/prisma.js");
await import("../src/config/env.js");
assert.deepEqual(isolationClaim(process.env), claimBeforeImports, "dotenv/Prisma must not replace the target");
try {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<Array<{ database: string; runId: string; readOnly: string }>>`
      SELECT current_database() AS database, id AS "runId", current_setting('transaction_read_only') AS "readOnly"
      FROM nearfix_test_isolation.run`;
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].database, process.env.F1_DISPOSABLE_DATABASE);
  assert.equal(rows[0].runId, process.env.F21_TEST_RUN_ID);
  assert.equal(rows[0].readOnly, "on");
  await assert.rejects(fetch("https://example.invalid/push-stub"), /External test transport disabled/);
  console.log("[F2.1] PASS live runner grant + real DB identity, schema CLI, dotenv/Prisma target retention, external fetch blocked");
} finally { await prisma.$disconnect(); }
