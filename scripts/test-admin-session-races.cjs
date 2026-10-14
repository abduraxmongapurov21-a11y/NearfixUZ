/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../backend/node_modules/typescript');

function fixture() {
  const pending = [];
  const storage = new Map();
  const sourcePath = path.resolve(__dirname, '../admin-web/stores/admin-session-store.ts');
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = new Module(sourcePath);
  module.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  const defaultRequire = module.require.bind(module);
  module.require = (id) => {
    if (id === '@/services/admin-auth') return {
      fetchAdminMe: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
      loginAdmin: () => new Promise((resolve, reject) => pending.push({ resolve, reject }))
    };
    if (id === '@/shared/auth/permissions') return { normalizeAdminRole: (role) => role === 'super_admin' ? role : 'admin' };
    return defaultRequire(id);
  };
  global.window = { localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  } };
  module._compile(compiled, sourcePath);
  const store = module.exports.useAdminSessionStore;
  const response = (name) => ({ token: `test-token-${name}`, user: {
    id: name, username: name, name, role: 'admin', permissions: ['workers.read'], tokenType: 'admin_account'
  } });
  return { store, pending, storage, response };
}

(async () => {
  {
    const { store, pending, storage, response } = fixture();
    storage.set('nearfix-admin-token', 'old-token');
    const hydration = store.getState().hydrateSession();
    store.getState().logout();
    pending[0].resolve(response('old'));
    await hydration;
    assert.equal(store.getState().session, null, 'late hydration must not restore a logged-out admin');
    assert.equal(storage.has('nearfix-admin-token'), false);
  }
  {
    const { store, pending, storage, response } = fixture();
    const login = store.getState().login('old', 'test-only');
    store.getState().logout();
    pending[0].resolve(response('old'));
    await login;
    assert.equal(store.getState().session, null, 'late login must not undo logout');
    assert.equal(storage.has('nearfix-admin-token'), false);
  }
  {
    const { store, pending, storage, response } = fixture();
    const older = store.getState().login('old', 'test-only');
    const newer = store.getState().login('new', 'test-only');
    pending[1].resolve(response('new'));
    assert.equal((await newer).ok, true);
    pending[0].resolve(response('old'));
    await older;
    assert.equal(store.getState().session.id, 'new', 'older login must not replace newer account');
    assert.equal(storage.get('nearfix-admin-token'), 'test-token-new');
  }
  {
    const { store, pending, storage, response } = fixture();
    storage.set('nearfix-admin-token', 'old-token');
    const hydration = store.getState().hydrateSession();
    const login = store.getState().login('new', 'test-only');
    pending[1].resolve(response('new'));
    await login;
    pending[0].reject(new Error('old session expired'));
    await hydration;
    assert.equal(store.getState().session.id, 'new', 'old hydration failure must not remove newer session');
    assert.equal(storage.get('nearfix-admin-token'), 'test-token-new');
  }
  console.log('Admin session race regressions passed: late hydration, late login, reversed login, stale failure.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
