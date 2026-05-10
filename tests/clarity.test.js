/**
 * Unit tests for src/clarity.js — run with: node tests/clarity.test.js
 * No external dependencies required.
 */
'use strict';

// ── Minimal test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✓', name);
    passed++;
  } catch (err) {
    console.error('  ✗', name);
    console.error('   ', err.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
}

// ── Mock storage ─────────────────────────────────────────────────────────────

function makeMockStorage() {
  const store = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
  };
}

function makeThrowingStorage() {
  return {
    getItem() { return null; },
    setItem() { throw new Error('Storage blocked'); },
    removeItem() {},
    clear() {},
  };
}

// ── Reload module with custom globals ────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/clarity.js'), 'utf8');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loadModule(overrides) {
  const fakeWindow = {
    clarity: null,
    initClarityIdentity: null,
    trackClarityPageView: null,
    getClarityUserId: null,
    ...overrides,
  };

  const fn = new Function(
    'window', 'localStorage', 'sessionStorage', 'crypto',
    src + '\n return window;'
  );

  const localStorage  = overrides.localStorage  || makeMockStorage();
  const sessionStorage = overrides.sessionStorage || makeMockStorage();
  const crypto = { randomUUID: () => require('crypto').randomUUID() };

  fn(fakeWindow, localStorage, sessionStorage, crypto);
  return { w: fakeWindow, localStorage, sessionStorage };
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\nsrc/clarity.js — unit tests\n');

test('first visit: generates a valid UUID v4', () => {
  const { w } = loadModule({});
  w.initClarityIdentity();
  const id = w.getClarityUserId();
  assert(UUID_RE.test(id), `"${id}" is not a valid UUID v4`);
});

test('second call to initClarityIdentity: returns same ID (no-op)', () => {
  const { w } = loadModule({});
  w.initClarityIdentity();
  const id1 = w.getClarityUserId();
  w.initClarityIdentity();
  const id2 = w.getClarityUserId();
  assertEqual(id1, id2);
});

test('second visit (new module load, same storage): reuses stored UUID', () => {
  const sharedLocal = makeMockStorage();
  const sharedSession = makeMockStorage();

  const { w: w1 } = loadModule({ localStorage: sharedLocal, sessionStorage: sharedSession });
  w1.initClarityIdentity();
  const id1 = w1.getClarityUserId();

  // Simulate a new page load by reloading the module with the same storage.
  const { w: w2 } = loadModule({ localStorage: sharedLocal, sessionStorage: sharedSession });
  w2.initClarityIdentity();
  const id2 = w2.getClarityUserId();

  assertEqual(id1, id2);
});

test('localStorage blocked: falls back to sessionStorage', () => {
  const { w, sessionStorage } = loadModule({
    localStorage: makeThrowingStorage(),
  });
  w.initClarityIdentity();
  const id = w.getClarityUserId();
  assert(UUID_RE.test(id), 'ID is not a valid UUID v4');
  assertEqual(sessionStorage.getItem('clarity:userId'), id);
});

test('both storages blocked: falls back to in-memory', () => {
  const { w } = loadModule({
    localStorage: makeThrowingStorage(),
    sessionStorage: makeThrowingStorage(),
  });
  w.initClarityIdentity();
  const id = w.getClarityUserId();
  assert(UUID_RE.test(id), 'ID is not a valid UUID v4');
});

test('corrupted UUID in localStorage: regenerates a valid one', () => {
  const ls = makeMockStorage();
  ls.setItem('clarity:userId', 'not-a-uuid');
  const { w } = loadModule({ localStorage: ls });
  w.initClarityIdentity();
  const id = w.getClarityUserId();
  assert(UUID_RE.test(id), 'Regenerated ID is not a valid UUID v4');
  assert(id !== 'not-a-uuid', 'Should not reuse the corrupted value');
});

test('trackClarityPageView: calls window.clarity with stored ID', () => {
  let clarityArgs = null;
  const { w } = loadModule({
    clarity: function (...args) { clarityArgs = args; },
  });
  w.initClarityIdentity();
  const id = w.getClarityUserId();
  w.trackClarityPageView();
  assert(clarityArgs !== null, 'clarity() was not called');
  assertEqual(clarityArgs[0], 'identify');
  assertEqual(clarityArgs[1], id);
});

test('trackClarityPageView: no-op when window.clarity is not a function', () => {
  const { w } = loadModule({});
  // clarity is null on fakeWindow — should not throw
  w.initClarityIdentity();
  w.trackClarityPageView(); // must not throw
  assert(true);
});

test('getClarityUserId: returns null before init', () => {
  const { w } = loadModule({});
  assertEqual(w.getClarityUserId(), null);
});

test('first visit: sets visit_count=1 and returning=no via clarity("set", ...)', () => {
  const calls = [];
  const { w } = loadModule({
    clarity: function (...args) { calls.push(args); },
  });
  w.initClarityIdentity();
  const setCalls = calls.filter(c => c[0] === 'set');
  const visit = setCalls.find(c => c[1] === 'visit_count');
  const returning = setCalls.find(c => c[1] === 'returning');
  assert(visit && visit[2] === '1', `visit_count should be "1", got ${visit && visit[2]}`);
  assert(returning && returning[2] === 'no', `returning should be "no", got ${returning && returning[2]}`);
});

test('second visit (after session gap): increments visit_count and sets returning=yes', () => {
  const sharedLocal = makeMockStorage();
  // Seed last visit > 30 min ago.
  sharedLocal.setItem('clarity:userId', '11111111-1111-4111-8111-111111111111');
  sharedLocal.setItem('clarity:visits', '1');
  sharedLocal.setItem('clarity:firstSeen', String(Date.now() - 24 * 60 * 60 * 1000));
  sharedLocal.setItem('clarity:lastSeen', String(Date.now() - 60 * 60 * 1000));

  const calls = [];
  const { w } = loadModule({
    localStorage: sharedLocal,
    clarity: function (...args) { calls.push(args); },
  });
  w.initClarityIdentity();
  const setCalls = calls.filter(c => c[0] === 'set');
  const visit = setCalls.find(c => c[1] === 'visit_count');
  const returning = setCalls.find(c => c[1] === 'returning');
  assertEqual(visit[2], '2');
  assertEqual(returning[2], 'yes');
});

test('reload within session gap: does NOT increment visit_count', () => {
  const sharedLocal = makeMockStorage();
  sharedLocal.setItem('clarity:userId', '11111111-1111-4111-8111-111111111111');
  sharedLocal.setItem('clarity:visits', '3');
  sharedLocal.setItem('clarity:firstSeen', String(Date.now() - 24 * 60 * 60 * 1000));
  sharedLocal.setItem('clarity:lastSeen', String(Date.now() - 60 * 1000)); // 1 min ago

  const calls = [];
  const { w } = loadModule({
    localStorage: sharedLocal,
    clarity: function (...args) { calls.push(args); },
  });
  w.initClarityIdentity();
  const visit = calls.filter(c => c[0] === 'set').find(c => c[1] === 'visit_count');
  assertEqual(visit[2], '3');
});

test('getClarityVisitStats: reflects the persisted counter', () => {
  const sharedLocal = makeMockStorage();
  const { w } = loadModule({ localStorage: sharedLocal });
  w.initClarityIdentity();
  const stats = w.getClarityVisitStats();
  assertEqual(stats.visits, 1);
  assert(typeof stats.first === 'number', 'first should be a timestamp');
  assert(typeof stats.last === 'number', 'last should be a timestamp');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
