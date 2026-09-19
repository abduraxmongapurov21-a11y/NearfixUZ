import "./test-isolation-preload.js";
// Disposable DB fixture/control harness. No test HTTP endpoints are added to the app.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";
const target = assertLocalDatabaseTarget();
if (target.nodeEnv !== "test" || target.database !== process.env.F1_DISPOSABLE_DATABASE || !/^nearfix_chat_test_[a-f0-9]{32}$/.test(target.database)) throw new Error("Disposable DB required");
if (!process.env.F2_MOBILE_CONTROL_DIR) throw new Error("Fixture control directory required");
const directory = path.resolve(process.env.F2_MOBILE_CONTROL_DIR);
await mkdir(directory, { recursive: true });
const password = randomUUID();
const accounts = [
  { label: "client", phone: "+998000000921", role: "CLIENT" as const },
  { label: "worker", phone: "+998000000922", role: "PROVIDER" as const },
  { label: "providerClient", phone: "+998000000923", role: "PROVIDER" as const }
];
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "";
process.env.APP_REVIEW_DEMO_WORKER_PHONE = "";
process.env.APP_REVIEW_DEMO_EXTRA_ACCOUNTS_JSON = JSON.stringify(accounts.map((account) => ({ ...account, password })));
const { prisma } = await import("../src/db/prisma.js");
const { startBackend } = await import("../src/server-runtime.js");
const users: Record<string, any> = {};
for (const account of accounts) {
  users[account.label] = await prisma.user.create({ data: { phone: account.phone, role: account.role, name: `F2 ${account.label}`, cityId: "tashkent" } });
  if (account.role === "PROVIDER") await prisma.workerProfile.create({ data: {
    userId: users[account.label].id, status: "APPROVED", profession: "Santexnik", professions: ["Santexnik"],
    availability: { create: { status: "AVAILABLE" } }, serviceLat: 41.31, serviceLng: 69.24
  } });
}
const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: users.worker.id } });
const f4 = process.env.F4_MOBILE_LOCATION === "1";
if (f4) {
  const category = await prisma.category.create({ data: {
    slug: "f4-plumbing", nameUz: "Santexnik", nameRu: "Сантехник", nameEn: "Plumber", iconKey: "wrench"
  } });
  await prisma.workerCategory.create({ data: { workerId: worker.id, categoryId: category.id, isPrimary: true } });
}
const runtime = startBackend(4000, "127.0.0.1");
// Test-only observer; never retain auth headers or add application endpoints.
const locationRequests: unknown[] = [];
if (f4) runtime.server.prependListener("request", (request, response) => {
  if (request.method !== "POST" || request.url !== "/orders") return;
  let body = "";
  request.on("data", (chunk) => { if (body.length < 8192) body += String(chunk); });
  response.once("finish", () => {
    try {
      const input = JSON.parse(body);
      locationRequests.push({ method: "POST", path: "/orders", status: response.statusCode,
        payload: { workerId: input.workerId, cityId: input.cityId, categoryId: input.categoryId,
          location: input.location, addressId: input.addressId, problemTitle: input.problemTitle } });
    } catch { /* No body to capture. */ }
  });
});
await new Promise<void>((resolve) => runtime.server.once("listening", resolve));
const sessions: Record<string, any> = {};
async function api(route: string, actor: string, body?: unknown): Promise<any> {
  const response = await fetch(`http://127.0.0.1:4000${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...(sessions[actor] ? { Authorization: `Bearer ${sessions[actor].token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 401 && route !== "/auth/app-review/login") {
    await response.body?.cancel();
    const account = accounts.find((item) => item.label === actor)!;
    const login = await api("/auth/app-review/login", actor, { phone: account.phone, password });
    if (login.status !== 200) return login;
    sessions[actor] = { ...sessions[actor], token: login.accessToken, refreshToken: login.refreshToken };
    const retry = await fetch(`http://127.0.0.1:4000${route}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessions[actor].token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: retry.status, ...await retry.json() };
  }
  return { status: response.status, ...await response.json() };
}
for (const account of accounts) {
  const result = await api("/auth/app-review/login", account.label, { phone: account.phone, password });
  sessions[account.label] = { token: result.accessToken, refreshToken: result.refreshToken, userId: result.user.id, name: result.user.name, phone: account.phone, role: result.user.role, experienceMode: account.label === "worker" ? "worker" : "client", sessionVersion: result.user.sessionVersion };
}
const privateFile = path.join(directory, "fixture-session.private.json");
await writeFile(privateFile, JSON.stringify({ accounts, password, sessions }));
if (f4) await writeFile(path.join(directory, "ready.json"), JSON.stringify({
  apiBaseUrl: "http://127.0.0.1:4000", runId: process.env.F21_TEST_RUN_ID, workerId: worker.id
}));
console.log("[F2] Mobile fixture ready: disposable database, HTTP port 4000, no registered push devices");
let lastId: string | null = null;
let currentOrderId: string | null = null;
try {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const command = await readFile(path.join(directory, "command.json"), "utf8").then(JSON.parse).catch(() => null);
    if (!command || command.id === lastId) continue;
    lastId = command.id;
    if (command.action === "stop") break;
    let httpStatus: number | undefined;
    const actor = command.actor || "client";
    if (f4 && command.action === "location-evidence") {
      const snapshots = await prisma.order.findMany({ where: { clientId: users.client.id }, select: {
        id: true, locationLat: true, locationLng: true, locationAddressText: true, locationLabel: true, locationDistrict: true
      } });
      currentOrderId = snapshots.at(-1)?.id || currentOrderId;
      await writeFile(path.join(directory, "location-evidence.json"), JSON.stringify({
        runId: process.env.F21_TEST_RUN_ID, requests: locationRequests, snapshots
      }, null, 2));
    }
    if (command.action === "create") {
      await prisma.user.update({ where: { id: users[actor].id }, data: { name: command.longName ? "F2 juda uzun mijoz nomi va qo‘shimcha familiya matni" : `F2 ${actor}` } });
      const result = await api("/orders", actor, { workerId: worker.id, cityId: "tashkent", serviceType: "Santexnik", problemTitle: "F2 runtime order", priceEstimate: 100000, location: { latitude: 41.31, longitude: 69.24, addressText: "F2 synthetic test address" } });
      httpStatus = result.status; currentOrderId = result.order?.id || currentOrderId;
    } else if (command.action === "accept") {
      httpStatus = (await api(`/orders/${currentOrderId}/accept`, "worker")).status;
    } else if (command.action === "cancel") {
      httpStatus = (await api(`/orders/${currentOrderId}/cancel`, actor, { reason: "F2 runtime cancellation" })).status;
    } else if (command.action === "deadline" && currentOrderId) {
      await prisma.order.update({ where: { id: currentOrderId }, data: { responseDeadlineAt: new Date(Date.now() + (command.afterMs || 0)) } });
    }
    const order = currentOrderId ? await prisma.order.findUnique({ where: { id: currentOrderId }, select: { id: true, status: true, responseDeadlineAt: true } }) : null;
    await writeFile(path.join(directory, "result.json"), JSON.stringify({ id: lastId, httpStatus, order }));
    console.log(`[F2] Mobile fixture ${command.action}: ${httpStatus || "DB read/write"}; order status ${order?.status || "none"}`);
  }
} finally {
  await runtime.close();
  await prisma.$disconnect();
  await unlink(privateFile);
  console.log("[F2] Mobile fixture stopped and temporary session file removed");
}
