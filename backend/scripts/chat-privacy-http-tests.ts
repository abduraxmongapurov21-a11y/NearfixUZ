import "./test-isolation-preload.js";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { UserRole } from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const identity = assertLocalDatabaseTarget(process.env);
if (identity.nodeEnv !== "test" || !["localhost", "127.0.0.1", "::1"].includes(identity.host) ||
    !/^nearfix_chat_test_[a-f0-9]{32}$/.test(identity.database) ||
    process.env.F1_DISPOSABLE_DATABASE !== identity.database) {
  throw new Error("Use with-chat-test-database.ts; a fresh disposable database is required");
}

const fixturePassword = randomUUID();
const actors = {
  client: { phone: "+998000000901", role: "CLIENT" },
  worker: { phone: "+998000000902", role: "PROVIDER" },
  outsider: { phone: "+998000000903", role: "CLIENT" },
  nullableWorker: { phone: "+998000000904", role: "PROVIDER" }
} as const;
process.env.APP_REVIEW_DEMO_ENABLED = "true";
process.env.APP_REVIEW_DEMO_CLIENT_PHONE = "";
process.env.APP_REVIEW_DEMO_WORKER_PHONE = "";
process.env.APP_REVIEW_DEMO_EXTRA_ACCOUNTS_JSON = JSON.stringify(Object.values(actors).map((actor) => ({
  ...actor, password: fixturePassword
})));

const { prisma } = await import("../src/db/prisma.js");
const { createApp } = await import("../src/http/app.js");
const { hashPassword, verifyPassword } = await import("../src/modules/auth/password.js");
const fixtureHash = await hashPassword(fixturePassword);
const secretValues = new Set([fixturePassword, fixtureHash]);
const failures: string[] = [];
let assertions = 0;
let responsesScanned = 0;

function check(condition: unknown, label: string) {
  assertions += 1;
  if (!condition) failures.push(label);
}

// Check keys at every depth, not just User or top-level serialization.
// A null sensitive field is still a disclosure and MUST fail.
const forbiddenKey = /password|secret|token|otp|session|credential|salt|^permissions$|^adminPermissions$|^isProvisional$|^deletedAt$/i;
const publicUserKeys = ["id", "name", "phone"];
function scan(value: unknown, path: string) {
  if (typeof value === "string") check(!secretValues.has(value), `${path}: secret value absent`);
  if (Array.isArray(value)) { value.forEach((item, index) => scan(item, `${path}[${index}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (forbiddenKey.test(key)) {
      check(false, `${location}: forbidden field present (${nested === null ? "null" : "non-null"})`);
    }
    scan(nested, location);
  }
}

function checkUser(value: Record<string, unknown>, label: string) {
  check(Boolean(value) && Object.keys(value).sort().join(",") === publicUserKeys.join(","), `${label}: exact public user allowlist`);
  check(typeof value?.id === "string" && typeof value?.phone === "string" &&
    (typeof value?.name === "string" || value?.name === null), `${label}: mobile identity fields preserved`);
}

function checkRoom(room: any, label: string) {
  check(typeof room?.id === "string" && typeof room?.title === "string", `${label}: room identity preserved`);
  check(Array.isArray(room?.participants) && room.participants.length >= 2, `${label}: participants preserved`);
  for (const participant of room?.participants || []) {
    checkUser(participant.user, `${label}.participant.user`);
    check(participant.userId === participant.user.id && typeof participant.role === "string", `${label}: membership preserved`);
  }
  for (const message of room?.messages || []) checkMessage(message, `${label}.messages`);
  if (room?.lastMessage) checkMessage(room.lastMessage, `${label}.lastMessage`);
}

function checkMessage(message: any, label: string) {
  check(typeof message?.id === "string" && typeof message?.createdAt === "string", `${label}: message identity preserved`);
  checkUser(message?.sender, `${label}.sender`);
  check(message?.senderId === message?.sender?.id, `${label}: sender linkage preserved`);
}

async function main() {
  const users: Record<string, any> = {};
  for (const [label, actor] of Object.entries(actors)) {
    users[label] = await prisma.user.create({ data: {
      phone: actor.phone, role: actor.role as UserRole, name: `F1 ${label}`, cityId: "tashkent",
      passwordHash: label === "nullableWorker" ? null : fixtureHash,
      passwordSetAt: new Date(), passwordChangedAt: new Date(), sessionVersion: 7
    } });
  }
  check(typeof users.client.passwordHash === "string" && users.client.passwordHash.length > 0, "CLIENT fixture hash is non-null");
  check(typeof users.worker.passwordHash === "string" && users.worker.passwordHash.length > 0, "WORKER fixture hash is non-null");
  check(users.nullableWorker.passwordHash === null, "nullable fixture hash is null");
  console.log("[F1] DB fixture passwordHash states: CLIENT=non-null, WORKER=non-null, nullable participant=null (values suppressed)");
  const worker = await prisma.workerProfile.create({ data: {
    userId: users.worker.id, status: "APPROVED", profession: "F1 worker", professions: ["F1 worker"]
  } });
  const otherWorker = await prisma.workerProfile.create({ data: {
    userId: users.nullableWorker.id, status: "APPROVED", profession: "F1 other worker", professions: ["F1 other worker"]
  } });
  const order = await prisma.order.create({ data: {
    publicCode: `F1-${randomUUID()}`, clientId: users.client.id, workerId: worker.id,
    cityId: "tashkent", serviceType: "F1 service", problemTitle: "F1 privacy fixture"
  } });

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tokens: Record<string, string> = {};
  async function http(label: string, method: string, path: string, actor?: string, body?: unknown, expected = 200, privacy = true) {
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json();
    check(response.status === expected, `${label}: HTTP ${expected}`);
    if (privacy) { responsesScanned += 1; scan(data, label); }
    console.log(`[F1] HTTP ${label}: ${response.status}`);
    return data;
  }
  try {
    for (const [label, actor] of Object.entries(actors)) {
      const login = await http(`${label} login`, "POST", "/auth/app-review/login", undefined,
        { phone: actor.phone, password: fixturePassword }, 200, false);
      check(typeof login.accessToken === "string", `${label}: real HTTP login successful`);
      tokens[label] = login.accessToken;
      if (login.accessToken) secretValues.add(login.accessToken);
      if (login.refreshToken) secretValues.add(login.refreshToken);
    }
    await http("wrong password rejected", "POST", "/auth/app-review/login", undefined,
      { phone: actors.client.phone, password: randomUUID() }, 401, false);
    await http("anonymous chat list denied", "GET", "/chats/rooms", undefined, undefined, 401);

    const direct = (await http("CLIENT direct create", "POST", `/chats/rooms/worker/${worker.id}`, "client")).room;
    checkRoom(direct, "direct create");
    const workerDirect = (await http("WORKER direct create with null-hash participant", "POST", `/chats/rooms/worker/${otherWorker.id}`, "worker")).room;
    checkRoom(workerDirect, "worker direct create");
    const orderRoom = (await http("CLIENT order room create", "POST", `/chats/rooms/order/${order.id}`, "client")).room;
    checkRoom(orderRoom, "order create");
    const sameOrder = (await http("WORKER existing order room", "POST", `/chats/rooms/order/${order.id}`, "worker")).room;
    check(sameOrder.id === orderRoom.id, "existing order room identity unchanged");
    checkRoom(sameOrder, "existing order");
    const group = (await http("WORKER group create", "POST", "/chats/rooms/worker-group", "worker", {
      title: "F1 fixture group", participantUserIds: [users.client.id, users.nullableWorker.id]
    })).room;
    checkRoom(group, "group create");
    await http("CLIENT group create denied", "POST", "/chats/rooms/worker-group", "client", { title: "F1 denied" }, 403);

    for (const [roomLabel, room] of [["direct", direct], ["order", orderRoom], ["group", group]] as const) {
      for (const actor of ["client", "worker"]) {
        const sent = (await http(`${actor} ${roomLabel} send`, "POST", `/chats/rooms/${room.id}/messages`, actor,
          { type: "TEXT", body: "F1 fixture message" })).message;
        checkMessage(sent, `${actor} ${roomLabel} send`);
        check(sent.body === "F1 fixture message" && sent.type === "TEXT", "text content contract preserved");
        const detail = await http(`${actor} ${roomLabel} messages`, "GET", `/chats/rooms/${room.id}/messages`, actor);
        check(detail.messages.some((message: any) => message.id === sent.id), "sent message retrievable");
        for (const message of detail.messages) {
          checkMessage(message, `${actor} ${roomLabel} detail`);
          check(typeof message.readByOthers === "boolean", "readByOthers contract preserved");
        }
        const read = await http(`${actor} ${roomLabel} read`, "PATCH", `/chats/rooms/${room.id}/read`, actor);
        check(read.participant.userId === users[actor].id && typeof read.participant.lastReadAt === "string", "read membership contract preserved");
      }
      await http(`outsider ${roomLabel} messages denied`, "GET", `/chats/rooms/${room.id}/messages`, "outsider", undefined, 403);
      await http(`outsider ${roomLabel} send denied`, "POST", `/chats/rooms/${room.id}/messages`, "outsider", { body: "F1 denied" }, 403);
      await http(`outsider ${roomLabel} read denied`, "PATCH", `/chats/rooms/${room.id}/read`, "outsider", undefined, 403);
    }

    const media = await prisma.media.create({ data: {
      ownerId: users.client.id, roomId: direct.id, scope: "CHAT", status: "READY",
      url: "https://example.invalid/f1.png", mimeType: "image/png", fileName: "f1.png", size: 1
    } });
    const image = (await http("CLIENT image send", "POST", `/chats/rooms/${direct.id}/messages`, "client", { type: "IMAGE", mediaId: media.id })).message;
    checkMessage(image, "image send");
    check(image.media.id === media.id && image.media.url === media.url && image.media.mimeType === "image/png", "mobile media fields preserved");
    const imageDetail = await http("WORKER image detail", "GET", `/chats/rooms/${direct.id}/messages`, "worker");
    check(imageDetail.messages.some((message: any) => message.id === image.id && message.media?.id === media.id), "image visible to counterpart");

    const existingDirect = (await http("CLIENT existing direct room with last sender", "POST", `/chats/rooms/worker/${worker.id}`, "client")).room;
    checkRoom(existingDirect, "existing direct");
    check(existingDirect.id === direct.id && existingDirect.lastMessage?.id === image.id, "direct lastMessage preserved");
    const existingWorkerDirect = (await http("WORKER existing direct room", "POST", `/chats/rooms/worker/${otherWorker.id}`, "worker")).room;
    checkRoom(existingWorkerDirect, "existing worker direct");
    await http("outsider order room denied", "POST", `/chats/rooms/order/${order.id}`, "outsider", undefined, 403);

    for (const actor of ["client", "worker"]) {
      for (const filter of ["", "?type=ORDER", "?type=DIRECT", "?type=WORKER_GROUP"]) {
        const listed = await http(`${actor} room list${filter}`, "GET", `/chats/rooms${filter}`, actor);
        check(listed.rooms.length > 0, "room list has fixture data");
        for (const room of listed.rooms) {
          checkRoom(room, "room list");
          check(typeof room.unreadCount === "number", "unreadCount contract preserved");
        }
      }
      const notifications = await http(`${actor} chat notification payload`, "GET", "/notifications", actor);
      const chatEvents = notifications.notifications.filter((entry: any) => entry.type === "CHAT_MESSAGE");
      check(chatEvents.length > 0, "chat notifications created through real message route");
      for (const event of chatEvents) {
        check(Object.keys(event.payload).sort().join(",") === "body,messageId,notificationType,orderId,roomId,title", "chat event payload allowlist");
      }
    }
    const outsiderRooms = await http("outsider room list isolated", "GET", "/chats/rooms", "outsider");
    check(outsiderRooms.rooms.length === 0, "outsider cannot discover participant rooms");

    for (const actor of ["client", "worker"]) {
      const persisted = await prisma.user.findUniqueOrThrow({ where: { id: users[actor].id } });
      check(persisted.passwordHash === fixtureHash, `${actor}: DB hash unchanged`);
      check(await verifyPassword(fixturePassword, persisted.passwordHash), `${actor}: valid stored password verification intact`);
      check(!(await verifyPassword(randomUUID(), persisted.passwordHash)), `${actor}: wrong stored password rejected`);
      await http(`${actor} login after chat operations`, "POST", "/auth/app-review/login", undefined,
        { phone: actors[actor as "client" | "worker"].phone, password: fixturePassword }, 200, false);
    }
    check((await prisma.user.findUniqueOrThrow({ where: { id: users.nullableWorker.id } })).passwordHash === null, "nullable DB hash unchanged");
    console.log(`[F1] Real HTTP responses recursively scanned: ${responsesScanned}; assertions: ${assertions}; failures: ${failures.length}`);
    for (const failure of [...new Set(failures)].slice(0, 60)) console.log(`[F1] FAIL ${failure}`);
    console.log(`[F1] HTTP chat privacy regression: ${failures.length ? "FAIL" : "PASS"}`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch(() => {
  console.log("[F1] FAIL unexpected fixture/HTTP error (details suppressed; no response values logged)");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
