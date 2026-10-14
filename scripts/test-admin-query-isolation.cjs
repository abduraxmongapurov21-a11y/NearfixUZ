/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../backend/node_modules/typescript');
const { QueryObserver } = require('../admin-web/node_modules/@tanstack/react-query');

const sourcePath = path.resolve(__dirname, '../admin-web/app/providers.tsx');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
let token;
let memo;
let previousKey;
const memoize = (factory) => {
  if (!memo) memo = factory();
  return memo;
};
const moduleUnderTest = new Module(sourcePath);
moduleUnderTest.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const defaultRequire = moduleUnderTest.require.bind(moduleUnderTest);
moduleUnderTest.require = (id) => {
  if (id === 'react') return { useMemo: memoize, useState: (factory) => [memoize(factory)] };
  if (id === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }) };
  if (id === '@/stores/admin-session-store') return { useAdminSessionStore: (selector) => selector({session: token ? {token} : null}) };
  return defaultRequire(id);
};
moduleUnderTest._compile(compiled, sourcePath);
const render = () => {
  const scope = moduleUnderTest.exports.Providers({children: null});
  assert.equal(scope.key, token || 'anonymous', 'session transition must remount the query observer subtree');
  if (previousKey !== scope.key) { memo = undefined; previousKey = scope.key; }
  return scope.type(scope.props).props.client;
};

(async () => {
  token = 'test-admin-a';
  const first = render();
  first.setQueryData(['workers'], [{id: 'private-to-a'}]);
  const firstObserver = new QueryObserver(first, {queryKey: ['workers'], enabled: false});
  assert.equal(firstObserver.getCurrentResult().data[0].id, 'private-to-a');
  assert.equal(render(), first, 'same account keeps its query cache');
  let resolve;
  const oldRequest = first.fetchQuery({queryKey: ['orders'], queryFn: () => new Promise((done) => {resolve = done;})});
  token = undefined;
  assert.notEqual(render(), first, 'logout must discard access to prior account cache');
  token = 'test-admin-b';
  const second = render();
  assert.equal(second.getQueryData(['workers']), undefined, 'new account must not receive old cached workers');
  const secondObserver = new QueryObserver(second, {queryKey: ['workers'], enabled: false});
  assert.equal(secondObserver.getCurrentResult().data, undefined, 'remounted observers must bind to the new client');
  resolve([{id: 'late-private-order-a'}]);
  await oldRequest;
  assert.equal(second.getQueryData(['orders']), undefined, 'late old request must not enter new account cache');
  first.clear();
  second.clear();
  firstObserver.destroy();
  secondObserver.destroy();
  console.log('Admin query isolation passed: same account, logout, account switch, late request.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
