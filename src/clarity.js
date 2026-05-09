/**
 * Clarity user identification module.
 *
 * Exposes three functions on window:
 *   initClarityIdentity()   — call once at app boot (after consent)
 *   trackClarityPageView()  — call on every view/route change
 *   getClarityUserId()      — returns the persisted UUID or null
 *
 * Storage fallback chain: localStorage → sessionStorage → in-memory.
 * Safe to call before window.clarity is ready; the Clarity snippet
 * already queues calls internally.
 */
(function () {
  'use strict';

  var CLARITY_ID_KEY = 'clarity:userId';

  // In-memory fallback when both storage APIs are unavailable.
  var _memoryId = null;
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

  window.initClarityIdentity = initClarityIdentity;
  window.trackClarityPageView = trackClarityPageView;
  window.getClarityUserId = getClarityUserId;
})();
