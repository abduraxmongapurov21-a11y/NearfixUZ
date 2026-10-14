/**
 * Local UI verification fixture only. Every person, account, address, review,
 * order and message below is fictional. This server holds all state in memory,
 * binds exclusively to 127.0.0.1:4501, sends no SMS, makes no external requests,
 * and never connects to the application backend or a database.
 *
 * Start: node scripts/preview-client-ui.mjs
 * Start Expo in a separate terminal with process-scoped overrides:
 *   $env:EXPO_PUBLIC_APP_ENV='development'
 *   $env:EXPO_PUBLIC_API_BASE_URL='http://127.0.0.1:4501'
 *   npx expo start --web --port 8082
 * Do not save these overrides to .env or use this fixture for release builds.
 * Login phone: 90 000 00 01. Demo password: NearfixPreview!2026.
 */
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 4501;
const PHONE = "+998900000001";
const PASSWORD = "NearfixPreview!2026";
const ACCESS_TOKEN = "nearfix-local-preview-client-token";
const REFRESH_TOKEN = "nearfix-local-preview-refresh-token";
const user = { id: "preview-client", phone: PHONE, name: "Madina Karimova", role: "client", sessionVersion: 1 };
const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
let sequence = 10;
const nextId = (kind) => `preview-${kind}-${++sequence}`;

const categories = [
  ["plumbing", "Santexnik", "Сантехник", "Plumber", "wrench"],
  ["electrician", "Elektrik", "Электрик", "Electrician", "zap"],
  ["cleaning", "Tozalash", "Уборка", "Cleaning", "sparkles"],
  ["air-conditioning", "Konditsioner", "Кондиционер", "Air conditioning", "snowflake"],
  ["repair", "Ta'mirlash", "Ремонт", "Repairs", "hammer"],
  ["painting", "Bo'yash", "Покраска", "Painting", "paint"],
  ["appliances", "Maishiy texnika", "Бытовая техника", "Appliances", "flame"],
  ["furniture", "Mebel", "Мебель", "Furniture", "sofa"],
  ["moving", "Yuk tashish", "Перевозки", "Moving", "truck"],
  ["computer", "Kompyuter", "Компьютер", "Computers", "laptop"]
].map(([slug, nameUz, nameRu, nameEn, iconKey], sortOrder) => ({ id: `preview-${slug}`, slug, nameUz, nameRu, nameEn, iconKey, sortOrder, isActive: true }));

const workerDefinitions = [
  ["plumber-aziz", "Aziz Salimov", 0, 4.9, 128, 8, 90000, 1200, "AVAILABLE"],
  ["plumber-sardor", "Sardor Rahimov", 0, 4.8, 86, 6, 75000, 2400, "AVAILABLE"],
  ["plumber-javohir", "Javohir Akbarov", 0, 4.7, 54, 5, 65000, 3700, "BUSY"],
  ["electrician-timur", "Timur Saidov", 1, 4.9, 94, 7, 80000, 1800, "AVAILABLE"],
  ["cleaner-zarina", "Zarina Tursunova", 2, 4.8, 63, 4, 120000, 2100, "AVAILABLE"],
  ["cooling-rustam", "Rustam Aliyev", 3, 4.9, 112, 9, 150000, 1600, "AVAILABLE"],
  ["repair-bekzod", "Bekzod Niyozov", 4, 4.7, 41, 5, 100000, 3200, "AVAILABLE"],
  ["paint-odil", "Odil Xasanov", 5, 4.8, 72, 6, 130000, 2700, "AVAILABLE"]
];
const workers = workerDefinitions.map(([id, name, categoryIndex, ratingAvg, completedOrdersCount, experienceYears, basePrice, distanceMeters, status], index) => {
  const category = categories[categoryIndex];
  return {
    id: `preview-${id}`, userId: `preview-provider-${index + 1}`, name, phone: `+9989000001${String(index + 1).padStart(2, "0")}`,
    user: { id: `preview-provider-${index + 1}`, name, phone: `+9989000001${String(index + 1).padStart(2, "0")}`, role: "provider" },
    profession: category.nameUz, professions: [category.nameUz], categoryIds: [category.id], categories: [category],
    ratingAvg, completedOrdersCount, experienceYears, basePrice, distanceMeters, availability: { status }, cityId: "tashkent",
    bio: "Uy xizmatlari bo'yicha tajribali mutaxassis. Ishni kelishilgan vaqtda, tartibli va sifatli bajaraman.", profileImageUrl: null
  };
});
const banners = [{ id: "preview-banner", title: "Uy yumushlari uchun ishonchli yordam", imageUrl: null, targetType: "CATEGORY", targetValue: "plumbing", sortOrder: 0, isActive: true }];
let addresses = [
  { id: "preview-address-home", title: "Uy", address: "Namunaviy ko'cha, 12-uy, 24-xonadon", district: "Yunusobod", cityId: "tashkent", lat: 41.335, lng: 69.285, isDefault: true },
  { id: "preview-address-office", title: "Ish", address: "Namuna biznes markazi, 3-qavat", district: "Mirzo Ulug'bek", cityId: "tashkent", lat: 41.318, lng: 69.303, isDefault: false }
];
const orderLocation = (address = addresses[0]) => ({ latitude: address.lat, longitude: address.lng, addressText: address.address, label: address.title, district: address.district });
let orders = [
  { id: "preview-order-active", publicCode: "NF-26031", workerId: workers[0].id, worker: workers[0], client: user, categoryId: categories[0].id, serviceType: "Santexnik", problemTitle: "Kran ta'mirlash", priceEstimate: 90000, status: "ON_THE_WAY", source: "CLIENT_APP", location: orderLocation(), cityId: "tashkent", createdAt: ago(35), events: [] },
  { id: "preview-order-completed", publicCode: "NF-25974", workerId: workers[3].id, worker: workers[3], client: user, categoryId: categories[1].id, serviceType: "Elektrik", problemTitle: "Rozetka almashtirish", finalAmount: 80000, status: "COMPLETED", source: "CLIENT_APP", location: orderLocation(), cityId: "tashkent", createdAt: ago(1440), events: [], review: null },
  { id: "preview-order-completed-second", publicCode: "NF-25975", workerId: workers[0].id, worker: workers[0], client: user, categoryId: categories[0].id, serviceType: "Santexnik", problemTitle: "Kran almashtirish", finalAmount: 90000, status: "COMPLETED", source: "CLIENT_APP", location: orderLocation(addresses[1]), cityId: "tashkent", createdAt: ago(1200), events: [], review: null },
  { id: "preview-order-cancelled", publicCode: "NF-25912", workerId: workers[1].id, worker: workers[1], client: user, categoryId: categories[0].id, serviceType: "Santexnik", problemTitle: "Quvur tekshirish", priceEstimate: 75000, status: "CANCELLED", source: "CLIENT_APP", location: orderLocation(addresses[1]), cityId: "tashkent", createdAt: ago(4320), cancelReason: "Boshqa vaqtga qoldirildi", events: [] }
];
const messages = new Map();
let rooms = [];
function createRoom(worker, order) {
  const room = { id: nextId("room"), type: order ? "ORDER" : "DIRECT", title: worker.name, cityId: "tashkent", serviceType: worker.profession, orderId: order?.id || null, order: order ? { publicCode: order.publicCode } : null, participants: [{ userId: user.id, user }, { userId: worker.userId, user: worker.user }], unreadCount: 1, lastMessage: null };
  const thread = [
    { id: nextId("message"), roomId: room.id, orderId: room.orderId, type: "TEXT", senderId: user.id, sender: user, body: "Assalomu alaykum, xizmat bo'yicha kelishsak bo'ladimi?", createdAt: ago(18), readByOthers: true },
    { id: nextId("message"), roomId: room.id, orderId: room.orderId, type: "TEXT", senderId: worker.userId, sender: worker.user, body: "Albatta. Muammoni qisqacha yozib yuboring.", createdAt: ago(16), readByOthers: true },
    { id: nextId("message"), roomId: room.id, orderId: room.orderId, type: "TEXT", senderId: user.id, sender: user, body: "Oshxonadagi krandan suv tomchilayapti. Manzil buyurtmada ko'rsatilgan.", createdAt: ago(12), readByOthers: true },
    { id: nextId("message"), roomId: room.id, orderId: room.orderId, type: "TEXT", senderId: worker.userId, sender: worker.user, body: order ? "Manzilni ko'rdim. Taxminan 20 daqiqada yetib boraman." : "Tushunarli, bugun yordam bera olaman.", createdAt: ago(5), readByOthers: false }
  ];
  room.lastMessage = thread.at(-1);
  messages.set(room.id, thread);
  rooms.push(room);
  return room;
}
createRoom(workers[0], orders[0]);
createRoom(workers[3], orders[1]);
let notifications = [
  { id: "preview-notification-order", type: "ORDER_ON_THE_WAY", payload: { title: "Usta yo'lga chiqdi", body: "Aziz Salimov buyurtmangiz manziliga yo'l oldi.", notificationType: "ORDER_ON_THE_WAY", orderId: orders[0].id }, createdAt: ago(6), readAt: null },
  { id: "preview-notification-chat", type: "CHAT_MESSAGE", payload: { title: "Ustadan yangi xabar", body: "Taxminan 20 daqiqada yetib boraman.", notificationType: "CHAT_MESSAGE", roomId: rooms[0].id }, createdAt: ago(5), readAt: null },
  { id: "preview-notification-completed", type: "ORDER_COMPLETED", payload: { title: "Xizmat yakunlandi", body: "Xizmatga baho qoldirishingiz mumkin.", notificationType: "ORDER_COMPLETED", orderId: orders[1].id }, createdAt: ago(1435), readAt: ago(1430) }
];
const favorites = new Set([workers[0].id]);
let blocks = [];
const tickets = [];

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ ok: status < 400, fixture: true, ...payload }));
}
const success = (response, payload = {}) => send(response, 200, payload);
const failure = (response, status, message, code = "PREVIEW_FIXTURE_ERROR") => send(response, status, { message, code });
const sessionPayload = () => ({ status: "AUTHENTICATED", token: ACCESS_TOKEN, accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, user });
async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 65536) throw new Error("Preview request is too large");
  }
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const path = decodeURIComponent(url.pathname);
  const method = request.method;
  try {
    if (path === "/health" || path === "/__preview") return success(response, { name: "Nearfix fictional customer UI fixture", login: { phone: PHONE, password: PASSWORD }, datasets: { categories: categories.length, workers: workers.length, orders: orders.length, rooms: rooms.length } });
    if (path.startsWith("/legal/")) return success(response, { title: "Fictional preview fixture", text: "This local preview contains fictional test data only." });
    if (path === "/content/categories") return success(response, { categories });
    if (path === "/content/banners") return success(response, { banners });
    if (path === "/workers/catalog") {
      const categoryId = url.searchParams.get("categoryId");
      let result = workers.filter((worker) => !categoryId || worker.categoryIds.includes(categoryId));
      if (url.searchParams.get("sort") === "nearest") result = result.toSorted((a, b) => a.distanceMeters - b.distanceMeters);
      return success(response, { workers: result });
    }
    const workerPath = path.match(/^\/workers\/(preview-[^/]+)(\/reviews)?$/);
    if (workerPath) {
      const worker = workers.find((item) => item.id === workerPath[1]);
      if (!worker) return failure(response, 404, "Fictional worker not found");
      return success(response, workerPath[2] ? { reviews: [{ id: "preview-review-1", authorName: "Dilnoza N.", rating: 5, text: "O'z vaqtida keldi, ishini puxta bajardi.", createdAt: ago(2880) }, { id: "preview-review-2", authorName: "Akmal S.", rating: 5, text: "Muammoni tez hal qildi. Tavsiya qilaman.", createdAt: ago(5760) }] } : { worker });
    }
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await readBody(request) : {};
    if (path === "/auth/otp/request" && method === "POST") {
      return body.phone === PHONE ? success(response, { expiresIn: 300, resendIn: 0, nextStep: "APP_REVIEW_PASSWORD_REQUIRED" }) : failure(response, 400, "Use the fictional preview phone 90 000 00 01", "INVALID_CREDENTIALS");
    }
    if (path === "/auth/app-review/login" && method === "POST") {
      return body.phone === PHONE && body.password === PASSWORD ? success(response, sessionPayload()) : failure(response, 401, "Incorrect fictional preview credentials", "INVALID_CREDENTIALS");
    }
    if (path === "/auth/refresh" && method === "POST") return body.refreshToken === REFRESH_TOKEN ? success(response, sessionPayload()) : failure(response, 401, "This fixture accepts only its local test session", "REFRESH_SESSION_INVALID");
    if (request.headers.authorization !== `Bearer ${ACCESS_TOKEN}`) return failure(response, 401, "Sign into the fictional preview account", "ACCESS_TOKEN_INVALID");
    if (path === "/auth/me") {
      if (method === "PATCH" && body.name?.trim()) user.name = body.name.trim();
      return success(response, method === "DELETE" ? { deleted: true, deletedAt: new Date().toISOString() } : { user });
    }
    if (path === "/auth/logout") return success(response);
    if (path === "/__preview/empty" && method === "POST") {
      if (body.orders) orders = [];
      if (body.chats) { rooms = []; messages.clear(); }
      if (body.notifications) notifications = [];
      return success(response);
    }
    if (path === "/addresses") {
      if (method === "POST") addresses.push({ ...body, id: nextId("address"), cityId: body.cityId || "tashkent" });
      return success(response, method === "POST" ? { address: addresses.at(-1) } : { addresses });
    }
    if (path.startsWith("/addresses/")) {
      const id = path.split("/").at(-1);
      const address = addresses.find((item) => item.id === id);
      if (!address) return failure(response, 404, "Fictional address not found");
      if (method === "DELETE") addresses = addresses.filter((item) => item.id !== id);
      if (method === "PATCH") Object.assign(address, body);
      return success(response, { address });
    }
    if (path === "/favorites") {
      if (method === "POST") favorites.add(body.workerId);
      return success(response, { favorites: [...favorites].map((workerId) => ({ workerId })) });
    }
    if (path.startsWith("/favorites/") && method === "DELETE") { favorites.delete(path.split("/").at(-1)); return success(response); }
    if (path === "/orders") {
      if (method === "POST") {
        const worker = workers.find((item) => item.id === body.workerId);
        if (!worker) return failure(response, 400, "Choose a fictional preview worker");
        const address = addresses.find((item) => item.id === body.addressId) || addresses[0];
        const order = { ...body, id: nextId("order"), publicCode: `NF-${26000 + sequence}`, worker, client: user, status: "WAITING_RESPONSE", source: "CLIENT_APP", location: body.location || (address ? orderLocation(address) : null), createdAt: ago(0), responseDeadlineAt: new Date(Date.now() + 10 * 60000).toISOString(), events: [] };
        orders.unshift(order);
        return success(response, { order });
      }
      return success(response, { orders });
    }
    const orderPath = path.match(/^\/orders\/([^/]+)(?:\/(cancel|review))?$/);
    if (orderPath) {
      const order = orders.find((item) => item.id === orderPath[1]);
      if (!order) return failure(response, 404, "Fictional order not found");
      if (orderPath[2] === "cancel") { order.status = "CANCELLED"; order.cancelReason = body.reason; }
      if (orderPath[2] === "review") {
        order.review = { id: nextId("review"), rating: body.rating, comment: body.comment || "", createdAt: ago(0) };
        return success(response, { review: order.review, rating: body.rating });
      }
      return success(response, { order });
    }
    if (path === "/chats/rooms") return success(response, { rooms });
    const ensureRoom = path.match(/^\/chats\/rooms\/(order|worker)\/([^/]+)$/);
    if (ensureRoom && method === "POST") {
      const order = ensureRoom[1] === "order" ? orders.find((item) => item.id === ensureRoom[2]) : null;
      const worker = workers.find((item) => item.id === (order?.workerId || ensureRoom[2]));
      if (!worker) return failure(response, 404, "Fictional chat counterpart not found");
      const room = rooms.find((item) => order ? item.orderId === order.id : item.participants.some((participant) => participant.userId === worker.userId)) || createRoom(worker, order);
      return success(response, { room });
    }
    const threadPath = path.match(/^\/chats\/rooms\/([^/]+)\/(messages|read-through)$/);
    if (threadPath) {
      const room = rooms.find((item) => item.id === threadPath[1]);
      if (!room) return failure(response, 404, "Fictional chat room not found");
      if (threadPath[2] === "read-through") { room.unreadCount = 0; return success(response); }
      const thread = messages.get(room.id);
      if (method === "POST") {
        const message = { id: nextId("message"), roomId: room.id, orderId: room.orderId, senderId: user.id, sender: user, type: body.type || "TEXT", body: body.body || "", createdAt: ago(0), readByOthers: false };
        thread.push(message); room.lastMessage = message;
        return success(response, { message });
      }
      return success(response, { messages: thread });
    }
    if (path === "/notifications") return success(response, { notifications });
    if (path === "/notifications/unread-count") return success(response, { count: notifications.filter((item) => !item.readAt).length });
    if (path === "/notifications/push-token") return success(response, { token: body.token || "preview-push-token" });
    const readNotification = path.match(/^\/notifications\/([^/]+)\/read$/);
    if (readNotification) {
      const notification = notifications.find((item) => item.id === readNotification[1]);
      if (!notification) return failure(response, 404, "Fictional notification not found");
      notification.readAt = ago(0); return success(response, { notification });
    }
    if (path === "/blocks") return success(response, { blocks });
    if (path.startsWith("/blocks/worker/") && method === "POST") {
      const worker = workers.find((item) => item.id === path.split("/").at(-1));
      if (worker) blocks.push({ blockedUserId: worker.userId, blockedUser: worker.user });
      return success(response);
    }
    if (path.startsWith("/blocks/") && method === "DELETE") { blocks = blocks.filter((item) => item.blockedUserId !== path.split("/").at(-1)); return success(response); }
    if (path === "/support/tickets") {
      if (method === "POST") tickets.push({ ...body, id: nextId("ticket"), status: "OPEN", createdAt: ago(0) });
      return success(response, method === "POST" ? { ticket: tickets.at(-1) } : { tickets });
    }
    if (path === "/reports" && method === "POST") return success(response, { report: { ...body, id: nextId("report"), createdAt: ago(0) } });
    if (path === "/workers/application") return success(response, { application: null });
    return failure(response, 404, `Route is outside the customer preview fixture: ${method} ${path}`, "PREVIEW_ROUTE_UNSUPPORTED");
  } catch (error) {
    return failure(response, 400, error.message);
  }
});
server.on("error", (error) => { console.error(`Local preview fixture failed: ${error.message}`); process.exitCode = 1; });
server.listen(PORT, HOST, () => {
  console.log(`Fictional customer UI fixture: http://${HOST}:${PORT}`);
  console.log(`Test login: ${PHONE} / ${PASSWORD}. All writes are in memory only.`);
});
