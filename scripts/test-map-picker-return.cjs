/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const ts = require('../backend/node_modules/typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/screens/maps/MapPickerScreen.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, allowJs: true },
}).outputText;
const element = (type, props, key) => ({ type, props, key });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const coordinate = { latitude: 41.31, longitude: 69.24 };
const location = { address: 'Synthetic public QA point', city: 'Toshkent', district: 'QA district' };
const bookingParams = { workerId: 'synthetic-worker', categoryId: 'synthetic-yuk', entryMarker: 'existing-booking' };
const draft = { selectedProblem: 'Boshqa', otherProblem: 'Synthetic transport description' };

async function main() {
  const { StackRouter, StackActions, CommonActions } = await import('@react-navigation/routers');
  const adapter = await import('../src/services/maps/yandexMapAdapter.mjs');
  const geocodeModel = await import('../src/services/location/reverseGeocodeModel.mjs');
  const routerVersion = require('@react-navigation/routers/package.json').version;

  function fixture({ mapParams = {}, onSelect, geocodeOk = true, routes } = {}) {
    const pickerParams = { initialCoordinate: coordinate, autoLocate: false, ...mapParams };
    const initialRoutes = routes || [
      { name: 'Home', key: 'home-original' },
      { name: 'Booking', key: 'booking-original', params: { ...bookingParams } },
      { name: 'MapPicker', key: 'map-active', params: pickerParams },
    ];
    const routeNames = ['Home', 'Booking', 'MapPicker', 'ClientTabs', 'Other'];
    const router = StackRouter({});
    const options = { routeNames, routeParamList: { Booking: { defaultMarker: 'booking-default' } }, routeGetIdList: {} };
    let state = { stale: false, type: 'stack', key: 'synthetic-stack', index: initialRoutes.length - 1, routeNames, routes: initialRoutes, preloadedRoutes: [] };
    const originalBooking = initialRoutes.findLast(route => route.name === 'Booking');
    const formsByRouteKey = new Map([[originalBooking?.key, { ...draft }]]);
    const calls = [];
    function dispatch(action) {
      const next = router.getStateForAction(state, { ...action, source: state.routes[state.index].key, target: state.key }, options);
      assert.ok(next, 'Actual installed StackRouter handles navigation action');
      state = next;
    }
    const navigation = {
      navigate(name, params) { calls.push({ method: 'navigate', name, params }); dispatch(CommonActions.navigate(name, params)); },
      popTo(name, params, opts) { calls.push({ method: 'popTo', name, params, options: opts }); dispatch(StackActions.popTo(name, params, opts)); },
      goBack() { calls.push({ method: 'goBack' }); dispatch(CommonActions.goBack()); },
    };
    const slots = [];
    let slot = 0;
    let effects = [];
    const mapKit = { ready: true, initialization: Promise.resolve(), MapComponent: 'YandexMap' };
    const target = new Module(sourcePath);
    const originalRequire = target.require.bind(target);
    const react = {
      useState(initial) { const index = slot++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
      useRef(initial) { const index = slot++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
      useMemo(callback, deps) { const index = slot++; const old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { value: callback(), deps }; return slots[index].value; },
      useEffect(callback, deps) { const index = slot++; const old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(callback); } },
    };
    target.require = id => {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (id === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'android' }, Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value, absoluteFillObject: {} } };
      if (id === 'expo-location') return { requestForegroundPermissionsAsync: () => { throw new Error('Unexpected device permission request in deterministic fixture'); } };
      if (id === 'lucide-react-native') return { ArrowLeft: 'ArrowLeft', Crosshair: 'Crosshair', LocateFixed: 'LocateFixed', MapPin: 'MapPin' };
      if (id === '../../theme' || id === '../../theme/clientTheme') return { colors: {}, radius: {}, shadow: {}, spacing: {}, font: {} };
      if (id === '../../i18n/native') return { Alert: { alert: () => {} }, Text: 'Text' };
      if (id === '../../services/location/reverseGeocodeLocation') return { reverseGeocodeLocation: async request => geocodeOk ? { ok: true, coordinate: request, location } : { ok: false, coordinate: request, code: 'EMPTY_RESULT' } };
      if (id === '../../services/location/reverseGeocodeModel.mjs') return geocodeModel;
      if (id === '../../services/maps/yandexMapAdapter.mjs') return adapter;
      if (id === '../../services/maps/yandexMapKit') return { loadYandexMapKit: () => mapKit };
      if (id === '../../services/maps/yandexLocaleLifecycle.mjs') return { IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED: 'IOS_YANDEX_LOCALE_RELAUNCH_REQUIRED' };
      if (id === '../../store/uiStore') return { useUiStore: selector => selector({ locale: 'uz' }) };
      if (id === '../../store/authStore') return { useAuthStore: selector => selector({ session: { role: 'CLIENT', experienceMode: 'client' } }) };
      if (id === '../../navigation/experienceMode.mjs') return { normalizeExperienceMode: () => 'client' };
      if (id === 'react-i18next') return { useTranslation: () => ({ t: value => value }) };
      if (id === '../../components/client/ClientHeader') return { ClientHeader: 'ClientHeader' };
      if (id === '../../components/client/GlassSurface') return { GlassSurface: 'GlassSurface' };
      return originalRequire(id);
    };
    target._compile(compiled, sourcePath);
    function render() {
      slot = 0;
      const tree = target.exports.MapPickerScreen({ navigation, route: { key: 'map-active', params: pickerParams }, onSelect });
      const pending = effects; effects = []; pending.forEach(callback => callback());
      return tree;
    }
    async function confirm() {
      render(); await Promise.resolve(); await Promise.resolve();
      const button = nodes(render()).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Manzilni tasdiqlash');
      assert.ok(button, 'Actual MapPicker native confirm button rendered');
      await button.props.onPress();
    }
    return { confirm, calls, originalBooking, formsByRouteKey, get state() { return state; }, get active() { return state.routes[state.index]; } };
  }
  let passed = 0;
  let failed = 0;
  async function test(name, run) { try { await run(); passed++; console.log(`[MAP RETURN] PASS ${name}`); } catch (error) { failed++; console.log(`[MAP RETURN] FAIL ${name}: ${error.message}`); } }
  const normal = options => fixture({ ...options, mapParams: { returnTo: 'Booking', returnParamKey: 'selectedBookingLocation', ...options?.mapParams } });
  console.log(`[MAP RETURN] Full native module SHA256=${sourceHash}; installed StackRouter=${routerVersion}; mocked hooks/native map+geocoder; no device/HTTP/DB`);
  await test('normal return keeps existing Booking route key and removes picker', async () => { const page = normal(); await page.confirm(); assert.equal(page.active.key, 'booking-original'); assert.equal(page.state.routes.length, 2); });
  await test('normal return merges workerId/categoryId and existing route parameters', async () => { const page = normal(); await page.confirm(); for (const key of Object.keys(bookingParams)) assert.equal(page.active.params[key], bookingParams[key]); });
  await test('original form draft remains associated with the active route identity', async () => { const page = normal(); const form = page.formsByRouteKey.get(page.originalBooking.key); await page.confirm(); assert.equal(page.formsByRouteKey.get(page.active.key), form); assert.deepEqual(form, draft); });
  await test('confirmed address and coordinates delivered under selectedBookingLocation', async () => { const page = normal(); await page.confirm(); assert.deepEqual(page.active.params.selectedBookingLocation, { ...coordinate, ...location }); });
  await test('ordinary return uses installed popTo merge option object', async () => { const page = normal(); await page.confirm(); assert.equal(page.calls[0].method, 'popTo'); assert.deepEqual(page.calls[0].options, { merge: true }); });
  await test('default selectedLocation key also preserves existing booking params', async () => { const page = normal({ mapParams: { returnParamKey: undefined } }); await page.confirm(); assert.deepEqual(page.active.params.selectedLocation, { ...coordinate, ...location }); assert.equal(page.active.params.workerId, bookingParams.workerId); });
  await test('coordinate-only geocoder failure still returns to existing Booking', async () => { const page = normal({ geocodeOk: false }); await page.confirm(); assert.equal(page.active.key, 'booking-original'); assert.deepEqual(page.active.params.selectedBookingLocation, coordinate); assert.equal(page.active.params.categoryId, bookingParams.categoryId); });
  await test('nearest existing same-name Booking route is retained', async () => { const routes = [{ name: 'Home', key: 'home-original' }, { name: 'Booking', key: 'older-booking', params: { workerId: 'older-worker' } }, { name: 'Booking', key: 'nearest-booking', params: { ...bookingParams } }, { name: 'MapPicker', key: 'map-active' }]; const page = normal({ routes }); await page.confirm(); assert.equal(page.active.key, 'nearest-booking'); assert.equal(page.state.routes.length, 3); assert.equal(page.active.params.workerId, bookingParams.workerId); });
  await test('without returnTo existing goBack path is unchanged', async () => { const page = fixture(); await page.confirm(); assert.deepEqual(page.calls, [{ method: 'goBack' }]); assert.equal(page.active.key, 'booking-original'); assert.deepEqual(page.active.params, bookingParams); });
  await test('nested returnScreen navigate contract remains unchanged', async () => { const page = fixture({ mapParams: { returnTo: 'ClientTabs', returnScreen: 'ProfileTab', returnParamKey: 'selectedLocation' } }); await page.confirm(); assert.deepEqual(page.calls, [{ method: 'navigate', name: 'ClientTabs', params: { screen: 'ProfileTab', params: { selectedLocation: { ...coordinate, ...location } } } }]); });
  await test('embedded onSelect callback remains first and does not navigate', async () => { const selections = []; const page = normal({ onSelect: value => selections.push(value) }); await page.confirm(); assert.deepEqual(selections, [{ ...coordinate, ...location }]); assert.equal(page.calls.length, 0); });
  console.log(`[MAP RETURN] ${passed + failed} cases; ${passed} passed; ${failed} failed.`);
  console.log('[MAP RETURN] Limit: component hooks/native map are fixtures; existing form state is represented by route-key identity. Root actual native UI verifies Booking draft continuity.');
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
