import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { isolationClaim, type IsolationClaim } from "./test-isolation.js";

// Never run these fixtures against the developer's database or a remote host.
// Only the newly created, uniquely named database may be initialized/dropped.
const allowedTests = new Set([
  "chat-read-compat-http-tests",
  "chat-sync-http-tests",
  "chat-mobile-state-tests",
  "chat-mobile-runtime",
  "chat-privacy-http-tests",
  "password-auth-tests",
  "unified-auth-api-tests",
  "notification-rating-v1-tests",
  "order-expiry-http-tests",
  "order-lifecycle-tests",
  "order-capability-tests",
  "worker-created-order-tests",
  "order-location-snapshot-tests",
  "order-mobile-runtime",
  "test-isolation-positive"
]);
const testName = process.argv[2] || "chat-privacy-http-tests";
let stage = "disposable cluster setup";
let owned: (IsolationClaim & { target: string; database: string; port: number; oid: string }) | null = null;

async function verifyOwnedDatabase() {
  if (!owned) throw new Error("No owned database");
  const proof = new PrismaClient({ datasources: { db: { url: owned.target } }, log: [] });
  try {
    const rows = await proof.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return tx.$queryRaw<Array<{ database: string; oid: string; port: number; runId: string }>>`
        SELECT current_database() AS database,
          (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS oid,
          current_setting('port')::int AS port, id AS "runId" FROM nearfix_test_isolation.run`;
    });
    const row = rows[0];
    if (rows.length !== 1 || row.database !== owned.database || row.port !== owned.port ||
        row.runId !== owned.runId || (owned.oid && row.oid !== owned.oid)) throw new Error("Owned identity mismatch");
    return row.oid;
  } finally { await proof.$disconnect(); }
}

async function run(args: string[], childEnv: NodeJS.ProcessEnv, label: string, executable = process.execPath) {
  stage = label;
  const nodeChild = executable === process.execPath;
  const guardedArgs = nodeChild ? ["--import", "tsx", "--import", "./scripts/test-isolation-preload.ts", ...
    (args[0] === "--import" && args[1] === "tsx" ? args.slice(2) : args)] : args;
  const child = spawn(executable, guardedArgs, { env: childEnv, windowsHide: true,
    stdio: nodeChild ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"] });
  let requestUsed = false;
  child.on("message", async (message: unknown) => {
    const request = message as { type?: string; claim?: IsolationClaim; nonce?: string };
    if (requestUsed || request?.type !== "nearfix-isolation-request") return;
    requestUsed = true;
    let approved = false;
    try {
      if (!owned || request.claim?.runId !== owned.runId || request.claim.fingerprint !== owned.fingerprint) throw new Error("Wrong target");
      await verifyOwnedDatabase();
      approved = true;
    } catch { /* Never return a connection string or database exception. */ }
    if (child.connected) child.send({ type: "nearfix-isolation-grant", grant: {
      approved, nonce: request.nonce, runId: owned?.runId, fingerprint: owned?.fingerprint
    } });
  });
  let output = "";
  let liveLine = "";
  child.stdout!.on("data", (chunk) => {
    output += String(chunk);
    if (testName === "order-mobile-runtime" || testName === "chat-mobile-runtime") {
      liveLine += String(chunk);
      const lines = liveLine.split(/\r?\n/);
      liveLine = lines.pop() || "";
      for (const line of lines) if (line.startsWith("[F2] ") || line.startsWith("[F3] ")) console.log(line);
    }
  });
  // Do not forward framework errors: they can contain SQL parameters or URLs.
  child.stderr!.resume();
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    // pg_ctl's detached server can inherit pipe handles on Windows. Its exit,
    // not pipe closure, reports completion of the -w startup check.
    child.once(executable === process.execPath ? "close" : "exit", resolve);
  });
  if (executable !== process.execPath) { child.stdout!.destroy(); child.stderr!.destroy(); }
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("[F4] ")) console.log(line);
    if (testName !== "chat-mobile-runtime" && line.startsWith("[F3] ")) console.log(line);
    if ((testName === "chat-privacy-http-tests" && line.startsWith("[F1] ")) || (testName !== "order-mobile-runtime" && line.startsWith("[F2] ")) || line.startsWith("[F2.1] ")) console.log(line);
  }
  console.log(`[F1] ${label}: ${exitCode === 0 ? "PASS" : "FAIL"} (exit=${exitCode})`);
  return exitCode === 0;
}

async function main() {
  if (!allowedTests.has(testName)) throw new Error("Unsupported test");
  // Do not connect to DATABASE_URL from the user's environment at all.
  // Use installed PostgreSQL binaries, without installing/changing a service.
  const pgBin = process.env.F1_POSTGRES_BIN || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "");
  const executable = (name: string) => path.join(pgBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
  const tempParent = await realpath(tmpdir());
  const clusterDir = await realpath(await mkdtemp(path.join(tempParent, "nearfix-f1-pg-")));
  if (path.dirname(clusterDir) !== tempParent || !path.basename(clusterDir).startsWith("nearfix-f1-pg-")) {
    throw new Error("Invalid owned temporary directory");
  }
  const portProbe = createServer();
  await new Promise<void>((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
  const port = (portProbe.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
  const databaseName = `nearfix_chat_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^nearfix_chat_test_[a-f0-9]{32}$/.test(databaseName)) throw new Error("Invalid disposable name");
  const adminUrl = `postgresql://f1_test@127.0.0.1:${port}/postgres`;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } }, log: [] });
  const target = `postgresql://f1_test@127.0.0.1:${port}/${databaseName}?schema=public`;
  const inheritedEnv = { ...process.env };
  delete inheritedEnv.NODE_OPTIONS;
  for (const key of Object.keys(inheritedEnv)) if (key.startsWith("DOTENV_CONFIG_")) delete inheritedEnv[key];
  const emptyEnvPath = path.join(clusterDir, "isolated.env");
  // initdb requires an empty directory; create this file only after initdb.
  const childEnv: NodeJS.ProcessEnv = {
    ...inheritedEnv,
    NODE_ENV: "test",
    DATABASE_URL: target,
    DIRECT_URL: target,
    F1_DISPOSABLE_DATABASE: databaseName,
    F21_TEST_RUN_ID: randomUUID(),
    DOTENV_CONFIG_PATH: emptyEnvPath,
    ACCESS_TOKEN_SECRET: randomUUID(),
    SESSION_SECRET: randomUUID(),
    ADMIN_USERNAME: "f1-disposable-admin",
    ADMIN_PASSWORD: randomUUID(),
    OTP_PROVIDER: "fake",
    APP_REVIEW_DEMO_ENABLED: "false",
    APP_REVIEW_DEMO_EXTRA_ACCOUNTS_JSON: "",
    ESKIZ_EMAIL: "",
    ESKIZ_PASSWORD: "",
    R2_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_BUCKET_NAME: "",
    R2_PUBLIC_URL: ""
  };
  let created = false;
  let started = false;
  try {
    const initializedCluster = await run(["-D", clusterDir, "-U", "f1_test", "-A", "trust", "--no-locale", "--encoding=UTF8"],
      childEnv, "initialize isolated temporary PostgreSQL cluster", executable("initdb"));
    if (!initializedCluster) { process.exitCode = 1; return; }
    await writeFile(emptyEnvPath, "# dotenv/config fallback disabled for this disposable child.\n");
    // Trust is limited to this disposable loopback-only fixture cluster.
    // No real credentials/data are copied into it.
    started = await run(["-D", clusterDir, "-l", path.join(clusterDir, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -F`, "-w", "-t", "15", "start"],
      childEnv, "start isolated temporary PostgreSQL", executable("pg_ctl"));
    if (!started) throw new Error("Temporary PostgreSQL start failed");
    stage = "create disposable database";
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    owned = { ...isolationClaim(childEnv), target, database: databaseName, port, oid: "" };
    const proof = new PrismaClient({ datasources: { db: { url: target } }, log: [] });
    try {
      await proof.$executeRawUnsafe('CREATE SCHEMA nearfix_test_isolation');
      await proof.$executeRawUnsafe('CREATE TABLE nearfix_test_isolation.run (id text PRIMARY KEY)');
      await proof.$executeRaw`INSERT INTO nearfix_test_isolation.run (id) VALUES (${owned.runId})`;
    } finally { await proof.$disconnect(); }
    owned.oid = await verifyOwnedDatabase();
    console.log("[F1] Database: loopback, fresh disposable database; original database untouched");
    const initialized = await run([
      "node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"
    ], childEnv, "initialize existing schema in disposable database");
    if (!initialized) { process.exitCode = 1; return; }
    if (testName === "worker-created-order-tests") {
      // This existing test expects an unrelated active catalog category.
      // Seed only that prerequisite in the newly created disposable database.
      const fixtureDb = new PrismaClient({ datasources: { db: { url: target } }, log: [] });
      try {
        await fixtureDb.category.create({ data: {
          slug: "f2-disposable-other-category", nameUz: "F2 other", nameRu: "F2 other", nameEn: "F2 other", iconKey: "wrench"
        } });
      } finally { await fixtureDb.$disconnect(); }
      console.log("[F2] Seeded unrelated category prerequisite in disposable database only");
    }
    const passed = await run(["--import", "tsx", `scripts/${testName}.ts`], childEnv, testName);
    if (!passed) process.exitCode = 1;
  } finally {
    try {
      if (created) {
        stage = "drop owned disposable database";
        await verifyOwnedDatabase();
        await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
        console.log("[F1] Owned disposable database removed; no fixture records retained");
      }
    } finally {
      await admin.$disconnect();
      // Stop only the cluster we created, then verify its exact path before deletion.
      const hasPidFile = await stat(path.join(clusterDir, "postmaster.pid")).then(() => true, () => false);
      if (hasPidFile && !(await run(["-D", clusterDir, "-m", "fast", "-w", "stop"], childEnv,
        "stop owned temporary PostgreSQL", executable("pg_ctl")))) throw new Error("Temporary PostgreSQL stop failed");
      const resolved = await realpath(clusterDir);
      if (resolved !== clusterDir || path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith("nearfix-f1-pg-")) {
        throw new Error("Refusing temporary directory cleanup");
      }
      await rm(resolved, { recursive: true });
      console.log("[F1] Owned temporary cluster removed; existing service/configuration unchanged");
    }
  }
}

main().catch(() => {
  console.error(`[F1] BLOCKED at ${stage}; error details suppressed to protect credentials`);
  process.exitCode = 1;
});
