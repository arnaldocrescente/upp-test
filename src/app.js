/* Quiz generator — single-page app, vanilla JS */
(() => {
  'use strict';

  const QUIZ_DATA = JSON.parse(document.getElementById('quiz-data').textContent);
  const STORAGE_KEY = 'quiz-state-v1';
  const CONSENT_KEY = 'quiz-consent-v1';
  const PREFS_KEY   = 'quiz-prefs-v1';
  const USER_ID_KEY = 'quiz-user-id-v1';

  let _isNewUser = false;
  const tourState = { active: false, step: 0, scrolled: false };
  const TOUR_STEPS = [
    {
      target: null,
      icon: '🎓',
      title: 'Benvenuto!',
      text: "Questa app ti aiuta a prepararti all'esame per addetti UPP. Ecco un rapido giro guidato — ci vogliono meno di due minuti.",
    },
    {
      target: '.card-exercises',
      icon: '📝',
      title: 'Esercitazioni',
      text: '10 sessioni coprono tutte le 297 domande senza ripetizioni. Il timer da 60 minuti è indicativo: puoi continuare anche dopo la scadenza.',
    },
    {
      target: '.card-exam',
      icon: '⏱',
      title: "Prova d'esame",
      text: "30 domande casuali con timer da 90 minuti che chiude la sessione automaticamente. Punteggio: corretta 1 pt · parziale 0,5 pt · sbagliata 0 pt.",
    },
    {
      target: '.header-controls',
      icon: '🎨',
      title: 'Tema e dimensione testo',
      text: 'Usa i controlli in cima alla pagina per scegliere il tema e la dimensione del testo. Le preferenze vengono salvate automaticamente.',
    },
  ];

  const EXERCISE_COUNT = 10;
  const QUESTIONS_PER_EXERCISE = 30;          // nominal
  const EXERCISE_DURATION_MS = 60 * 60 * 1000; // 60 min
  const EXAM_QUESTIONS = 30;
  const EXAM_DURATION_MS = 90 * 60 * 1000;     // 90 min

  // Configuration.
  //   clarityProjectId   Microsoft Clarity Project ID (10 chars) — found
  //                      in clarity.microsoft.com → Settings → Setup.
  //   paypalMeUsername   PayPal.me username for donations (the part after
  //                      paypal.me/ in your link). Leave empty to hide
  //                      the donation card.
  //   paypalCurrency     Currency code appended to the PayPal.me link.
  // Leaving any value empty disables that feature.
  const CONFIG = {
    clarityProjectId: 'wnuccjvwhb',
    paypalMeUsername: 'arnc',
    paypalCurrency: 'EUR',
  };

  // ----- Preferences (theme / font size / tour) -----
  const prefs = { theme: 'dark', fontSize: 'medium', tourDone: false };

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) Object.assign(prefs, JSON.parse(raw));
    } catch {}
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
  }
  function applyPrefs() {
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.setAttribute('data-size', prefs.fontSize);
  }

  // ----- Consent / Analytics -----
  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
  }
  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch {}
  }
  function loadClarity(projectId) {
    if (!projectId || window.__clarityLoaded) return;
    window.__clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', projectId);
  }
  function applyConsent() {
    if (getConsent() === 'accepted') {
      loadClarity(CONFIG.clarityProjectId);
    }
  }

  // ----- User ID -----
  function initUserId() {
    try {
      if (!localStorage.getItem(USER_ID_KEY)) {
        localStorage.setItem(USER_ID_KEY, 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        _isNewUser = true;
      }
    } catch {}
  }

  // ----- Tour (spotlight) -----
  function endTour(done = true) {
    tourState.active = false;
    if (done) { prefs.tourDone = true; savePrefs(); }
    document.querySelectorAll('.tour-strip, .tour-tooltip').forEach((e) => e.remove());
  }

  function updateTourOverlay() {
    document.querySelectorAll('.tour-strip, .tour-tooltip').forEach((e) => e.remove());
    if (!tourState.active) return;
    if (!getConsent()) return;
    if (state.view !== 'home') { endTour(false); return; }

    const step = TOUR_STEPS[tourState.step];
    if (!step) { endTour(); return; }

    const isLast = tourState.step === TOUR_STEPS.length - 1;
    const Z = 150;
    const BG = 'rgba(0,0,0,0.75)';
    const PAD = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let targetRect = null;

    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.style.position = 'relative';
        targetEl.style.zIndex = String(Z + 10);
        targetEl.style.outline = '2px solid #3b82f6';
        targetEl.style.outlineOffset = '4px';
        if (!tourState.scrolled) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tourState.scrolled = true;
        }
        targetRect = targetEl.getBoundingClientRect();
        const x1 = Math.max(0, targetRect.left - PAD);
        const y1 = Math.max(0, targetRect.top - PAD);
        const x2 = Math.min(vw, targetRect.right + PAD);
        const y2 = Math.min(vh, targetRect.bottom + PAD);
        [
          `position:fixed;top:0;left:0;right:0;height:${y1}px;background:${BG};z-index:${Z};`,
          `position:fixed;top:${y2}px;left:0;right:0;bottom:0;background:${BG};z-index:${Z};`,
          `position:fixed;top:${y1}px;left:0;width:${x1}px;height:${y2 - y1}px;background:${BG};z-index:${Z};`,
          `position:fixed;top:${y1}px;left:${x2}px;right:0;height:${y2 - y1}px;background:${BG};z-index:${Z};`,
        ].forEach((css) => {
          const d = document.createElement('div');
          d.className = 'tour-strip';
          d.style.cssText = css;
          document.body.appendChild(d);
        });
      }
    } else {
      const d = document.createElement('div');
      d.className = 'tour-strip';
      d.style.cssText = `position:fixed;inset:0;background:${BG};z-index:${Z};`;
      document.body.appendChild(d);
    }

    const TW = Math.min(320, vw - 24);
    let tLeft, tTop;
    if (targetRect) {
      tLeft = targetRect.left + (targetRect.width - TW) / 2;
      tLeft = Math.max(12, Math.min(tLeft, vw - TW - 12));
      const spaceBelow = vh - (targetRect.bottom + PAD + 14);
      tTop = spaceBelow >= 160 ? targetRect.bottom + PAD + 14 : targetRect.top - PAD - 174;
      tTop = Math.max(12, Math.min(tTop, vh - 180));
    } else {
      tLeft = Math.max(12, (vw - TW) / 2);
      tTop = Math.max(12, (vh - 220) / 2);
    }

    const tt = document.createElement('div');
    tt.className = 'tour-tooltip';
    tt.style.cssText = `position:fixed;left:${tLeft}px;top:${tTop}px;width:${TW}px;z-index:${Z + 20};`;

    const dot = document.createElement('div');
    dot.className = 'tour-step-dot';
    dot.textContent = `${tourState.step + 1} / ${TOUR_STEPS.length}`;
    tt.appendChild(dot);

    const iconEl = document.createElement('span');
    iconEl.className = 'tour-icon';
    iconEl.textContent = step.icon || '';
    tt.appendChild(iconEl);

    const h = document.createElement('div');
    h.className = 'tour-title';
    h.textContent = step.title;
    tt.appendChild(h);

    const p = document.createElement('p');
    p.className = 'tour-text';
    p.textContent = step.text;
    tt.appendChild(p);

    const row = document.createElement('div');
    row.className = 'tour-btn-row';

    const skip = document.createElement('button');
    skip.className = 'btn ghost tour-btn-sm';
    skip.textContent = 'Salta';
    skip.addEventListener('click', () => endTour());
    row.appendChild(skip);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;gap:8px;';
    if (tourState.step > 0) {
      const prev = document.createElement('button');
      prev.className = 'btn ghost tour-btn-sm';
      prev.textContent = '← Indietro';
      prev.addEventListener('click', () => { tourState.step--; tourState.scrolled = false; updateTourOverlay(); });
      right.appendChild(prev);
    }
    const next = document.createElement('button');
    next.className = 'btn tour-btn-sm';
    next.textContent = isLast ? 'Inizia!' : 'Avanti →';
    next.addEventListener('click', () => {
      if (isLast) { endTour(); } else { tourState.step++; tourState.scrolled = false; updateTourOverlay(); }
    });
    right.appendChild(next);
    row.appendChild(right);
    tt.appendChild(row);
    document.body.appendChild(tt);
  }

  // ----- Storage -----
  const persisted = {
    exercises: null, // array of session descriptors (or null = not generated)
    examHistory: [], // last few exam runs
    exerciseResults: {}, // { [sessionIdx]: result }
    exerciseHistory: [], // archived results from previous exercise sets
    pausedSession: null, // saved mid-session state for resume
  };

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(persisted, JSON.parse(raw));
    } catch {}
  }
  function savePersisted() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {}
  }

  // ----- Helpers -----
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildSessionFromIds(ids) {
    return ids.map((qid) => {
      const q = QUIZ_DATA.find((x) => x.id === qid);
      // answers: index 0 = correct (1pt), index 1 = partial (0.5pt), index 2 = wrong (0pt)
      const indexed = q.answers.map((text, i) => ({ text, isCorrect: i === 0, isPartial: i === 1 }));
      const shuffled = shuffle(indexed);
      return {
        questionId: q.id,
        question: q.question,
        answers: shuffled.map((a) => a.text),
        correctIndex: shuffled.findIndex((a) => a.isCorrect),
        partialIndex: shuffled.findIndex((a) => a.isPartial),
      };
    });
  }

  function generateExercises() {
    const allIds = QUIZ_DATA.map((q) => q.id);
    const shuffledIds = shuffle(allIds);
    const sessions = [];
    // 10 sessions; 297 questions distributed as 9*30 + 1*27 (last one has fewer)
    let idx = 0;
    for (let s = 0; s < EXERCISE_COUNT; s++) {
      const remaining = shuffledIds.length - idx;
      const remainingSessions = EXERCISE_COUNT - s;
      const size = Math.min(QUESTIONS_PER_EXERCISE, Math.ceil(remaining / remainingSessions));
      const ids = shuffledIds.slice(idx, idx + size);
      idx += size;
      sessions.push({
        index: s,
        type: 'exercise',
        questions: buildSessionFromIds(ids),
      });
    }
    return sessions;
  }

  function getWorstAnsweredIds(n) {
    const counts = {};
    const allResults = Object.values(persisted.exerciseResults || {});
    for (const result of allResults) {
      if (!result || !result.questions) continue;
      result.questions.forEach((q, i) => {
        const a = result.answers[i];
        const isWrong = a === null || a === undefined || (a !== q.correctIndex && a !== q.partialIndex);
        if (isWrong) counts[q.questionId] = (counts[q.questionId] || 0) + 1;
      });
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id]) => id);
  }

  function generateExam() {
    const WORST_IN_EXAM = 5;
    const worstIds = getWorstAnsweredIds(WORST_IN_EXAM);
    const worstSet = new Set(worstIds);
    const otherIds = shuffle(QUIZ_DATA.map((q) => q.id).filter((id) => !worstSet.has(id)));
    const ids = shuffle([...worstIds, ...otherIds.slice(0, EXAM_QUESTIONS - worstIds.length)]);
    return {
      type: 'exam',
      questions: buildSessionFromIds(ids),
      generatedAt: Date.now(),
    };
  }

  function fmtTime(ms) {
    const negative = ms < 0;
    const tot = Math.abs(Math.floor(ms / 1000));
    const m = Math.floor(tot / 60);
    const s = tot % 60;
    return `${negative ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ----- Runtime state (current session) -----
  let active = null;
  let timerHandle = null;
  let toastTimeout = null;

  function startSession(session, opts) {
    active = {
      session,
      type: session.type,
      durationMs: opts.durationMs,
      hardStop: opts.hardStop, // exam = true
      startedAt: Date.now(),
      finishedAt: null,
      answers: new Array(session.questions.length).fill(null),
      currentIdx: 0,
      seen: new Set([0]),
      timeUpFired: false,
    };
    render();
  }

  function tick() {
    if (!active || active.finishedAt) return;
    const elapsed = Date.now() - active.startedAt;
    const remaining = active.durationMs - elapsed;

    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.textContent = fmtTime(remaining);
      timerEl.classList.toggle('over', remaining < 0);
      timerEl.classList.toggle('urgent', remaining > 0 && remaining < 5 * 60 * 1000);
    }

    if (remaining <= 0 && !active.timeUpFired) {
      active.timeUpFired = true;
      if (active.hardStop) {
        finishSession();
      } else {
        showToast('Tempo scaduto. Continua pure — verrà mostrato lo sforamento nel riepilogo.');
      }
    }
  }

  function showToast(msg, ms = 5000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    toastTimeout = setTimeout(() => t.remove(), ms);
  }

  function finishSession() {
    if (!active) return;
    active.finishedAt = Date.now();
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }

    const elapsed = active.finishedAt - active.startedAt;
    const remaining = active.durationMs - elapsed;
    const total = active.session.questions.length;
    let correct = 0, partial = 0, wrong = 0, blank = 0, score = 0;
    active.session.questions.forEach((q, i) => {
      const a = active.answers[i];
      if (a === null || a === undefined) blank++;
      else if (a === q.correctIndex) { correct++; score += 1; }
      else if (a === q.partialIndex) { partial++; score += 0.5; }
      else wrong++;
    });

    const result = {
      type: active.type,
      total,
      correct,
      partial,
      wrong,
      blank,
      score,
      elapsedMs: elapsed,
      remainingMs: remaining, // negative = over time
      finishedAt: active.finishedAt,
      questions: active.session.questions,
      answers: active.answers,
      sessionIndex: active.session.index,
    };

    if (active.type === 'exercise') {
      persisted.exerciseResults[active.session.index] = result;
    } else {
      persisted.examHistory = [result, ...(persisted.examHistory || [])].slice(0, 10);
    }
    savePersisted();

    state.view = 'recap';
    state.recap = result;
    active = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pauseSession() {
    if (!active || active.hardStop) return;
    persisted.pausedSession = {
      session: active.session,
      type: active.type,
      durationMs: active.durationMs,
      hardStop: active.hardStop,
      pausedElapsed: Date.now() - active.startedAt,
      answers: active.answers.slice(),
      currentIdx: active.currentIdx,
      seen: [...active.seen],
      timeUpFired: active.timeUpFired,
    };
    savePersisted();
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    active = null;
    setView('home');
  }

  function resumeSession() {
    const p = persisted.pausedSession;
    if (!p) return;
    persisted.pausedSession = null;
    savePersisted();
    active = {
      session: p.session,
      type: p.type,
      durationMs: p.durationMs,
      hardStop: p.hardStop,
      startedAt: Date.now() - p.pausedElapsed,
      finishedAt: null,
      answers: p.answers,
      currentIdx: p.currentIdx,
      seen: new Set(p.seen),
      timeUpFired: p.timeUpFired,
    };
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(tick, 250);
    setView('session');
  }

  // ----- View state -----
  const state = {
    view: 'home', // 'home' | 'session' | 'recap' | 'reviewExercise' | 'history'
    recap: null,
    confirmModal: null,
  };

  function setView(view, data = {}) {
    Object.assign(state, { view, ...data });
    render();
  }

  // ----- Renderers -----
  const root = document.getElementById('app');

  function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'on') {
        for (const [evt, fn] of Object.entries(v)) e.addEventListener(evt, fn);
      } else if (k === 'html') e.innerHTML = v;
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null || child === false) continue;
      e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return e;
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(renderHeader());

    let content;
    if (state.view === 'home') content = renderHome();
    else if (state.view === 'session') content = renderSession();
    else if (state.view === 'recap') content = renderRecap();
    else if (state.view === 'reviewExercise') content = renderRecap();
    else if (state.view === 'history') content = renderHistory();

    root.appendChild(content);
    root.appendChild(renderFooter());
    if (state.confirmModal) root.appendChild(renderModal(state.confirmModal));
    if (!getConsent()) root.appendChild(renderConsentBanner());
    updateTourOverlay();
  }

  function renderConsentBanner() {
    const accept = () => { setConsent('accepted'); applyConsent(); render(); };
    const reject = () => { setConsent('rejected'); render(); };
    return el('div', { class: 'consent-banner' }, [
      el('div', { class: 'consent-text' }, [
        'Questo sito usa ',
        el('strong', {}, 'cookie tecnici'),
        ' (necessari per salvare i tuoi progressi nel browser) e, se accetti, ',
        el('strong', {}, 'analytics anonimi'),
        ' (Microsoft Clarity) per capire come viene usata l\'app. Nessun dato viene venduto.',
      ]),
      el('div', { class: 'consent-actions' }, [
        el('button', { class: 'btn ghost', on: { click: reject } }, 'Solo necessari'),
        el('button', { class: 'btn', on: { click: accept } }, 'Accetta tutto'),
      ]),
    ]);
  }

  function renderHeader() {
    return el('header', { class: 'app-header' }, [
      el('div', { class: 'header-left' }, [
        el('h1', {}, 'Quiz Addetti UPP'),
        el('div', { class: 'meta' }, `${QUIZ_DATA.length} domande in banca dati`),
      ]),
      el('div', { class: 'header-controls' }, [
        renderThemeControls(),
        renderFontControls(),
        renderTourButton(),
      ]),
    ]);
  }

  function renderThemeControls() {
    const themes = [
      { id: 'dark',          label: '☾', title: 'Tema scuro' },
      { id: 'high-contrast', label: '◑', title: 'Alto contrasto' },
      { id: 'sepia',         label: '☀', title: 'Tema seppia' },
    ];
    return el('div', { class: 'ctrl-group' },
      themes.map(({ id, label, title }) =>
        el('button', {
          class: 'ctrl-btn' + (prefs.theme === id ? ' active' : ''),
          title,
          on: { click: () => { prefs.theme = id; savePrefs(); applyPrefs(); render(); } },
        }, label)
      )
    );
  }

  function renderFontControls() {
    const sizes = [
      { id: 'small',  label: 'A', cls: 'fs-s', title: 'Testo piccolo' },
      { id: 'medium', label: 'A', cls: 'fs-m', title: 'Testo medio' },
      { id: 'large',  label: 'A', cls: 'fs-l', title: 'Testo grande' },
    ];
    return el('div', { class: 'ctrl-group' },
      sizes.map(({ id, label, cls, title }) =>
        el('button', {
          class: `ctrl-btn ${cls}` + (prefs.fontSize === id ? ' active' : ''),
          title,
          on: { click: () => { prefs.fontSize = id; savePrefs(); applyPrefs(); render(); } },
        }, label)
      )
    );
  }

  function renderTourButton() {
    return el('button', {
      class: 'tour-trigger',
      title: 'Guida introduttiva',
      on: { click: () => {
        tourState.active = true;
        tourState.step = 0;
        tourState.scrolled = false;
        if (state.view !== 'home') setView('home'); else updateTourOverlay();
      } },
    }, '?');
  }

  function renderFooter() {
    return el('footer', { class: 'app-footer' }, [
      el('div', {}, 'Banca dati locale — i progressi sono salvati nel browser.'),
      el('div', { style: { marginTop: '4px' } }, [
        el('a', {
          href: '#',
          class: 'back-link',
          on: { click: (e) => { e.preventDefault(); confirmReset(); } },
        }, 'Resetta tutti i dati'),
        ' · ',
        el('a', {
          href: '#',
          class: 'back-link',
          on: { click: (e) => {
            e.preventDefault();
            try { localStorage.removeItem(CONSENT_KEY); } catch {}
            render();
          } },
        }, 'Gestisci cookie'),
        ' · ',
        el('a', {
          href: '#',
          class: 'back-link',
          on: { click: (e) => {
            e.preventDefault();
            tourState.active = true;
            tourState.step = 0;
            tourState.scrolled = false;
            if (state.view !== 'home') setView('home'); else updateTourOverlay();
          } },
        }, 'Tour guidato'),
      ]),
    ]);
  }

  function confirmReset() {
    state.confirmModal = {
      title: 'Resettare tutti i dati?',
      body: 'Verranno cancellate tutte le esercitazioni generate e i risultati. Operazione irreversibile.',
      confirmLabel: 'Resetta',
      confirmClass: 'btn danger',
      onConfirm: () => {
        persisted.exercises = null;
        persisted.examHistory = [];
        persisted.exerciseResults = {};
        persisted.exerciseHistory = [];
        savePersisted();
        state.confirmModal = null;
        setView('home');
      },
    };
    render();
  }

  function renderModal(m) {
    return el('div', {
      class: 'modal-backdrop',
      on: { click: (e) => { if (e.target.classList.contains('modal-backdrop')) { state.confirmModal = null; render(); } } },
    }, [
      el('div', { class: 'modal' }, [
        el('h3', {}, m.title),
        el('p', {}, m.body),
        el('div', { class: 'modal-actions' }, [
          el('button', {
            class: 'btn ghost',
            on: { click: () => { state.confirmModal = null; render(); } },
          }, 'Annulla'),
          el('button', {
            class: m.confirmClass || 'btn',
            on: { click: () => { m.onConfirm(); } },
          }, m.confirmLabel || 'Conferma'),
        ]),
      ]),
    ]);
  }

  function renderHome() {
    const wrap = el('div');

    wrap.appendChild(el('div', { class: 'actions-grid' }, [
      el('div', { class: 'card card-exercises' }, [
        el('h2', {}, 'Esercitazioni'),
        el('p', {}, '10 sessioni che coprono tutte le domande senza ripetizioni. Ordine domande e risposte casuale. Timer 60 minuti per sessione (non blocca, mostra eventuale sforamento).'),
        el('div', { class: 'btn-row' }, [
          el('button', {
            class: 'btn',
            ...(persisted.pausedSession ? {} : { disabled: '' }),
            on: { click: resumeSession },
          }, 'Continua'),
          el('button', {
            class: 'btn ' + (persisted.exercises ? 'secondary' : ''),
            on: { click: () => {
              if (persisted.exercises) {
                state.confirmModal = {
                  title: 'Rigenerare le esercitazioni?',
                  body: 'I risultati delle sessioni correnti verranno archiviati nello storico. Nessun dato verrà perso.',
                  confirmLabel: 'Rigenera',
                  onConfirm: () => {
                    const oldResults = Object.values(persisted.exerciseResults || {});
                    if (oldResults.length > 0) {
                      persisted.exerciseHistory = [...(persisted.exerciseHistory || []), ...oldResults];
                    }
                    persisted.exercises = generateExercises();
                    persisted.exerciseResults = {};
                    savePersisted();
                    state.confirmModal = null;
                    setView('home');
                    document.getElementById('session-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  },
                };
                render();
              } else {
                persisted.exercises = generateExercises();
                savePersisted();
                setView('home');
                document.getElementById('session-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            } },
          }, persisted.exercises ? 'Rigenera Esercitazioni' : 'Genera Esercitazioni'),
        ]),
      ]),
      el('div', { class: 'card card-exam' }, [
        el('h2', {}, 'Esame'),
        el('p', {}, '30 domande casuali, risposte mescolate. Timer 90 minuti — alla scadenza la sessione si chiude automaticamente.'),
        el('div', { class: 'btn-row' }, [
          el('button', {
            class: 'btn success',
            on: { click: () => {
              const ex = generateExam();
              startSession(ex, { durationMs: EXAM_DURATION_MS, hardStop: true });
              setView('session');
              if (timerHandle) clearInterval(timerHandle);
              timerHandle = setInterval(tick, 250);
            } },
          }, 'Genera Esame'),
          el('button', {
            class: 'btn ghost',
            on: { click: () => setView('history') },
          }, 'Storico sessioni'),
        ]),
      ]),
    ]));

    if (persisted.exercises) {
      const list = el('div', { class: 'session-list' });
      persisted.exercises.forEach((s, i) => {
        const result = persisted.exerciseResults[i];
        list.appendChild(renderSessionCard(s, i, result));
      });
      wrap.appendChild(el('div', { id: 'session-list' }, [
        el('h2', { style: { fontSize: '1.13rem', marginTop: '8px' } }, 'Le tue 10 sessioni'),
        list,
      ]));
    }

    if (CONFIG.paypalMeUsername) {
      wrap.appendChild(renderDonationCard());
    }

    return wrap;
  }

  function paypalUrl(amount) {
    const u = encodeURIComponent(CONFIG.paypalMeUsername);
    const a = String(amount).replace(',', '.');
    return `https://www.paypal.com/paypalme/${u}/${a}${CONFIG.paypalCurrency}`;
  }

  function renderDonationCard() {
    const presets = [1, 2, 5, 10];
    const card = el('div', { class: 'card donation-card', style: { marginTop: '24px' } });
    card.appendChild(el('h2', {}, 'Ti è utile? Offrimi un caffè ☕'));
    card.appendChild(el('p', {}, 'Se questa app ti sta aiutando a prepararti, puoi supportare lo sviluppo con una piccola donazione. Apre PayPal in una nuova scheda.'));

    const presetRow = el('div', { class: 'donation-presets' },
      presets.map((eur) => el('a', {
        class: 'btn secondary',
        href: paypalUrl(eur),
        target: '_blank',
        rel: 'noopener noreferrer',
      }, `€${eur}`))
    );
    card.appendChild(presetRow);

    const customRow = el('form', {
      class: 'donation-custom',
      on: { submit: (e) => {
        e.preventDefault();
        const v = customRow.querySelector('input').value.trim();
        if (!v) return;
        const num = parseFloat(v.replace(',', '.'));
        if (!isFinite(num) || num <= 0) return;
        window.open(paypalUrl(num.toFixed(2)), '_blank', 'noopener');
      } },
    }, [
      el('input', {
        type: 'number',
        min: '0.5',
        step: '0.5',
        placeholder: 'Importo a piacere',
        'aria-label': 'Importo personalizzato',
      }),
      el('span', { class: 'currency-suffix' }, CONFIG.paypalCurrency),
      el('button', { class: 'btn', type: 'submit' }, 'Dona'),
    ]);
    card.appendChild(customRow);

    return card;
  }

  function renderSessionCard(s, i, result) {
    const card = el('div', { class: 'session-card' + (result ? ' completed' : '') });
    card.appendChild(el('div', { class: 'label' }, `Sessione ${i + 1}`));
    card.appendChild(el('div', { class: 'title' }, `${s.questions.length} domande`));
    if (result) {
      const score = result.score != null ? result.score : result.correct;
      card.appendChild(el('div', { class: 'score' }, `${score} pt su ${result.total}`));
      const btnRow = el('div', { class: 'btn-row' }, [
        el('button', {
          class: 'btn ghost',
          on: { click: () => setView('recap', { recap: result }) },
        }, 'Rivedi'),
        el('button', {
          class: 'btn secondary',
          on: { click: () => {
            startSession(s, { durationMs: EXERCISE_DURATION_MS, hardStop: false });
            setView('session');
            if (timerHandle) clearInterval(timerHandle);
            timerHandle = setInterval(tick, 250);
          } },
        }, 'Rifai'),
      ]);
      card.appendChild(btnRow);
    } else {
      card.appendChild(el('div', { class: 'status' }, 'Non iniziata'));
      card.appendChild(el('button', {
        class: 'btn',
        on: { click: () => {
          startSession(s, { durationMs: EXERCISE_DURATION_MS, hardStop: false });
          setView('session');
          if (timerHandle) clearInterval(timerHandle);
          timerHandle = setInterval(tick, 250);
        } },
      }, 'Start'));
    }
    return card;
  }

  function renderSession() {
    if (!active) return el('div', {}, 'Nessuna sessione attiva.');

    // Mark current question as seen
    if (!active.seen) active.seen = new Set([0]);
    active.seen.add(active.currentIdx);

    const wrap = el('div');
    const total = active.session.questions.length;
    const elapsed = Date.now() - active.startedAt;
    const remaining = active.durationMs - elapsed;
    const answeredCount = active.answers.filter((a) => a !== null && a !== undefined).length;
    const qi = active.currentIdx;
    const q = active.session.questions[qi];

    // Sticky header
    wrap.appendChild(el('div', { class: 'quiz-header' }, [
      el('div', { class: 'progress' }, [
        active.type === 'exam' ? 'Esame' : `Esercitazione ${active.session.index + 1}`,
        ` · ${answeredCount}/${total} risposte`,
      ]),
      el('div', { id: 'timer', class: 'timer' }, fmtTime(remaining)),
      !active.hardStop
        ? el('button', {
            class: 'btn ghost',
            on: { click: pauseSession },
          }, 'Pausa')
        : null,
      el('button', {
        class: 'btn danger',
        on: { click: () => {
          state.confirmModal = {
            title: 'Terminare la sessione?',
            body: 'Le risposte non date verranno conteggiate come saltate.',
            confirmLabel: 'Termina',
            confirmClass: 'btn danger',
            onConfirm: () => {
              state.confirmModal = null;
              finishSession();
            },
          };
          render();
        } },
      }, 'Termina'),
    ]));

    // Question navigator grid
    const navGrid = el('div', { class: 'q-nav' });
    for (let i = 0; i < total; i++) {
      const answered = active.answers[i] !== null && active.answers[i] !== undefined;
      const seen = active.seen.has(i);
      let cls = 'q-nav-btn';
      if (i === qi) cls += ' current';
      if (answered) cls += ' answered';
      else if (seen) cls += ' skipped';
      navGrid.appendChild(el('button', {
        class: cls,
        on: { click: () => {
          active.currentIdx = i;
          render();
          window.scrollTo(0, 0);
        } },
      }, String(i + 1)));
    }
    wrap.appendChild(navGrid);

    // Current question block
    const block = el('div', { class: 'question-block' });
    const hasAnswer = active.answers[qi] !== null && active.answers[qi] !== undefined;
    block.appendChild(el('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    }, [
      el('div', { style: { fontSize: '0.87rem', color: 'var(--muted)' } }, `Domanda ${qi + 1} di ${total}`),
      hasAnswer
        ? el('button', {
            class: 'btn ghost',
            style: { padding: '4px 10px', fontSize: '0.8rem' },
            on: { click: () => { active.answers[qi] = null; render(); } },
          }, 'Annulla risposta')
        : el('span', { style: { fontSize: '0.8rem', color: 'var(--muted)' } }, 'Non risposta'),
    ]));
    block.appendChild(el('div', { class: 'question-text' }, q.question));
    const list = el('div', { class: 'answer-list' });
    q.answers.forEach((aText, ai) => {
      const isSel = active.answers[qi] === ai;
      list.appendChild(el('div', {
        class: 'answer' + (isSel ? ' selected' : ''),
        on: { click: () => {
          active.answers[qi] = isSel ? null : ai;
          render();
        } },
      }, [
        el('div', { class: 'marker' }, String.fromCharCode(65 + ai)),
        el('div', {}, aText),
      ]));
    });
    block.appendChild(list);
    wrap.appendChild(block);

    // Prev / Next navigation
    const goTo = (idx) => {
      active.currentIdx = idx;
      render();
      window.scrollTo(0, 0);
    };
    const navRow = el('div', { class: 'btn-row q-nav-row' });
    const prevBtn = el('button', { class: 'btn ghost', on: { click: () => goTo(qi - 1) } }, '← Precedente');
    if (qi === 0) prevBtn.setAttribute('disabled', '');
    navRow.appendChild(prevBtn);
    if (qi < total - 1) {
      navRow.appendChild(el('button', { class: 'btn', on: { click: () => goTo(qi + 1) } }, 'Successiva →'));
    } else {
      navRow.appendChild(el('button', { class: 'btn success', on: { click: () => finishSession() } }, 'Concludi e vedi risultati'));
    }
    wrap.appendChild(navRow);

    return wrap;
  }

  function renderRecap() {
    const r = state.recap;
    if (!r) return el('div', {}, 'Nessun risultato.');
    const wrap = el('div');

    wrap.appendChild(el('a', {
      href: '#',
      class: 'back-link',
      on: { click: (e) => { e.preventDefault(); setView('home'); } },
    }, '← Torna alla home'));

    const score = r.score != null ? r.score : r.correct;
    const partial = r.partial || 0;
    const overTime = r.remainingMs < 0;

    wrap.appendChild(el('h2', { style: { marginTop: '8px' } }, `Riepilogo ${r.type === 'exam' ? 'Esame' : `Esercitazione ${r.sessionIndex + 1}`}`));

    wrap.appendChild(el('div', { class: 'summary-grid' }, [
      el('div', { class: 'stat success' }, [
        el('div', { class: 'stat-label' }, 'Punteggio'),
        el('div', { class: 'stat-value' }, `${score} / ${r.total}`),
      ]),
      el('div', { class: 'stat success' }, [
        el('div', { class: 'stat-label' }, 'Corrette (1 pt)'),
        el('div', { class: 'stat-value' }, String(r.correct)),
      ]),
      el('div', { class: 'stat warning' }, [
        el('div', { class: 'stat-label' }, 'Parziali (0,5 pt)'),
        el('div', { class: 'stat-value' }, String(partial)),
      ]),
      el('div', { class: 'stat danger' }, [
        el('div', { class: 'stat-label' }, 'Sbagliate / Saltate'),
        el('div', { class: 'stat-value' }, `${r.wrong} / ${r.blank}`),
      ]),
      el('div', { class: 'stat' + (overTime ? ' danger' : ' success') }, [
        el('div', { class: 'stat-label' }, overTime ? 'Tempo sforato' : 'Tempo rimanente'),
        el('div', { class: 'stat-value' }, fmtTime(r.remainingMs)),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'stat-label' }, 'Durata'),
        el('div', { class: 'stat-value' }, fmtTime(r.elapsedMs)),
      ]),
    ]));

    r.questions.forEach((q, qi) => {
      const userAns = r.answers[qi];
      const isCorrect = userAns === q.correctIndex;
      const isPartial = userAns === q.partialIndex;
      const isBlank = userAns === null || userAns === undefined;
      const block = el('div', { class: 'recap-question' });
      block.appendChild(el('div', { class: 'q-num' }, [
        `Domanda ${qi + 1}`,
        isBlank
          ? el('span', { class: 'tag your' }, 'Saltata')
          : isCorrect
            ? el('span', { class: 'tag correct' }, 'Corretta')
            : isPartial
              ? el('span', { class: 'tag partial' }, 'Parziale')
              : el('span', { class: 'tag wrong' }, 'Errata'),
      ]));
      block.appendChild(el('div', { class: 'q-text' }, q.question));
      q.answers.forEach((aText, ai) => {
        const isUser = ai === userAns;
        const isCorr = ai === q.correctIndex;
        const isPart = ai === q.partialIndex;
        const cls = ['recap-answer'];
        if (isCorr) cls.push('is-correct');
        if (isPart && !isUser) cls.push('is-partial');
        if (isUser && isPart) cls.push('user-partial');
        if (isUser && !isCorr && !isPart) cls.push('user-wrong');
        if (isUser && isCorr) cls.push('user-correct');
        const tags = [];
        if (isCorr) tags.push(el('span', { class: 'tag correct' }, 'Risposta corretta'));
        if (isPart) tags.push(el('span', { class: 'tag partial' }, 'Risposta parziale'));
        if (isUser) tags.push(el('span', { class: 'tag your' }, 'La tua risposta'));
        block.appendChild(el('div', { class: cls.join(' ') }, [
          el('div', {}, [
            el('strong', {}, String.fromCharCode(65 + ai) + '. '),
            aText,
            ...tags,
          ]),
        ]));
      });
      wrap.appendChild(block);
    });

    wrap.appendChild(el('div', { class: 'btn-row', style: { marginTop: '20px' } }, [
      el('button', { class: 'btn', on: { click: () => setView('home') } }, 'Torna alla home'),
    ]));

    return wrap;
  }

  function renderHistory() {
    const wrap = el('div');

    wrap.appendChild(el('a', {
      href: '#',
      class: 'back-link',
      on: { click: (e) => { e.preventDefault(); setView('home'); } },
    }, '← Torna alla home'));

    wrap.appendChild(el('h2', { style: { marginTop: '8px', marginBottom: '16px' } }, 'Storico sessioni'));

    // Collect all completed sessions
    const rows = [];

    if (persisted.exercises) {
      persisted.exercises.forEach((s, i) => {
        const r = persisted.exerciseResults[i];
        if (!r) return;
        const score = r.score != null ? r.score : r.correct;
        rows.push({ label: `Esercitazione ${i + 1}`, date: r.finishedAt, score, total: r.total, partial: r.partial || 0, correct: r.correct, wrong: r.wrong, blank: r.blank, result: r });
      });
    }

    if (persisted.examHistory) {
      persisted.examHistory.forEach((r) => {
        const score = r.score != null ? r.score : r.correct;
        rows.push({ label: 'Esame', date: r.finishedAt, score, total: r.total, partial: r.partial || 0, correct: r.correct, wrong: r.wrong, blank: r.blank, result: r });
      });
    }

    if (persisted.exerciseHistory) {
      persisted.exerciseHistory.forEach((r) => {
        const score = r.score != null ? r.score : r.correct;
        const label = r.sessionIndex != null ? `Esercitazione ${r.sessionIndex + 1} (archiviata)` : 'Esercitazione (archiviata)';
        rows.push({ label, date: r.finishedAt, score, total: r.total, partial: r.partial || 0, correct: r.correct, wrong: r.wrong, blank: r.blank, result: r });
      });
    }

    if (!rows.length) {
      wrap.appendChild(el('p', { style: { color: 'var(--muted)', marginTop: '16px' } }, 'Nessuna sessione completata.'));
      return wrap;
    }

    rows.sort((a, b) => b.date - a.date);

    const table = el('div', { class: 'history-table' });
    table.appendChild(el('div', { class: 'history-row history-head' }, [
      el('div', {}, 'Sessione'),
      el('div', {}, 'Data'),
      el('div', {}, 'Punteggio'),
      el('div', {}, 'Corrette'),
      el('div', {}, 'Parziali'),
      el('div', {}, 'Sbagliate'),
      el('div', {}, ''),
    ]));

    rows.forEach((row) => {
      table.appendChild(el('div', { class: 'history-row' }, [
        el('div', {}, row.label),
        el('div', {}, new Date(row.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
        el('div', { class: 'score' }, `${row.score} / ${row.total}`),
        el('div', {}, String(row.correct)),
        el('div', {}, String(row.partial)),
        el('div', {}, String(row.wrong)),
        el('div', {}, [
          el('button', { class: 'btn ghost', style: { padding: '4px 10px', fontSize: '0.8rem' }, on: { click: () => setView('recap', { recap: row.result }) } }, 'Rivedi'),
        ]),
      ]));
    });

    wrap.appendChild(table);
    return wrap;
  }

  // ----- Boot -----
  initUserId();
  loadPersisted();
  loadPrefs();
  applyPrefs();
  if (_isNewUser && !prefs.tourDone) tourState.active = true;
  applyConsent();
  render();
})();
