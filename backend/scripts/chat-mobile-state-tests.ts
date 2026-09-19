import "./test-isolation-preload.js";
import assert from "node:assert/strict";
// @ts-expect-error Mobile ESM is exercised directly without a duplicate test implementation.
import { createChatThreadState } from "../../src/services/chats/chatThreadState.mjs";
// @ts-expect-error Mobile ESM is exercised directly.
import { startChatRefreshLoop, mergeChatMessages, privateChatRooms, chatUnreadCount, keyboardOverlap } from "../../src/services/chats/chatSync.mjs";

function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>((done) => { resolve = done; }); return { promise, resolve }; }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const message = (id: string, n: number) => ({ id, createdAt: new Date(n * 1000).toISOString(), body: id });
let active = true;
let tick!: () => Promise<void>;
let calls = 0;
let cleared = false;
let load = deferred();
let applied = 0;
const loop = startChatRefreshLoop(async ({ isCurrent }: any) => { calls++; await load.promise; if (isCurrent()) applied++; }, () => active, {
  setIntervalFn: (fn: typeof tick, ms: number) => { tick = fn; assert.equal(ms, 3000); return 7; },
  clearIntervalFn: (id: number) => { assert.equal(id, 7); cleared = true; }
});
await flush(); void tick(); void tick(); assert.equal(calls, 1, "no overlapping polling");
active = false; load.resolve(null); await flush(); assert.equal(applied, 0);
await tick(); assert.equal(calls, 1, "no background work");
active = true; load = deferred(); void tick(); await flush(); assert.equal(calls, 2);
loop.stop(); load.resolve(null); await flush(); assert.equal(applied, 0); assert.equal(cleared, true);
console.log("[F3] PASS production refresh loop: 3s, overlap, inactive, reconnect retry, cleanup and late response guard");

let snapshot: any = { messages: [] };
let reads: string[] = [];
let scopeCurrent = true;
let request = deferred();
let delivered = deferred();
let canonicalRefreshes = 0;
const thread = createChatThreadState({
  load: () => request.promise, markRead: async (id: string) => { reads.push(id); return { ok: true }; },
  onRead: async () => { canonicalRefreshes++; }, onChange: (value: any) => { snapshot = value; },
  isCurrent: () => scopeCurrent, isActive: () => active
});
const first = thread.refresh(); request.resolve({ ok: true, messages: [message("1", 1), message("2", 2)] }); await first;
assert.equal(reads.length, 0, "fetch/render alone never marks read");
thread.setVisible(["1"]); await flush(); assert.deepEqual(reads, ["1"]);
active = false; thread.setVisible(["2"]); await flush(); assert.deepEqual(reads, ["1"]);
active = true; thread.setVisible(["2"]); await flush(); assert.deepEqual(reads, ["1", "2"]);
assert.equal(canonicalRefreshes, 2, "read revalidates canonical counts");
request = deferred(); const stale = thread.refresh();
const sending = thread.send({ body: "3" }, () => delivered.promise);
const duplicate = await thread.send({ body: "3" }, () => { throw new Error("double-send reached transport"); }); assert.equal(duplicate.ok, false);
request.resolve({ ok: true, messages: [message("1", 1)] }); await stale;
assert.equal(snapshot.messages.length, 3, "old fetch cannot remove pending/new messages");
await thread.refresh(); // No fetch while send acknowledgement is unresolved.
delivered.resolve({ ok: true, message: message("3", 3) }); await sending;
assert.deepEqual(snapshot.messages.map((m: any) => m.id), ["1", "2", "3"]);
request = deferred(); const repeat = thread.refresh(); request.resolve({ ok: true, messages: [message("3", 3)] }); await repeat;
assert.deepEqual(snapshot.messages.map((m: any) => m.id), ["1", "2", "3"], "server-ID dedupe and union");
await thread.send({ body: "acknowledgement lost" }, async () => ({ ok: false }));
assert.equal(snapshot.messages.length, 3, "failed optimistic row cannot duplicate a committed message on retry/refetch");
request = deferred(); const recovered = thread.refresh(); request.resolve({ ok: true, messages: [message("4", 4)] }); await recovered;
assert.deepEqual(snapshot.messages.map((m: any) => m.id), ["1", "2", "3", "4"]);
request = deferred(); const late = thread.refresh(); const before = snapshot;
scopeCurrent = false; thread.dispose(); request.resolve({ ok: true, messages: [message("wrong-room", 4)] }); await late;
assert.equal(snapshot, before, "disposed/account/mode response cannot render");
assert.equal(mergeChatMessages([{ ...message("1", 1), readByOthers: true }], [message("1", 1)])[0].readByOthers, true);
const rooms = [{ id: "a", type: "order", unread: 2 }, { id: "b", type: "order", unread: 1 }, { id: "g", type: "worker_group", unread: 8 }];
assert.equal(privateChatRooms(rooms).length, 2); assert.equal(chatUnreadCount(rooms), 3);
assert.equal(keyboardOverlap(24, 600, 400), 224);
assert.equal(keyboardOverlap(24, 376, 400), 0, "native resize must not double-count keyboard");
assert.equal(keyboardOverlap(24, 600, null), 0);
console.log("[F3] PASS actual mobile thread state: visible-only reads, optimistic/response/poll dedupe, stale response, double-send, room/account/mode disposal; private-room counts and keyboard geometry");
