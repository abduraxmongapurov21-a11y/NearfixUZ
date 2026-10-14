/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("../backend/node_modules/typescript");
const root = path.resolve(__dirname, "..");
let state = [], slot = 0, effects = [], bannerModel;
const calls = [];
const categories = [{ id: "cat1", nameUz: "Santexnik", isActive: true }];
const mixed = [
  { id: "category", title: "Strip", placement: "CATEGORY", imageUrl: "https://example.com/strip.png", mediaType: "IMAGE", isActive: true, sortOrder: 0, targetType: "CATEGORY", targetValue: "cat1" },
  { id: "home", title: "Hero", placement: "HOME", imageUrl: "https://example.com/hero.png", mediaType: "IMAGE", isActive: true, sortOrder: 0, targetType: "URL", targetValue: "https://example.com/offer" }
];
const log = (method) => async (...args) => { calls.push({ method, args }); };
const store = {
  categories, banners: mixed, categoryBanners: mixed, workers: [], activeOrder: null,
  categoryStatus: "ready", categoriesLastLoadedAt: Date.now(), catalogSort: "recommended", apiStatus: {},
  syncCategoriesFromApi: log("categories"), syncOrdersFromApi: log("orders"), syncBannersFromApi: log("banners"),
  syncCatalogFromApi: log("catalog"), setCatalogDeviceLocation: log("location")
};
const navigation = { navigate: (...args) => calls.push({ method: "navigate", args }), getParent: () => null };
const element = (type, props, key) => ({ type, props, key });
const native = { StyleSheet: { create: (styles) => styles, absoluteFill: {}, absoluteFillObject: {} }, AppState: { currentState: "active" }, Linking: { openURL: log("url") } };
function load(relative) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const target = new Module(filename);
  target.require = (id) => {
    if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
    if (id === "react") return {
      useState: (initial) => { const index = slot++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
      useMemo: (fn) => fn(), useEffect: (fn) => effects.push(fn), useRef: () => ({ current: null })
    };
    if (id === "react-native") return new Proxy(native, { get: (value, key) => value[key] || String(key) });
    if (id === "react-i18next") return { useTranslation: () => ({ i18n: { language: "uz" }, t: (text) => text }) };
    if (id === "@react-navigation/native") return { useIsFocused: () => true };
    if (id.endsWith("/bannerModel.mjs")) return bannerModel;
    if (id.endsWith("/authStore")) return { useAuthStore: (selector) => selector({ session: null }) };
    if (id.endsWith("/clientStore")) return { useClientStore: (selector) => selector(store) };
    if (id.endsWith("/clientTheme")) return { colors: { white: "#FFFFFF", primaryDark: "#075E68" }, font: {}, shadow: {}, CLIENT_CONTENT_BOTTOM: 100 };
    if (id.endsWith("/routes")) return { ROUTES: { CATEGORY: "Category" } };
    if (id.endsWith("/workerStatus")) return { WORKER_STATUS: {} };
    if (id.endsWith("/imageService")) return { getInitials: () => "NF" };
    if (id.endsWith("/categoryIcons")) return { resolveCategoryIcon: () => "Icon", resolveCategoryIconColor: () => "#2582A6" };
    if (id.endsWith("/categoryService")) return { categoryName: (category) => category?.nameUz || "", workerCategoryLabel: () => ({ label: "Santexnik" }) };
    if (id.endsWith("/categoryAvailability.mjs")) return { visibleHomeCategoryItems: (items) => items, resolveCategoryRoute: () => ({ kind: "ready", categoryId: "cat1", category: categories[0] }) };
    if (id.endsWith("/catalogSorting.mjs")) return { sortCatalogWorkers: (workers) => workers };
    if (id.endsWith("/useCatalogLocation")) return { useCatalogLocation: () => ({ coordinates: { lat: 41, lng: 69 }, loading: false, refreshLocation: async () => ({ ok: true, coordinates: { lat: 41, lng: 69 } }) }) };
    return new Proxy({}, { get: (_target, key) => String(key) });
  };
  target._compile(compiled, filename);
  return target.exports;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function flattenStyle(style) {
  return Array.isArray(style) ? Object.assign({}, ...style.map(flattenStyle)) : style || {};
}
function colorChannels(value) {
  if (/^#[\da-f]{6}$/i.test(value)) {
    return [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16)).concat(1);
  }
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(value);
  assert.ok(rgba, `Unsupported contrast-test color: ${value}`);
  return rgba.slice(1).map(Number);
}
function compositeColor(value, background, opacity = 1) {
  const [red, green, blue, alpha] = colorChannels(value);
  return [red, green, blue].map((channel, index) => channel * alpha * opacity + background[index] * (1 - alpha * opacity));
}
function luminance(channels) {
  // WCAG relative luminance, without rounding the threshold comparison.
  return channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrastRatio(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function bannerContrast(renderedSlide, title, placement) {
  const renderedNodes = nodes(renderedSlide);
  const scrim = renderedNodes.find((node) => node.type === "View" && node.props.pointerEvents === "none" && flattenStyle(node.props.style).backgroundColor);
  assert.ok(scrim, `${placement} renders a scrim above its image`);
  const background = compositeColor(flattenStyle(scrim.props.style).backgroundColor, [255, 255, 255]);
  return [["title", title], ["ad label", "Reklama"]].map(([label, copy]) => {
    const text = renderedNodes.find((node) => node.type === "Text" && node.props.children === copy);
    assert.ok(text, `${placement} renders ${label}`);
    const style = flattenStyle(text.props.style);
    return { placement, label, ratio: contrastRatio(compositeColor(style.color, background, style.opacity ?? 1), background) };
  });
}
const reset = () => { state = []; slot = 0; effects = []; };
async function main() {
  bannerModel = await import("../src/services/content/bannerModel.mjs");
  const { HomeScreen } = load("src/screens/marketplace/HomeScreen.js");
  const { CategoryScreen } = load("src/screens/marketplace/CategoryScreen.js");
  const { BannerCarousel } = load("src/components/marketplace/BannerCarousel.js");
  reset();
  const home = HomeScreen({ navigation });
  const hero = nodes(home).filter((node) => node.type === "BannerCarousel");
  assert.equal(hero.length, 1, "HOME has one hero slot and no extra lower advertisement");
  assert.equal(hero[0].props.placement, "HOME");
  assert.deepEqual(hero[0].props.banners.map((banner) => banner.id), ["home"]);
  await Promise.all(effects.map((effect) => effect()));
  assert.ok(calls.some((call) => call.method === "banners" && call.args[0] === "HOME"));
  const homeScroll = nodes(home).find((node) => node.type === "ScrollView");
  await homeScroll.props.refreshControl.props.onRefresh();
  assert.equal(calls.filter((call) => call.method === "banners" && call.args[0] === "HOME").length, 2);
  store.banners = [mixed[0], { ...mixed[1], isActive: false }];
  reset();
  const fallback = nodes(HomeScreen({ navigation }));
  assert.equal(fallback.filter((node) => node.type === "BannerCarousel").length, 0);
  assert.ok(fallback.some((node) => node.props?.children === "Kerakli usta, sizga yaqin."), "empty/inactive hero feed retains the default introduction");
  reset();
  const category = CategoryScreen({ navigation, route: { params: { categoryId: "cat1" } } });
  const strip = nodes(category).find((node) => node.type === "BannerCarousel");
  assert.equal(strip.props.placement, "CATEGORY");
  const categoryScroll = nodes(category).find((node) => node.type === "ScrollView");
  const children = nodes(categoryScroll.props.children).filter((node) => node.type === "ScrollView" || node.type === "BannerCarousel");
  assert.equal(children[0].props.horizontal, true);
  assert.equal(children[1], strip, "category strip belongs directly below sorting");
  await Promise.all(effects.map((effect) => effect()));
  assert.ok(calls.some((call) => call.method === "banners" && call.args[0] === "CATEGORY"));
  const contrastResults = [];
  for (const [placement, height, expected] of [["HOME", 200, "home"], ["CATEGORY", 64, "category"]]) {
    reset();
    const props = { banners: mixed, categories, navigation, placement };
    BannerCarousel(props).props.onLayout({ nativeEvent: { layout: { width: 330 } } });
    slot = 0;
    const carousel = BannerCarousel(props);
    const slides = nodes(carousel).filter((node) => typeof node.type === "function");
    assert.equal(slides.length, 1, "mixed API/cache data cannot leak into another placement");
    assert.equal(slides[0].props.banner.id, expected);
    const renderedSlide = slides[0].type(slides[0].props);
    contrastResults.push(...bannerContrast(renderedSlide, slides[0].props.banner.title, placement));
    const button = nodes(renderedSlide).find((node) => node.type === "Pressable");
    assert.equal(Object.assign({}, ...button.props.style).height, height);
    await button.props.onPress();
    assert.equal(calls.at(-1).method, placement === "HOME" ? "url" : "navigate", "both placements retain their target actions");
  }
  for (const result of contrastResults) {
    console.log(`${result.placement} ${result.label} contrast over a white image: ${result.ratio.toFixed(4)}:1`);
  }
  assert.ok(contrastResults.every(({ ratio }) => ratio >= 4.5), "Both placements must keep title and ad-label contrast at least 4.5:1 over the brightest possible image, including text opacity");
  console.log("Actual mobile screen/carousel components: HOME-only hero/fallback/refresh, CATEGORY-only strip below SORT, 200px/64px layouts and target actions PASS (native APIs mocked).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
