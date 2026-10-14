/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

async function main() {
  const phone = await import("../src/utils/workerPhone.mjs");
  const mode = await import("../src/navigation/experienceMode.mjs");
  const chatSync = await import("../src/services/chats/chatSync.mjs");
  let session = { userId: "client", role: "provider", experienceMode: "client" }, rooms = [], rejectDialer = false;
  const calls = [], alerts = [], navigationCalls = [];
  const element = (type, props) => ({ type, props: props || {} });
  const deps = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: { useMemo: (fn) => fn(), useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }), useEffect() {} },
    "react-native": {
      View: "View", Pressable: "Pressable", ScrollView: "ScrollView", RefreshControl: "RefreshControl",
      StyleSheet: { create: (value) => value },
      Linking: { openURL: async (url) => { calls.push(url); if (rejectDialer) throw new Error("No dialer"); } }
    },
    "lucide-react-native": Object.fromEntries(["ArrowRight", "MessageCircle", "MoreVertical", "Phone", "RefreshCw", "Search", "X"].map((name) => [name, name])),
    "react-i18next": { useTranslation: () => ({ t: (text) => text }) },
    "../../constants/routes": { ROUTES: { CHAT_THREAD: "ChatThread" } },
    "../../store/authStore": { useAuthStore: (select) => select({ session }) },
    "../../store/chatStore": { useChatStore: (select) => select({ rooms }), refreshChatRooms() {} },
    "../../hooks/useChatRefresh": { useChatRefresh: (refresh) => refresh },
    "../../services/chats/chatSync.mjs": chatSync,
    "../../navigation/experienceMode.mjs": mode,
    "../../utils/workerPhone.mjs": phone,
    "../../i18n/native": { Text: "Text", TextInput: "TextInput", Alert: { alert: (...args) => alerts.push(args) } },
    "../../components/client/ClientHeader": { ClientHeader: "ClientHeader" },
    "../../components/client/GlassSurface": { GlassSurface: "GlassSurface" },
    "../../theme/clientTheme": { colors: {}, font: {}, shadow: {} },
    "../api/client": {}, "../api/authenticatedClient": {}
  };
  function compile(relative) {
    const filename = path.resolve(__dirname, relative), target = new Module(filename);
    target.require = (id) => { assert.ok(id in deps, `Unexpected dependency: ${id}`); return deps[id]; };
    target._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText, filename);
    return target.exports;
  }
  const { ChatScreen } = compile("../src/screens/chats/ChatScreen.js");
  const { mapApiChatRoom } = compile("../src/services/chats/chatService.js");
  const participant = (id, number) => ({ userId: id, user: { id, name: id, phone: number } });
  const own = participant("client", "+998909999999");
  const workerA = participant("worker-a", "90 123 45 67"), workerB = participant("worker-b", "+998 (91) 765-43-21");
  function fixture(id, participants, type = "ORDER") {
    return mapApiChatRoom({ id, participants, type, orderId: type === "ORDER" ? id : null,
      order: { publicCode: `NF-${id}` }, unreadCount: 123,
      lastMessage: { body: `message-${id}`, createdAt: "2026-10-14T07:00:00Z" }
    }, session?.userId);
  }
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props.children) } };
  }
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props.children)] : [];
  const render = () => expand(element(ChatScreen, { navigation: { navigate: (...args) => navigationCalls.push(args) } }));
  const controls = (tree) => nodes(tree).filter((node) => node.type === "Pressable" && node.props.accessibilityLabel?.startsWith("Ustaga qo'ng'iroq qilish"));

  rooms = [fixture("order-a", [own, workerA]), fixture("order-b", [workerA, own]), fixture("direct", [workerB, own], "DIRECT")];
  let tree = render(), buttons = controls(tree);
  assert.equal(buttons.length, 3, "Each private chat has its own call action, including repeated workers");
  for (const button of buttons) await button.props.onPress();
  assert.deepEqual(calls, ["tel:+998901234567", "tel:+998901234567", "tel:+998917654321"]);
  assert.equal(navigationCalls.length, 0, "Calling must not navigate to the conversation");
  assert.ok(nodes(tree).some((node) => node.type === "Text" && node.props.children === "99+"), "Unread badge remains visible");
  assert.ok(nodes(tree).some((node) => node.type === "Text" && node.props.children === "message-order-a"));
  for (const button of buttons) {
    const parent = nodes(tree).find((node) => Array.isArray(node.props.children) && node.props.children.includes(button));
    assert.equal(parent.type, "View", "Call and chat controls are siblings, with independent hit targets");
    const openChat = parent.props.children.find((node) => node.type === "Pressable" && node !== button);
    openChat.props.onPress();
    const style = button.props.style({ pressed: false })[0];
    assert.ok(style.width >= 44 && style.height >= 44, "Call target is accessible on touch screens");
  }
  assert.deepEqual(navigationCalls.map(([route, args]) => [route, args.room.id]), [
    ["ChatThread", "order-a"], ["ChatThread", "order-b"], ["ChatThread", "direct"]
  ]);
  rejectDialer = true;
  await buttons[0].props.onPress();
  assert.deepEqual(alerts, [["Xatolik", "Telefon ilovasini ochib bo'lmadi."]]);
  rejectDialer = false;
  const priorCalls = calls.length;
  rooms = [fixture("missing", [own, participant("worker", null)]), fixture("invalid", [own, participant("worker", "tel:123;456")]), fixture("self-only", [own])];
  for (const button of controls(render())) {
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityState.disabled, true);
    await button.props.onPress();
  }
  assert.equal(calls.length, priorCalls, "Missing or invalid counterpart numbers never reach the dialer");
  rooms = [fixture("signed-out", [own, workerA])];
  session = null;
  assert.equal(controls(render())[0].props.disabled, true, "No user identity must not select the caller as counterpart");
  session = { userId: "worker-a", role: "provider", experienceMode: "worker" };
  assert.equal(controls(render()).length, 0, "Worker chat layout remains unchanged");
  console.log("Chat call controls passed: API mapping, per-room counterpart, independent navigation, missing/invalid phone, dialer failure, account mode, and touch targets.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
