/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");

async function main() {
  const bannerModel = await import("../src/services/content/bannerModel.mjs");
  const filename = path.resolve(__dirname, "../src/components/marketplace/BannerCarousel.js");
  const contexts = new Map(), timers = new Map(), players = [];
  let context, dirty, focused = true, videoStatus = "readyToPlay", appChange, motionChange;
  const element = (type, props, key) => ({ type, props: props || {}, key });
  const useState = (initial) => {
    const owner = context, slot = owner.slot++;
    if (!(slot in owner.values)) owner.values[slot] = initial;
    return [owner.values[slot], (value) => {
      const next = typeof value === "function" ? value(owner.values[slot]) : value;
      if (!Object.is(next, owner.values[slot])) { owner.values[slot] = next; dirty = true; }
    }];
  };
  const useRef = (initial) => useState({ current: initial })[0];
  const useEffect = (effect, deps) => {
    const owner = context, slot = owner.slot++, previous = owner.effects[slot];
    if (!previous || deps.some((dep, index) => !Object.is(dep, previous.deps[index]))) {
      owner.pending.push(() => { previous?.cleanup?.(); owner.effects[slot] = { deps, cleanup: effect() }; });
    }
  };
  const target = new Module(filename);
  target.require = (id) => {
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (id === "react") return { useState, useRef, useEffect };
    if (id === "react-native") return {
      View: "View", Pressable: "Pressable", Image: "Image", ScrollView: "ScrollView",
      StyleSheet: { create: (styles) => styles, absoluteFill: {}, absoluteFillObject: {} },
      AppState: { currentState: "active", addEventListener: (_event, listener) => { appChange = listener; return { remove() {} }; } },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: (_event, listener) => { motionChange = listener; return { remove() {} }; } },
      Linking: { openURL: async () => {} }
    };
    if (id === "@react-navigation/native") return { useIsFocused: () => focused };
    if (id === "expo") return { useEvent: () => ({ status: videoStatus }) };
    if (id === "expo-video") return { VideoView: "VideoView", useVideoPlayer: (_uri, setup) => {
      const ref = useRef(null);
      if (!ref.current) {
        ref.current = { status: "readyToPlay", playing: false, play() { this.playing = true; }, pause() { this.playing = false; } };
        setup(ref.current); players.push(ref.current);
      }
      return ref.current;
    } };
    if (id === "lucide-react-native") return { Play: "Play", Pause: "Pause" };
    if (id === "react-i18next") return { useTranslation: () => ({ t: (text) => text }) };
    if (id.endsWith("/native")) return { Text: "Text" };
    if (id.endsWith("/clientTheme")) return { colors: { white: "#fff", primaryDark: "#075e68" }, font: {} };
    if (id.endsWith("/routes")) return { ROUTES: { CATEGORY: "Category" } };
    if (id.endsWith("/bannerModel.mjs")) return bannerModel;
    if (id === "test-clock") return { setTimeout: (fn, delay) => { const timer = { fn, delay }; timers.set(timer, timer); return timer; }, clearTimeout: (timer) => timers.delete(timer) };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  target._compile('const { setTimeout, clearTimeout } = require("test-clock");\n' + compiled, filename);
  const makeBanner = (id, mediaType, sortOrder) => ({ id, mediaType, sortOrder, placement: "HOME", title: id, imageUrl: `https://example.com/${id}`, isActive: true });
  let props = { banners: [makeBanner("image", "IMAGE", 0), makeBanner("video", "VIDEO", 1)], categories: [], placement: "HOME", navigation: { navigate() {} } }, tree;
  function expand(node, key = "root", live = new Set()) {
    if (Array.isArray(node)) return node.map((child, index) => expand(child, `${key}/${child?.key ?? index}`, live));
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") {
      live.add(key);
      if (!contexts.has(key)) contexts.set(key, { values: [], effects: [], pending: [], slot: 0 });
      context = contexts.get(key); context.slot = 0;
      return expand(node.type(node.props), `${key}/render`, live);
    }
    return { ...node, props: { ...node.props, children: expand(node.props.children, `${key}/children`, live) } };
  }
  function render() {
    for (let pass = 0; pass < 20; pass++) {
      dirty = false;
      const live = new Set(); tree = expand(element(target.exports.BannerCarousel, props), "root", live);
      for (const [key, owner] of contexts) if (!live.has(key)) { owner.effects.forEach((effect) => effect?.cleanup?.()); contexts.delete(key); }
      for (const owner of contexts.values()) for (const effect of owner.pending.splice(0)) effect();
      if (!dirty) return tree;
    }
    throw new Error("Component failed to settle");
  }
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
  const controls = (node = tree) => nodes(node).filter((item) => item.type === "Pressable" && item.props.accessibilityRole === "button");
  const swipe = (index) => { nodes(tree).find((node) => node.type === "ScrollView").props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 330 * index } } }); render(); };
  render(); await Promise.resolve(); render();
  tree.props.onLayout({ nativeEvent: { layout: { width: 330 } } }); render();
  assert.equal(controls().length, 0, "An image in a mixed carousel must not show a video play/pause control");
  assert.equal([...timers.values()][0]?.delay, 6000, "Images retain automatic rotation");
  swipe(1);
  assert.equal(controls().length, 1);
  assert.equal(controls(nodes(tree).find((node) => node.type === "ScrollView")).length, 1, "The video control must move inside its slide, not float over the carousel");
  assert.equal(players.at(-1).playing, true);
  controls()[0].props.onPress(); render();
  assert.equal(players.at(-1).playing, false);
  assert.equal(controls()[0].props.accessibilityLabel, "Reklamani davom ettirish");
  assert.equal(timers.size, 0, "Paused video must not automatically leave its slide");
  swipe(0);
  assert.equal(controls().length, 0);
  assert.equal([...timers.values()][0]?.delay, 6000, "A previously paused video must not stop an image from rotating");
  swipe(1);
  assert.equal(players.at(-1).playing, true, "Returning to a video starts the new visit unpaused");
  appChange("background"); render(); assert.equal(players.at(-1).playing, false);
  appChange("active"); render(); assert.equal(players.at(-1).playing, true);
  focused = false; render(); assert.equal(players.at(-1).playing, false);
  focused = true; render(); assert.equal(players.at(-1).playing, true);
  motionChange(true); render(); assert.equal(players.at(-1).playing, false);
  controls()[0].props.onPress(); render(); assert.equal(players.at(-1).playing, true);
  videoStatus = "error"; render();
  assert.equal(controls().length, 0, "Failed video fallback must not offer a nonfunctional play button");
  props = { ...props, banners: [makeBanner("only-video", "VIDEO", 0)] }; videoStatus = "readyToPlay"; render();
  assert.equal(controls().length, 1, "A single video still has a playback control");
  props = { ...props, banners: [makeBanner("only-image", "IMAGE", 0)] }; render(); assert.equal(controls().length, 0);
  console.log("PASS: actual BannerCarousel mixed-media controls, slide ownership, pause/resume, swipe reset, lifecycle, reduced motion, failure and single-banner states (native APIs mocked).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
