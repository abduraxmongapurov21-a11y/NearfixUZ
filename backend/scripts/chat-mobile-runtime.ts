import "./test-isolation-preload.js";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createChatFixture } from "./chat-test-fixture.js";

if (!process.env.F3_MOBILE_CONTROL_DIR) throw new Error("Owned fixture control directory required");
const directory = path.resolve(process.env.F3_MOBILE_CONTROL_DIR);
await mkdir(directory, { recursive: true });
const f = await createChatFixture();
const privateFile = path.join(directory, "fixture-session.private.json");
await writeFile(privateFile, JSON.stringify({ sessions: f.sessions }));
await writeFile(path.join(directory, "ready.json"), JSON.stringify({ apiBaseUrl: f.baseUrl, rooms: f.rooms.map((r, i) => ({ id: r.id, orderId: r.orderId, publicCode: f.orders[i].publicCode })), runId: process.env.F21_TEST_RUN_ID }));
console.log("[F3] Android fixture ready: runner-authorized disposable API/DB; no registered push devices; external transports stubbed");
let lastId: string | null = null;
try {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const command = await readFile(path.join(directory, "command.json"), "utf8").then(JSON.parse).catch(() => null);
    if (!command || command.id === lastId) continue;
    lastId = command.id;
    if (command.action === "stop") break;
    const room = f.rooms[command.room ?? 0];
    const actor = command.actor || "client";
    let result: unknown;
    if (command.action === "probe") result = { apiBaseUrl: f.baseUrl };
    else if (command.action === "read-requests") result = f.readRequests;
    else if (command.action === "send") result = await f.http(actor, "POST", `/chats/rooms/${room.id}/messages`, { body: command.body });
    else if (command.action === "messages") result = await f.http(actor, "GET", `/chats/rooms/${room.id}/messages`);
    else if (command.action === "create-order") {
      const created = await f.createOrder(actor);
      result = { roomId: created.room.id, orderId: created.order.id, publicCode: created.order.publicCode, roomIndex: f.rooms.length - 1 };
    }
    else if (command.action === "unread") {
      const response = await f.http(actor, "GET", "/chats/rooms");
      result = response.rooms.map((r: any) => ({ roomId: r.id, orderId: r.orderId, unreadCount: r.unreadCount }));
    }
    await writeFile(path.join(directory, "result.json"), JSON.stringify({ id: lastId, runId: process.env.F21_TEST_RUN_ID, result }));
    console.log(`[F3] Android fixture ${command.action}: real HTTP completed`);
  }
} finally {
  await f.close();
  await unlink(privateFile);
  console.log("[F3] Android fixture stopped; private session file removed");
}
