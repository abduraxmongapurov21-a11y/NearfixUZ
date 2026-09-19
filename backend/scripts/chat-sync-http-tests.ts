import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { createChatFixture } from "./chat-test-fixture.js";

const f = await createChatFixture();
let scans = 0;
function scan(value: any) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.doesNotMatch(key, /password|secret|token|otp|session|credential|salt|^permissions$|^adminPermissions$|^isProvisional$|^deletedAt$/i);
    scan(nested);
  }
}
async function http(actor: string, method: string, route: string, body?: unknown, expected = 200) {
  const data = await f.http(actor, method, route, body, expected); scan(data); scans++; return data;
}
const [a, b, c] = f.rooms;
const send = async (actor: string, room: any, body: string) => (await http(actor, "POST", `/chats/rooms/${room.id}/messages`, { body })).message;
const read = (actor: string, room: any, id?: string, expected = 200) => http(actor, "PATCH", `/chats/rooms/${room.id}/read-through`, id ? { throughMessageId: id } : {}, expected);
const unread = async (actor: string, room: any) => (await http(actor, "GET", "/chats/rooms")).rooms.find((item: any) => item.id === room.id).unreadCount;
try {
  assert.notEqual(a.id, b.id);
  for (const room of [a, b]) {
    assert.deepEqual(room.participants.map((p: any) => p.userId).sort(), [f.users.client.id, f.users.worker.id].sort());
    assert.equal((await http("worker", "POST", `/chats/rooms/order/${room.orderId}`)).room.id, room.id);
  }
  const a1 = await send("client", a, "F3 first order client message");
  const b1 = await send("client", b, "F3 second order client message");
  assert.equal(await unread("client", a), 0, "own messages are not unread");
  assert.equal(await unread("worker", a), 1);
  assert.equal(await unread("worker", b), 1);
  assert.equal((await http("client", "GET", "/chats/rooms")).rooms.length, 2);
  assert.deepEqual((await http("worker", "GET", `/chats/rooms/${a.id}/messages`)).messages.map((m: any) => m.id), [a1.id]);
  assert.deepEqual((await http("worker", "GET", `/chats/rooms/${b.id}/messages`)).messages.map((m: any) => m.id), [b1.id]);
  console.log("[F3] PASS two real HTTP orders: separate rooms, memberships, histories and own-message unread");

  for (const room of [a, b, c]) {
    await http("outsider", "GET", `/chats/rooms/${room.id}/messages`, undefined, 403);
    await http("outsider", "POST", `/chats/rooms/${room.id}/messages`, { body: "denied" }, 403);
    await read("outsider", room, "forbidden-message", 403);
    await http("outsider", "POST", `/chats/rooms/order/${room.orderId}`, undefined, 403);
  }
  assert.equal((await http("outsider", "GET", "/chats/rooms")).rooms.length, 0);
  await read("worker", a, b1.id, 400);
  await read("worker", a, undefined, 400);
  assert.equal(await unread("worker", a), 1, "invalid/absent boundary is not mark-all");
  console.log("[F3] PASS outsider room/message/read access denied; cross-room and missing read boundary rejected");

  await read("worker", a, a1.id);
  assert.equal(await unread("worker", a), 0);
  assert.equal(await unread("worker", b), 1, "read affects only its room");
  for (let i = 0; i < 8; i++) {
    const shown = await send("client", a, `shown ${i}`);
    const [, unseen] = await Promise.all([read("worker", a, shown.id), send("client", a, `unseen ${i}`)]);
    assert.ok(new Date(unseen.createdAt) > new Date(shown.createdAt), "strict room order, even same-millisecond writers");
    assert.equal(await unread("worker", a), 1, "parallel unseen message stays unread");
    await Promise.all([read("worker", a, unseen.id), read("worker", a, a1.id)]);
    assert.equal(await unread("worker", a), 0, "older read never regresses cursor");
  }
  const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => send("client", a, `concurrent ${i}`)));
  assert.equal(new Set(burst.map((m) => m.createdAt)).size, 8);
  assert.equal(await unread("worker", a), 8);
  const ordered = (await http("worker", "GET", `/chats/rooms/${a.id}/messages`)).messages;
  await read("worker", a, ordered.at(-2).id);
  assert.equal(await unread("worker", a), 1, "bounded read leaves last not-yet-shown message unread");
  await read("worker", a, ordered.at(-1).id);
  assert.equal(await unread("worker", a), 0);
  assert.equal(await unread("worker", b), 1);
  const reply = await send("worker", a, "F3 worker reply");
  assert.equal(await unread("client", a), 1);
  assert.equal(await unread("worker", a), 0);
  await read("client", a, reply.id);
  const received = (await http("worker", "GET", `/chats/rooms/${a.id}/messages`)).messages;
  assert.equal(received.at(-1).readByOthers, true);
  assert.ok((await http("worker", "GET", "/notifications/unread-count")).count > 0, "chat read does not clear notification center");
  assert.equal((await http("providerClient", "GET", "/chats/rooms")).rooms[0].id, c.id);
  const later = await f.createOrder("client");
  await send("client", later.room, "new order after existing history");
  const historyAfterNewOrder = (await http("client", "GET", "/chats/rooms")).rooms;
  assert.equal(historyAfterNewOrder.length, 3);
  assert.ok(historyAfterNewOrder.some((room: any) => room.id === a.id));
  assert.ok(historyAfterNewOrder.some((room: any) => room.id === b.id));
  assert.ok((await http("client", "GET", `/chats/rooms/${a.id}/messages`)).messages.some((m: any) => m.id === a1.id));
  console.log("[F3] PASS later order created after messages: old room IDs and histories retained, new room separate");
  console.log(`[F3] PASS parallel read/new-message, monotonic read, concurrent sends, repeat/refetch, receipts, provider client membership; ${scans} nested privacy scans`);
} catch (error) {
  console.log(`[F3] FAIL ${error instanceof assert.AssertionError ? error.message : "fixture/HTTP failure (private details suppressed)"}`);
  process.exitCode = 1;
} finally { await f.close(); }
