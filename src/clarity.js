/**
 * Clarity user identification module.
 *
 * Exposes four functions on window:
 *   initClarityIdentity()    — call once at app boot (after consent)
 *   trackClarityPageView()   — call on every view/route change
 *   getClarityUserId()       — returns the persisted UUID or null
 *   getClarityVisitStats()   — returns { visits, first, last }
 *
 * On init, also sets Clarity custom tags so the dashboard can filter
 * returning users (the default "Users" metric is based on Clarity's
 * own cookie, not on the custom-id passed to identify):
 *   visit_count   — total visits for this localStorage profile
 *   returning     — "yes" after the second visit, "no" on the first
 *   first_seen    — ISO date (YYYY-MM-DD) of the first visit
 *
 * Storage fallback chain: localStorage → sessionStorage → in-memory.
 * Safe to call before window.clarity is ready; the Clarity snippet
 * already queues calls internally.
 */
(function () {
  'use strict';

  var CLARITY_ID_KEY = 'clarity:userId';
  var CLARITY_VISITS_KEY = 'clarity:visits';
  var CLARITY_FIRST_SEEN_KEY = 'clarity:firstSeen';
  var CLARITY_LAST_SEEN_KEY = 'clarity:lastSeen';
  // Two visits within this window are treated as the same session
  // (avoids inflating the counter on reloads / view changes).
  var SESSION_GAP_MS = 30 * 60 * 1000; // 30 min

  // In-memory fallback when both storage APIs are unavailable.
  var _memoryId = null;
  var _memoryVisits = 0;
  var _memoryFirstSeen = null;
  var _memoryLastSeen = null;
  var _initialized = false;

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isValidUUID(str) {
    return typeof str === 'string' && UUID_RE.test(str);
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID (very old browsers).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function readStorage(storage, key) {
    try { return storage.getItem(key); } catch (_) { return null; }
  }

  function writeStorage(storage, key, value) {
    try { storage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function loadId() {
    // 1. localStorage
    var id = readStorage(localStorage, CLARITY_ID_KEY);
    if (isValidUUID(id)) return { id: id, tier: 'local' };

    // 2. sessionStorage
    id = readStorage(sessionStorage, CLARITY_ID_KEY);
    if (isValidUUID(id)) return { id: id, tier: 'session' };

    // 3. in-memory
    if (isValidUUID(_memoryId)) return { id: _memoryId, tier: 'memory' };

    return null;
  }

  function persistId(id) {
    if (!writeStorage(localStorage, CLARITY_ID_KEY, id)) {
      if (!writeStorage(sessionStorage, CLARITY_ID_KEY, id)) {
        _memoryId = id;
      }
    }
  }

  function readNumber(storage, key) {
    var raw = readStorage(storage, key);
    var n = raw ? parseInt(raw, 10) : NaN;
    return isNaN(n) ? null : n;
  }

  function loadVisitStats() {
    var visits = readNumber(localStorage, CLARITY_VISITS_KEY);
    var first = readNumber(localStorage, CLARITY_FIRST_SEEN_KEY);
    var last = readNumber(localStorage, CLARITY_LAST_SEEN_KEY);
    if (visits === null) visits = readNumber(sessionStorage, CLARITY_VISITS_KEY);
    if (first === null) first = readNumber(sessionStorage, CLARITY_FIRST_SEEN_KEY);
    if (last === null) last = readNumber(sessionStorage, CLARITY_LAST_SEEN_KEY);
    if (visits === null) visits = _memoryVisits;
    if (first === null) first = _memoryFirstSeen;
    if (last === null) last = _memoryLastSeen;
    return { visits: visits || 0, first: first, last: last };
  }

  function persistVisitStats(visits, first, last) {
    var v = String(visits);
    var f = String(first);
    var l = String(last);
    if (!writeStorage(localStorage, CLARITY_VISITS_KEY, v) ||
        !writeStorage(localStorage, CLARITY_FIRST_SEEN_KEY, f) ||
        !writeStorage(localStorage, CLARITY_LAST_SEEN_KEY, l)) {
      if (!writeStorage(sessionStorage, CLARITY_VISITS_KEY, v) ||
          !writeStorage(sessionStorage, CLARITY_FIRST_SEEN_KEY, f) ||
          !writeStorage(sessionStorage, CLARITY_LAST_SEEN_KEY, l)) {
        _memoryVisits = visits;
        _memoryFirstSeen = first;
        _memoryLastSeen = last;
      }
    }
  }

  function bumpVisitStats() {
    var now = Date.now();
    var stats = loadVisitStats();
    var first = stats.first || now;
    // Only increment when enough time has passed since the last hit,
    // so reloads and view changes don't count as new visits.
    var isNewVisit = !stats.last || (now - stats.last) > SESSION_GAP_MS;
    var visits = isNewVisit ? stats.visits + 1 : Math.max(stats.visits, 1);
    persistVisitStats(visits, first, now);
    return { visits: visits, first: first, isNewVisit: isNewVisit };
  }

  function setClarityTag(key, value) {
    try {
      if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        window.clarity('set', key, value);
      }
    } catch (_) {}
  }

  function callClarity(userId) {
    try {
      if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        window.clarity('identify', userId);
      }
    } catch (_) {}
  }

  /**
   * Generates or retrieves the persistent user ID and identifies the user
   * in Clarity. Safe to call multiple times — subsequent calls are no-ops.
   */
  function initClarityIdentity() {
    if (typeof window === 'undefined') return;
    if (_initialized) {
      // Already init'd; still fire identify in case Clarity just loaded.
      trackClarityPageView();
      return;
    }
    _initialized = true;

    var existing = loadId();
    var userId;
    if (existing) {
      userId = existing.id;
    } else {
      userId = generateUUID();
      persistId(userId);
    }

    var stats = bumpVisitStats();
    setClarityTag('visit_count', String(stats.visits));
    setClarityTag('returning', stats.visits > 1 ? 'yes' : 'no');
    setClarityTag('first_seen', new Date(stats.first).toISOString().slice(0, 10));

    callClarity(userId);
  }

  /**
   * Calls clarity('identify', userId) with the current stored ID.
   * Should be called on every view/route change.
   * No-op if Clarity is not loaded or no ID exists yet.
   */
  function trackClarityPageView() {
    if (typeof window === 'undefined') return;
    var userId = getClarityUserId();
    if (userId) callClarity(userId);
  }

  /**
   * Returns the current Clarity user ID or null if not yet initialized.
   */
  function getClarityUserId() {
    if (typeof window === 'undefined') return null;
    var found = loadId();
    return found ? found.id : null;
  }

  function getClarityVisitStats() {
    if (typeof window === 'undefined') return { visits: 0, first: null, last: null };
    return loadVisitStats();
  }

  window.initClarityIdentity = initClarityIdentity;
  window.trackClarityPageView = trackClarityPageView;
  window.getClarityUserId = getClarityUserId;
  window.getClarityVisitStats = getClarityVisitStats;
})();
