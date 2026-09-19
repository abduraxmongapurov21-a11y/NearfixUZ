import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function createChatFixture(port = 0) {
  const password = randomUUID();
  const accounts = [
    { label: "client", phone: "+998000000931", role: "CLIENT" as const },
    { label: "worker", phone: "+998000000932", role: "PROVIDER" as const },
    { label: "outsider", phone: "+998000000933", role: "CLIENT" as const },
    { label: "providerClient", phone: "+998000000934", role: "PROVIDER" as const }
  ];
  process.env.APP_REVIEW_DEMO_ENABLED = "true";
  process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "";
  process.env.APP_REVIEW_DEMO_WORKER_PHONE = "";
  process.env.APP_REVIEW_DEMO_EXTRA_ACCOUNTS_JSON = JSON.stringify(accounts.map((account) => ({ ...account, password })));
  const { prisma } = await import("../src/db/prisma.js");
  const { createApp } = await import("../src/http/app.js");
  const { hashPassword } = await import("../src/modules/auth/password.js");
  const hash = await hashPassword(password);
  const users: Record<string, any> = {};
  for (const account of accounts) {
    users[account.label] = await prisma.user.create({ data: {
      phone: account.phone, role: account.role, name: `F3 ${account.label}`, cityId: "tashkent", passwordHash: hash
    } });
    if (account.role === "PROVIDER") await prisma.workerProfile.create({ data: {
      userId: users[account.label].id, status: "APPROVED", profession: "Santexnik", professions: ["Santexnik"],
      availability: { create: { status: "AVAILABLE" } }, serviceLat: 41.31, serviceLng: 69.24
    } });
  }
  const worker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: users.worker.id } });
  const server = createApp().listen(port, "127.0.0.1");
  // Test-only wire evidence: record just read path/boundary/status, never auth.
  const readRequests: Array<{ method: string; path: string; throughMessageId?: string; status: number }> = [];
  server.prependListener("request", (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "PATCH" || !/^\/chats\/rooms\/[^/]+\/read(?:-through)?$/.test(request.url || "")) return;
    let body = "";
    request.on("data", (chunk) => { if (body.length < 8192) body += chunk.toString(); });
    response.once("finish", () => {
      let throughMessageId: string | undefined;
      try { const input = JSON.parse(body); if (typeof input.throughMessageId === "string") throughMessageId = input.throughMessageId; } catch { /* bodyless legacy */ }
      readRequests.push({ method: "PATCH", path: request.url!, throughMessageId, status: response.statusCode });
    });
  });
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sessions: Record<string, any> = {};
  async function login(actor: string) {
    const account = accounts.find((item) => item.label === actor)!;
    const response = await fetch(`${baseUrl}/auth/app-review/login`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: account.phone, password }) });
    assert.equal(response.status, 200, "fixture HTTP login");
    const result = await response.json();
    sessions[actor] = { token: result.accessToken, refreshToken: result.refreshToken, userId: result.user.id,
      name: result.user.name, phone: account.phone, role: result.user.role,
      experienceMode: actor === "worker" ? "worker" : "client", sessionVersion: result.user.sessionVersion };
  }
  async function http(actor: string, method: string, route: string, body?: unknown, expected = 200): Promise<any> {
    const request = () => fetch(`${baseUrl}${route}`, { method, headers: { "Content-Type": "application/json",
      Authorization: `Bearer ${sessions[actor].token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let response = await request();
    if (response.status === 401) { await response.body?.cancel(); await login(actor); response = await request(); }
    assert.equal(response.status, expected, `${method} ${route}: HTTP ${expected}`);
    return response.json();
  }
  for (const account of accounts) await login(account.label);
  const orders: any[] = [];
  const rooms: any[] = [];
  // Use real order and room HTTP paths; cancelled orders retain their own chat.
  async function createOrder(actor: string) {
    const order = (await http(actor, "POST", "/orders", { workerId: worker.id, cityId: "tashkent", serviceType: "Santexnik",
      problemTitle: "F3 chat history", priceEstimate: 100000,
      location: { latitude: 41.31, longitude: 69.24, addressText: "F3 synthetic test address" } }, 201)).order;
    const room = (await http(actor, "POST", `/chats/rooms/order/${order.id}`)).room;
    orders.push(order); rooms.push(room);
    await http(actor, "POST", `/orders/${order.id}/cancel`, { reason: "F3 disposable chat fixture" });
    return { order, room };
  }
  for (const actor of ["client", "client", "providerClient"]) await createOrder(actor);
  return { prisma, users, sessions, orders, rooms, http, baseUrl, createOrder, readRequests,
    async close() { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await prisma.$disconnect(); }
  };
}
