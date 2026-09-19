import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { createChatFixture } from "./chat-test-fixture.js";

const f = await createChatFixture();
const [a, b] = f.rooms;
let responses = 0;
function scan(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, /password|secret|token|otp|session|credential|salt|^permissions$|^adminPermissions$|^isProvisional$|^deletedAt$/i);
    scan(child);
  }
}
async function http(actor: string, method: string, route: string, body?: unknown, expected = 200) {
  const result = await f.http(actor, method, route, body, expected);
  scan(result); responses++; return result;
}
const legacy = (actor: string, room = a, expected = 200) =>
  http(actor, "PATCH", `/chats/rooms/${room.id}/read`, undefined, expected); // Exact pre-F3 bodyless request.
const strict = (actor: string, id: string, room = a) =>
  http(actor, "PATCH", `/chats/rooms/${room.id}/read-through`, { throughMessageId: id });
const send = async (body: string, room = a) =>
  (await http("client", "POST", `/chats/rooms/${room.id}/messages`, { body })).message;
const unread = async (actor = "worker", room = a) =>
  (await http(actor, "GET", "/chats/rooms")).rooms.find((r: any) => r.id === room.id).unreadCount;
const cursors = () => f.prisma.chatParticipant.findMany({
  orderBy: [{ roomId: "asc" }, { userId: "asc" }], select: { roomId: true, userId: true, lastReadAt: true }
});
const cursor = () => f.prisma.chatParticipant.findUniqueOrThrow({
  where: { roomId_userId: { roomId: a.id, userId: f.users.worker.id } }
});
function responseContract(result: any, room = a) {
  assert.deepEqual(Object.keys(result).sort(), ["ok", "participant"]);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.participant).sort(), ["joinedAt", "lastReadAt", "role", "roomId", "userId"]);
  assert.equal(result.participant.roomId, room.id);
  assert.equal(result.participant.userId, f.users.worker.id);
  assert.ok(Number.isFinite(Date.parse(result.participant.lastReadAt)));
  assert.ok(Number.isFinite(Date.parse(result.participant.joinedAt)));
}
const actualNow = Date.now;
try {
  // Freeze only this disposable test process's JS clock. The HTTP server and DB
  // remain real: this forces the otherwise rare empty-read/same-ms-send case.
  const frozen = actualNow();
  Date.now = () => frozen;
  const empty = await legacy("worker"); responseContract(empty);
  assert.equal(empty.participant.lastReadAt, new Date(frozen).toISOString());
  assert.equal((await cursor()).lastReadAt?.toISOString(), empty.participant.lastReadAt);
  assert.equal(await unread(), 0);
  const first = await send("after empty legacy read, same millisecond");
  assert.ok(Date.parse(first.createdAt) > frozen, "a future message must exceed an empty-room legacy cursor");
  assert.equal(await unread(), 1);
  const readFirst = await legacy("worker"); responseContract(readFirst);
  assert.ok(Date.parse(readFirst.participant.lastReadAt) >= Date.parse(first.createdAt));
  assert.equal(await unread(), 0, "legacy must actually persist the read, not only return 200");
  Date.now = actualNow;
  console.log("[F3] F3.1 PASS unchanged bodyless legacy request/response; empty room and same-ms future send; persisted read");

  const other = await send("other order remains unread", b);
  const shown = await send("strict visible boundary");
  const unseen = await send("strict not displayed yet");
  const readShown = await strict("worker", shown.id); responseContract(readShown);
  assert.equal(readShown.participant.lastReadAt, shown.createdAt);
  assert.equal(await unread(), 1);
  assert.equal(await unread("worker", b), 1);
  assert.equal(await unread("client"), 0, "sender excludes own messages");
  const beforeInvalid = await cursors();
  for (const body of [undefined, {}, { throughMessageId: null }, { throughMessageId: "" },
    { throughMessageId: 123 }, { throughMessageId: [] }, { throughMessageId: "missing-message" },
    { throughMessageId: other.id }]) {
    await http("worker", "PATCH", `/chats/rooms/${a.id}/read-through`, body, 400);
    assert.deepEqual(await cursors(), beforeInvalid, "strict validation must never invoke legacy or mutate any cursor");
    assert.equal(await unread(), 1);
  }
  await legacy("outsider", a, 403);
  await http("outsider", "PATCH", `/chats/rooms/${a.id}/read-through`, { throughMessageId: unseen.id }, 403);
  assert.deepEqual(await cursors(), beforeInvalid, "both paths enforce membership without mutation");
  console.log("[F3] F3.1 PASS strict boundary retains later unread; missing/null/type/empty/invalid/cross-room rejected without mutation; outsider denied");

  const legacySameAccount = await legacy("worker");
  assert.equal(await unread(), 0, "legacy device shares and advances the account's room cursor");
  await strict("worker", first.id);
  assert.equal((await cursor()).lastReadAt?.toISOString(), legacySameAccount.participant.lastReadAt,
    "older strict read cannot undo the legacy device's shared cursor");
  const next = await send("new after legacy read");
  assert.ok(next.createdAt > legacySameAccount.participant.lastReadAt);
  assert.equal(await unread(), 1);
  await Promise.all([strict("worker", next.id), strict("worker", first.id), strict("worker", next.id)]);
  assert.equal((await cursor()).lastReadAt?.toISOString(), next.createdAt);
  assert.equal(await unread(), 0);

  for (let i = 0; i < 8; i++) {
    const before = (await cursor()).lastReadAt!;
    const [snapshot, concurrent] = await Promise.all([legacy("worker"), send(`parallel legacy ${i}`)]);
    const cut = Date.parse(snapshot.participant.lastReadAt);
    assert.ok(cut >= before.getTime());
    // Either lock order is valid for legacy: messages serialized before its
    // snapshot are read; messages serialized after it must remain unread.
    const expected = Date.parse(concurrent.createdAt) > cut ? 1 : 0;
    assert.equal(await unread(), expected);
    const future = await send(`after completed legacy response ${i}`);
    assert.ok(Date.parse(future.createdAt) > cut);
    assert.equal(await unread(), expected + 1);
    await Promise.all([strict("worker", first.id), strict("worker", future.id)]);
    assert.equal(await unread(), 0);
    const visible = await send(`strict parallel shown ${i}`);
    const [, later] = await Promise.all([strict("worker", visible.id), send(`strict parallel unseen ${i}`)]);
    assert.ok(later.createdAt > visible.createdAt);
    assert.equal(await unread(), 1);
    await legacy("worker");
    assert.equal(await unread(), 0);
    assert.equal(await unread("worker", b), 1);
  }

  // A skewed clock or a previous burst must not regress either read contract.
  const at = (await cursor()).lastReadAt!;
  Date.now = () => at.getTime() - 1000;
  const repeated = await legacy("worker");
  assert.equal(repeated.participant.lastReadAt, at.toISOString());
  await strict("worker", first.id);
  assert.equal((await cursor()).lastReadAt?.toISOString(), at.toISOString());
  const after = await send("writer beyond read cursor with clock behind");
  assert.ok(after.createdAt > at.toISOString());
  assert.equal(await unread(), 1);
  Date.now = actualNow;
  assert.equal(await unread("worker", b), 1);
  assert.ok((await http("worker", "GET", "/notifications/unread-count")).count > 0);
  console.log(`[F3] F3.1 PASS parallel send/read, repeated/out-of-order/mixed clients, clock rollback, room/user isolation and notification independence; ${responses} privacy-scanned HTTP responses`);
} catch (error) {
  console.log(`[F3] F3.1 FAIL ${error instanceof assert.AssertionError ? error.message : "HTTP/fixture error (private details suppressed)"}`);
  process.exitCode = 1;
} finally { Date.now = actualNow; await f.close(); }
