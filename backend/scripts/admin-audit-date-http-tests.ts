import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, AdminAccountStatus, UserRole } from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const target = assertLocalDatabaseTarget();
if (target.nodeEnv !== "test" || target.host !== "127.0.0.1" ||
    target.database !== process.env.F1_DISPOSABLE_DATABASE || !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)) {
  throw new Error("Fresh granted disposable database required");
}
const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { env } = await import("../src/config/env.js");
const { hashPassword } = await import("../src/modules/auth/password.js");
const { createAccessToken } = await import("../src/modules/auth/session.js");
const reproduce = process.argv.includes("--reproduce") || process.env.ADMIN_AUDIT_DATE_REPRODUCE === "1";
const action = `f4.audit.date.${randomUUID()}`;
const day = "2026-10-10";
const fixtureRows = [
  ["previous-last-ms", "2026-10-09T23:59:59.999Z"],
  ["day-start", "2026-10-10T00:00:00.000Z"],
  ["day-midday", "2026-10-10T12:34:56.789Z"],
  ["day-last-ms", "2026-10-10T23:59:59.999Z"],
  ["next-day-start", "2026-10-11T00:00:00.000Z"]
] as const;
let phase = "owned database identity";
let passed = 0;
let requests = 0;
let beforeDefects = 0;
let server: Server | undefined;
let baseUrl = "";
class CaseFailure extends Error {}
function equal(actual: unknown, expected: unknown, message: string) {
  try { assert.deepEqual(actual, expected); } catch { throw new CaseFailure(message); }
}
async function test(name: string, body: () => Promise<void>) {
  phase = name;
  await body(); passed += 1;
  console.log(`[F4] ${reproduce ? "DIAGNOSTIC_PASS" : "PASS"} ${name}`);
}
async function request(method: string, pathname: string, token?: string, body?: unknown) {
  requests += 1;
  const response = await fetch(baseUrl + pathname, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, data: await response.json() as any };
}
async function login(username: string, password: string) {
  const response = await request("POST", "/admin/auth/login", undefined, { username, password });
  equal(response.status, 200, "Synthetic administrator login succeeds");
  return response.data.token as string;
}
async function main() {
  const identity = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<Array<{ database: string; port: number; runId: string }>>`
      SELECT current_database() AS database, current_setting('port')::int AS port, id AS "runId" FROM nearfix_test_isolation.run`;
  });
  equal(identity, [{ database: target.database, port: target.port, runId: process.env.F21_TEST_RUN_ID }], "Live DB identity matches parent-granted target");
  const password = randomUUID();
  const passwordHash = await hashPassword(password);
  async function account(label: string, permissions: string[], role: AdminAccountRole = AdminAccountRole.ADMIN) {
    return prisma.adminAccount.create({ data: {
      username: `f4-audit-${label}-${randomUUID()}`, passwordHash, role,
      status: AdminAccountStatus.ACTIVE, mustChangePassword: false,
      permissions: { create: permissions.map((permission) => ({ permission })) }
    } });
  }
  const reader = await account("reader", ["audit.read"]);
  const noPermission = await account("no-audit", ["workers.read"]);
  const superadmin = await account("super", [], AdminAccountRole.SUPER_ADMIN);
  const mobile = await prisma.user.create({ data: { phone: `f4-audit-mobile-${randomUUID()}`, role: UserRole.CLIENT } });
  const mobileSession = await prisma.session.create({ data: { userId: mobile.id, refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) } });
  const mobileToken = createAccessToken({ userId: mobile.id, sessionId: mobileSession.id, sessionVersion: mobile.sessionVersion });
  for (const [label, timestamp] of fixtureRows) {
    await prisma.adminAuditLog.create({ data: {
      action, actorType: label === "day-midday" ? "ADMIN_ACCOUNT" : "ENV_ADMIN",
      actorAdminId: label === "day-midday" ? reader.id : null,
      targetType: "F4DateBoundary", targetId: label,
      metadata: { fixtureLabel: label, password: "synthetic-redaction-value" }, createdAt: new Date(timestamp)
    } });
  }
  const persisted = () => prisma.adminAuditLog.findMany({ where: { action }, orderBy: { id: "asc" } });
  const original = await persisted();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const readerToken = await login(reader.username, password);
  const noPermissionToken = await login(noPermission.username, password);
  const superToken = await login(superadmin.username, password);
  const envToken = await login(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  async function query(values: Record<string, string> = {}, token: string | undefined = readerToken) {
    return request("GET", `/admin/audit-logs?${new URLSearchParams({ action, limit: "100", ...values })}`, token);
  }
  async function labels(values: Record<string, string>, expected: string[], token = readerToken) {
    const result = await query(values, token);
    equal(result.status, 200, "Authorized audit HTTP query succeeds");
    equal(result.data.logs.map((log: any) => log.metadata.fixtureLabel).sort(), [...expected].sort(), "Exact dated audit rows returned");
    equal(result.data.pagination.total, expected.length, "Pagination count matches same date predicate");
    for (const log of result.data.logs) equal(log.metadata.password, "[redacted]", "Audit metadata sanitization preserved");
    equal(await persisted(), original, "Audit reads cannot mutate stored data");
    return result.data;
  }
  console.log("[F4] Owned disposable PostgreSQL identity verified; fixed UTC timestamp fixtures; loopback actual HTTP only");
  await test("date-only from/to covers full selected UTC calendar day", async () => {
    await labels({ from: day, to: day }, reproduce ? ["day-start"] : ["day-start", "day-midday", "day-last-ms"]);
    if (reproduce) {
      beforeDefects += 1;
      console.log("[F4] REPRODUCE date-only range contract=FAIL; midnightIncluded=true; sameDayMiddayIncluded=false; sameDayLastMillisecondIncluded=false; nextMidnightExcluded=true");
    }
  });
  await test("date-only upper bound includes midday/last millisecond and excludes next midnight", async () => {
    await labels({ to: day }, reproduce ? ["previous-last-ms", "day-start"] : ["previous-last-ms", "day-start", "day-midday", "day-last-ms"]);
    if (reproduce) {
      beforeDefects += 1;
      console.log("[F4] REPRODUCE date-only upper-bound contract=FAIL; previousDayPreserved=true; selectedDayTruncatedAtMidnight=true");
    }
  });
  await test("explicit UTC ISO upper bound remains inclusive at the exact supplied instant", async () => {
    await labels({ from: day, to: "2026-10-10T12:34:56.789Z" }, ["day-start", "day-midday"]);
  });
  await test("explicit offset ISO upper bound preserves its exact UTC-equivalent instant", async () => {
    await labels({ from: day, to: "2026-10-10T17:34:56.789+05:00" }, ["day-start", "day-midday"]);
  });
  await test("date-only lower bound remains UTC midnight inclusive", async () => {
    await labels({ from: day }, ["day-start", "day-midday", "day-last-ms", "next-day-start"]);
  });
  await test("next-day range includes only next midnight fixture", async () => {
    await labels({ from: "2026-10-11", to: "2026-10-11" }, ["next-day-start"]);
  });
  await test("invalid date query values preserve existing ignored-filter behavior", async () => {
    await labels({ from: "not-a-date", to: "not-a-date" }, fixtureRows.map(([label]) => label));
  });
  await test("audit RBAC rejects no-permission admin, mobile user, anonymous and tampered token", async () => {
    const path = `/admin/audit-logs?${new URLSearchParams({ action, from: day, to: day })}`;
    for (const [token, status] of [[noPermissionToken, 403], [mobileToken, 401], [undefined, 401], ["synthetic-tampered-token", 401]] as const) {
      equal((await request("GET", path, token)).status, status, "Existing audit authorization boundary preserved");
      equal(await persisted(), original, "Denied query cannot mutate audit data");
    }
  });
  if (reproduce) { equal(beforeDefects, 2, "Both date-only truncation observations reproduced"); return; }

  await test("date-only filtered pagination counts all three selected-day rows", async () => {
    const first = await query({ from: day, to: day, limit: "2", page: "1" });
    const second = await query({ from: day, to: day, limit: "2", page: "2" });
    equal([first.status, second.status], [200, 200], "Paged queries succeed");
    equal(first.data.logs.map((log: any) => log.metadata.fixtureLabel), ["day-last-ms", "day-midday"], "Newest selected-day rows appear first");
    equal(second.data.logs.map((log: any) => log.metadata.fixtureLabel), ["day-start"], "Midnight row appears on second page");
    equal(first.data.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 }, "First-page pagination consistent");
    equal(second.data.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 }, "Second-page pagination consistent");
  });
  await test("explicit midnight timestamp stays an exact instant instead of expanding to full day", async () => {
    await labels({ from: day, to: "2026-10-10T00:00:00.000Z" }, ["day-start"]);
  });
  await test("explicit next-midnight timestamp remains inclusive rather than a date-only boundary", async () => {
    await labels({ from: day, to: "2026-10-11T00:00:00.000Z" }, ["day-start", "day-midday", "day-last-ms", "next-day-start"]);
  });
  await test("trimmed date-only query retains full-day behavior", async () => {
    await labels({ from: ` ${day} `, to: ` ${day} ` }, ["day-start", "day-midday", "day-last-ms"]);
  });
  await test("environment superadmin gets the same inclusive calendar-day result", async () => {
    await labels({ from: day, to: day }, ["day-start", "day-midday", "day-last-ms"], envToken);
  });
  await test("DB superadmin bypass preserves same date predicate independently of audit.read", async () => {
    await labels({ from: day, to: day }, ["day-start", "day-midday", "day-last-ms"], superToken);
  });
  await test("actor filter composes with full-day upper bound without losing the midday DB actor", async () => {
    await labels({ from: day, to: day, actorType: "ADMIN_ACCOUNT", actorAdminId: reader.id }, ["day-midday"]);
  });
  await test("target filters compose with full-day upper bound and metadata remains sanitized", async () => {
    await labels({ from: day, to: day, targetType: "F4DateBoundary", targetId: "day-last-ms" }, ["day-last-ms"]);
  });
  equal(await persisted(), original, "Entire regression leaves all five persisted fixtures unchanged");
}
main().then(() => console.log(`[F4] admin audit date ${reproduce ? "REPRODUCE" : "HTTP regression"}: ${passed} cases; ${requests} HTTP requests; beforeContractFailures=${beforeDefects}; harness=PASS`))
  .catch((error: unknown) => {
    console.log(`[F4] FAIL ${phase}: ${error instanceof CaseFailure ? error.message : "unexpected fixture/HTTP error; details suppressed"}`);
    process.exitCode = 1;
  }).finally(async () => {
    try {
      if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    } finally { await prisma.$disconnect(); }
  });
