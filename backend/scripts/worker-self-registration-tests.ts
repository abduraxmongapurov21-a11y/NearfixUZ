import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { completeOtpRegistration, verifyAuthOtp } from "../src/modules/auth/auth.service.js";
import { suspendWorkerProfile } from "../src/modules/workers/worker.service.js";

async function main() {
  let sequence = 0;
  async function applicant() {
    const phone = `+99877${String(Date.now() + sequence++).slice(-7)}`;
    const verified = await verifyAuthOtp({ phone, code: "123456", purpose: "AUTH" }, { verifyChallenge: async () => ({}) } as any);
    assert.equal(verified.status, "REGISTRATION_REQUIRED");
    return completeOtpRegistration({ registrationToken: verified.registrationToken!, name: "Self Registration Test" });
  }
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const complete = { name: "New professional", categoryIds: [category.id], experienceYears: 3,
    profileImageUrl: "https://example.com/worker.jpg", bio: "Experienced professional", basePrice: 100000 };
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  try {
    const directAuth = await applicant();
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: directAuth.user.id } })).role, "CLIENT");
    assert.equal(await prisma.workerProfile.count({ where: { userId: directAuth.user.id } }), 0, "fresh client has no saved worker draft");
    const directSubmitted = await request("POST", "/workers/application/submit", directAuth.token, complete);
    assert.equal(directSubmitted.status, 200, "complete registration submits without saving a draft first");
    assert.equal(directSubmitted.body.application.state, "APPROVED", "direct submit needs no admin approval");
    const directWorker = await prisma.workerProfile.findUniqueOrThrow({ where: { userId: directAuth.user.id } });
    assert.equal(directWorker.status, "APPROVED");
    assert.equal(directSubmitted.body.application.id, directWorker.id);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: directAuth.user.id } })).role, "PROVIDER");
    const directCategories = await prisma.workerCategory.findMany({
      where: { workerId: directWorker.id }, select: { categoryId: true, isPrimary: true }
    });
    assert.deepEqual(directCategories, [{ categoryId: category.id, isPrimary: true }]);
    const directRefreshed = await request("POST", "/auth/refresh", undefined, { refreshToken: directAuth.refreshToken });
    assert.equal(directRefreshed.status, 200);
    assert.equal(directRefreshed.body.user.role, "provider");
    console.log("[F4] Direct fresh CLIENT submit without draft: HTTP 200, APPROVED, PROVIDER, primary category and refresh continuity PASS");

    const auth = await applicant();
    assert.equal((await request("POST", "/workers/application/submit", undefined, complete)).status, 401);
    assert.equal((await request("POST", "/workers/application/submit", auth.token, {})).status, 400);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } })).role, "CLIENT");
    assert.equal(await prisma.workerProfile.count({ where: { userId: auth.user.id } }), 0, "incomplete registration rolls back");
    assert.equal((await request("POST", "/workers/application/submit", auth.token, { ...complete, role: "ADMIN" })).status, 400);
    assert.equal((await request("PUT", "/workers/application", auth.token, { bio: "Draft" })).status, 200);
    const results = await Promise.all([1, 2].map(() => request("POST", "/workers/application/submit", auth.token, complete)));
    for (const result of results) { assert.equal(result.status, 200); assert.equal(result.body.application.state, "APPROVED"); }
    assert.equal(results[0].body.application.id, results[1].body.application.id, "concurrent retries return the same worker");
    const workerId = results[0].body.application.id;
    const provider = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    assert.equal(provider.role, "PROVIDER");
    assert.equal(provider.sessionVersion, auth.user.sessionVersion, "self registration keeps the current session");
    const me = await request("GET", "/workers/me", auth.token);
    assert.equal(me.status, 200, "original session can immediately use provider routes");
    assert.equal(me.body.worker.availability.status, "OFFLINE");
    const refreshed = await request("POST", "/auth/refresh", undefined, { refreshToken: auth.refreshToken });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.user.role, "provider");
    assert.equal((await request("PATCH", "/workers/me/availability", auth.token, { status: "AVAILABLE" })).status, 200);
    const publicProfile = await request("GET", `/workers/${workerId}`);
    assert.equal(publicProfile.status, 200);
    assert.equal(publicProfile.body.worker.availability.status, "AVAILABLE");
    const customer = await applicant();
    const createdOrder = await request("POST", "/orders", customer.token, {
      workerId, categoryId: category.id, cityId: "tashkent", problemTitle: "Self-registered worker booking", urgency: "NORMAL",
      location: { latitude: 41.311081, longitude: 69.240562, addressText: "Toshkent test address" }
    });
    assert.equal(createdOrder.status, 201, "a customer can book the worker without admin approval");
    const incoming = await request("GET", "/orders/worker/incoming", auth.token);
    assert.equal(incoming.status, 200);
    assert.ok(incoming.body.orders.some((order: any) => order.id === createdOrder.body.order.id));
    const accepted = await request("POST", `/orders/${createdOrder.body.order.id}/accept`, auth.token, {});
    assert.equal(accepted.status, 200, "newly registered worker can accept the first order");
    assert.equal((await request("POST", `/orders/${createdOrder.body.order.id}/cancel`, customer.token, { reason: "Test completed" })).status, 200);

    const waiting = await applicant();
    await request("PUT", "/workers/application", waiting.token, complete);
    await prisma.workerProfile.update({ where: { userId: waiting.user.id }, data: { submittedAt: new Date() } });
    assert.equal((await request("PUT", "/workers/application", waiting.token, { bio: "Updated legacy submission" })).status, 200);
    assert.equal((await request("POST", "/workers/application/submit", waiting.token, {})).body.application.state, "APPROVED", "old pending applications can finish without admin");

    const rejected = await applicant();
    await request("PUT", "/workers/application", rejected.token, complete);
    await prisma.workerProfile.update({ where: { userId: rejected.user.id }, data: { moderationReason: "Old review feedback" } });
    assert.equal((await request("POST", "/workers/application/submit", rejected.token, {})).body.application.state, "APPROVED");

    const legacyProvider = await applicant();
    await request("PUT", "/workers/application", legacyProvider.token, complete);
    await prisma.user.update({ where: { id: legacyProvider.user.id }, data: { role: "PROVIDER" } });
    const legacySaved = await request("PATCH", "/workers/me/profile", legacyProvider.token, complete);
    assert.equal(legacySaved.status, 200);
    assert.equal(legacySaved.body.worker.status, "APPROVED", "legacy provider drafts can finish registration");

    await suspendWorkerProfile(workerId, "Suspension regression");
    const suspendedLogin = await prisma.session.findFirst({ where: { userId: auth.user.id, revoked: false } });
    // Suspension can revoke sessions; a new authenticated provider session still cannot self-reactivate.
    const { createAccessToken } = await import("../src/modules/auth/session.js");
    const suspendedUser = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    const session = suspendedLogin || await prisma.session.create({ data: { userId: auth.user.id, refreshToken: "suspended-test", expiresAt: new Date(Date.now() + 60000) } });
    const suspendedToken = createAccessToken({ userId: auth.user.id, sessionId: session.id, sessionVersion: suspendedUser.sessionVersion });
    assert.equal((await request("POST", "/workers/application/submit", suspendedToken, complete)).status, 403);
    assert.equal((await prisma.workerProfile.findUniqueOrThrow({ where: { id: workerId } })).status, "SUSPENDED");
    const blocked = await applicant();
    await prisma.user.update({ where: { id: blocked.user.id }, data: { status: "BLOCKED" } });
    assert.ok([401, 403].includes((await request("POST", "/workers/application/submit", blocked.token, complete)).status));
    console.log("Worker self-registration HTTP, session continuity, retries, legacy drafts and moderation guard tests passed.");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}
main().finally(() => prisma.$disconnect());
