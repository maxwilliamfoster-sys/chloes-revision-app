'use strict';
/* ============================================================
   Chloe's Revision — engine + UI (no log-in: always Chloe).
   Progress is saved on this device (localStorage) with a
   backup code in Settings.
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

const D = {
  key(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  today() { return D.key(); },
  add(k, n) { const [y, m, d] = k.split('-').map(Number); return D.key(new Date(y, m - 1, d + n)); },
};

/* ---------- state ---------- */
const KEY = 'chloe-revision-v1';
const DEFAULTS = {
  v: 1, name: 'Chloe', xp: 0, days: {}, les: {}, miss: {}, tot: { lessons: 0, correct: 0, fixed: 0 }, badges: {},
  settings: { font: 'lexend', size: 2, tint: 'cream', sound: true, speak: false, rate: 0.9, goal: 2, lit: null, breaks: true },
  created: null,
};
function merge(base, over) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k in over) out[k] = (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') ? merge(base[k], over[k]) : over[k];
  return out;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v) return merge(DEFAULTS, s); } catch (e) { /* private mode */ }
  const s = merge(DEFAULTS, {}); s.created = D.today(); return s;
}
let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

/* ---------- content index ---------- */
const SUBJ = {}, LESSON = {}, QBY = {};
for (const s of RC.subjects) {
  SUBJ[s.id] = s;
  for (const u of s.units) for (const l of u.lessons) {
    l.subj = s.id; l.unit = u; LESSON[l.id] = l;
    if (l.qs) l.qs.forEach((q, i) => { q.id = l.id + '#' + i; q.lesson = l.id; QBY[q.id] = q; });
  }
}
const BOOKS = RC.books || [];
function unitsOf(s) {
  if (s.id !== 'englit') return s.units;
  const lit = state.settings.lit || [];
  return s.units.filter((u) => !u.book || lit.includes(u.book));
}
function lessonsOf(s) { return unitsOf(s).flatMap((u) => u.lessons); }
function rec(id) { return state.les[id] || { lvl: 0, n: 0, best: 0 }; }
function unlocked(l) {
  const ls = l.unit.lessons, i = ls.indexOf(l);
  return i === 0 || rec(ls[i - 1].id).lvl >= 1;
}
function mastery(s) {
  const ls = lessonsOf(s); if (!ls.length) return 0;
  return Math.round(ls.reduce((a, l) => a + rec(l.id).lvl, 0) / (ls.length * 3) * 100);
}

/* ---------- XP, streak, days ---------- */
function day(d) { d = d || D.today(); return state.days[d] || (state.days[d] = { xp: 0, n: 0, c: 0, subj: {} }); }
function addXP(n) { if (!n) return; state.xp += n; day().xp += n; if (sess) sess.xp += n; }
function activeOn(d) { const y = state.days[d]; return !!(y && (y.n > 0 || y.xp > 0)); }
function streak() { let d = D.today(), n = 0; if (!activeOn(d)) d = D.add(d, -1); while (activeOn(d)) { n++; d = D.add(d, -1); } return n; }

/* ---------- sound, speech, fx ---------- */
const Sound = {
  ctx: null,
  c() { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; this.ctx = new C(); } if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  play(notes, type, vol) {
    if (!state.settings.sound) return; const c = this.c(); if (!c) return;
    let t = c.currentTime + 0.01;
    for (const [f, dur, gap] of notes) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03); t += gap;
    }
  },
  correct() { this.play([[784, 0.14, 0.09], [1175, 0.24, 0]], 'sine', 0.2); },
  wrong() { this.play([[330, 0.16, 0.12], [262, 0.26, 0]], 'triangle', 0.14); },
  tap() { this.play([[660, 0.05, 0]], 'sine', 0.06); },
  win() { this.play([[523, 0.14, 0.11], [659, 0.14, 0.11], [784, 0.14, 0.11], [1047, 0.4, 0]], 'sine', 0.2); },
};
const Speak = {
  ok() { return 'speechSynthesis' in window; },
  voice() {
    const vs = speechSynthesis.getVoices();
    return vs.find((v) => v.lang === 'en-GB' && /female|libby|sonia|serena|kate|martha|google uk english female/i.test(v.name)) || vs.find((v) => v.lang === 'en-GB') || vs.find((v) => /^en/.test(v.lang));
  },
  clean(t) {
    return String(t).replace(/<[^>]+>/g, ' ').replace(/_{2,}/g, ' blank ').replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/−/g, ' minus ')
      .replace(/²/g, ' squared').replace(/³/g, ' cubed').replace(/°C/g, ' degrees C').replace(/°/g, ' degrees').replace(/√/g, ' square root of ')
      .replace(/\bbpm\b/g, 'beats per minute').replace(/[✅❌⭐💡🔊]/gu, '');
  },
  say(text) {
    if (!this.ok()) { toast('Read-aloud is not available on this device'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(this.clean(text)); u.lang = 'en-GB'; u.rate = state.settings.rate || 0.9;
    const v = this.voice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  },
  stop() { if (this.ok()) speechSynthesis.cancel(); },
};
if (Speak.ok()) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
function buzz(ms) { try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* no */ } }
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti(opts) {
  if (reduceMotion()) return; opts = opts || {};
  const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const cols = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#B46CFF', '#FF9600', '#00C49A', '#FF6AB4'];
  const n = opts.n || 90, ox = opts.x != null ? opts.x : W / 2, oy = opts.y != null ? opts.y : H * 0.4, sp = opts.spread || 15;
  const ps = Array.from({ length: n }, () => ({ x: ox, y: oy, vx: (Math.random() - 0.5) * sp, vy: -Math.random() * sp - 4, r: Math.random() * 6 + 5, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.35, sq: Math.random() < 0.6 }));
  let last = performance.now();
  (function frame(t) {
    const dt = Math.min(34, t - last) / 16.7; last = t; x.clearRect(0, 0, W, H); let alive = 0;
    for (const p of ps) {
      p.vy += 0.42 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y < H + 30) { alive++; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; if (p.sq) x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { x.beginPath(); x.arc(0, 0, p.r / 2.4, 0, 6.3); x.fill(); } x.restore(); }
    }
    if (alive) requestAnimationFrame(frame); else cv.remove();
  })(last);
}
function xpFloat(n, el) {
  const f = document.createElement('div'); f.className = 'xpfloat'; f.textContent = '+' + n + ' XP';
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 10) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1050);
}
function toast(msg) {
  $$('.toast').forEach((t) => t.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ---------- look & feel ---------- */
function applyLook() {
  const r = document.documentElement, st = state.settings;
  r.dataset.font = st.font; r.dataset.size = st.size; r.dataset.tint = st.tint;
  const m = $('meta[name="theme-color"]'); if (m) m.content = st.tint === 'dark' ? '#161E24' : '#FF6AB4';
}

/* ---------- words of encouragement ---------- */
const PRAISE = ['Nice one!', 'Yes! Spot on!', 'You got it!', 'Brilliant!', 'Nailed it!', 'Correct!', 'Great thinking!', 'Smashed it!'];
const NUDGE = ['Not quite — that is OK!', 'Nearly! Have a look:', 'Good try! Here is the answer:', 'Mistakes help you learn:'];
const CHEER = ['Every lesson makes your brain stronger 🌱', 'Small steps add up to big grades 🚀', 'You are doing better than you think 💪', 'One lesson at a time — you have got this ✨', 'Consistency beats cramming 🔥'];

/* ============================================================
   Picking what to do next
   ============================================================ */
function nextLessonIn(s) {
  const units = unitsOf(s); if (!units.length) return null;
  // first unfinished lesson in the earliest unit that has one
  for (const u of units) for (const l of u.lessons) if (unlocked(l) && rec(l.id).lvl < 1) return l;
  // otherwise, lowest level lesson
  let best = null;
  for (const l of lessonsOf(s)) if (unlocked(l) && rec(l.id).lvl < 3 && (!best || rec(l.id).lvl < rec(best.id).lvl)) best = l;
  return best || lessonsOf(s)[0];
}
function nextUp() {
  const t = day().subj;
  const cands = RC.subjects.filter((s) => lessonsOf(s).length);
  // maths counts half, so it comes up about twice as often (maths gets the most practice)
  const score = (s) => (t[s.id] || 0) * (s.id === 'maths' ? 0.5 : 1) + RC.subjects.indexOf(s) * 0.01;
  cands.sort((a, b) => score(a) - score(b));
  const s = cands[0]; return s ? nextLessonIn(s) : null;
}
function missCount() { return Object.keys(state.miss).filter((k) => state.miss[k] > 0 && (k.startsWith('g:') ? LESSON[k.split(':')[1]] : QBY[k])).length; }

/* ============================================================
   Views
   ============================================================ */
const ICON = { home: '🏠', practice: '🎯', progress: '📈', settings: '⚙️' };
function renderTop() {
  const s = streak(), d = day();
  $('#top').innerHTML = `<div class="top-in">
    <a class="logo" href="#/home"><i>C</i>Chloe's Revision</a>
    <span class="stat fire ${d.n ? '' : 'off'}" title="Day streak">🔥 ${s}</span>
    <span class="stat xp" id="xpstat" title="Total XP">⚡ ${state.xp}</span></div>`;
}
function renderNav(cur) {
  const items = [['home', 'Home'], ['practice', 'Practice'], ['progress', 'Progress'], ['settings', 'Settings']];
  $('#nav').innerHTML = '<div class="nav-in">' + items.map(([k, t]) => `<a href="#/${k}" ${cur === k ? 'aria-current="page"' : ''}><span>${ICON[k]}</span>${t}</a>`).join('') + '</div>';
}
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [page, arg] = h.split('/');
  renderTop();
  const v = $('#view');
  if (page === 'subject' && SUBJ[arg]) { renderNav('home'); v.innerHTML = viewSubject(SUBJ[arg]); }
  else if (page === 'practice') { renderNav('practice'); v.innerHTML = viewPractice(); }
  else if (page === 'progress') { renderNav('progress'); v.innerHTML = viewProgress(); }
  else if (page === 'settings') { renderNav('settings'); v.innerHTML = viewSettings(); }
  else { renderNav('home'); v.innerHTML = viewHome(); }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Evening'; }
function viewHome() {
  const d = day(), goal = state.settings.goal, p = Math.min(100, Math.round(d.n / goal * 100));
  const nx = nextUp(), ns = nx && SUBJ[nx.subj], m = missCount();
  const cheer = CHEER[new Date().getDate() % CHEER.length];
  let h = `<div class="hello"><div class="av">🌸</div><div><h1>${greeting()}, ${esc(state.name)}!</h1><p class="muted small">${cheer}</p></div></div>`;
  h += `<div class="sect"><div class="card row"><div class="goalring" style="--p:${p}"><i>${d.n}/${goal}</i></div><div class="grow"><b>Today's goal</b><p class="muted small">${d.n >= goal ? 'Goal done! Anything extra is a bonus 🎉' : `${goal - d.n} short lesson${goal - d.n > 1 ? 's' : ''} to go. About 3 minutes each.`}</p></div></div></div>`;
  if (nx) {
    const r = rec(nx.id), lvl = Math.min(3, r.lvl + 1);
    h += `<div class="sect"><div class="next s-${ns.id}"><span class="k">NEXT UP · ${esc(ns.name.toUpperCase())}</span><h2>${nx.emoji || ns.emoji} ${esc(nx.title)}</h2><p class="small">${esc(nx.unit.title)} · Level ${lvl} of 3 · about 3 min</p><button class="btn full" data-act="start" data-id="${nx.id}">Start lesson ▶</button></div></div>`;
  }
  if (!state.settings.lit) h += `<div class="sect"><button class="card row s-englit" data-act="books" style="text-align:left;cursor:pointer;border-color:var(--purple)"><span class="emo">📚</span><span class="grow"><b>Pick your English books</b><br><span class="muted small">Tell the app which books and poems your class studies.</span></span><span>›</span></button></div>`;
  if (m) h += `<div class="sect"><button class="btn full yellow" data-act="mistakes">🛠️ Fix my mistakes (${m})</button></div>`;
  h += `<div class="sect"><h2>My subjects</h2><div class="subs">` + RC.subjects.map((s) => {
    const pc = mastery(s);
    return `<a class="subcard s-${s.id}" href="#/subject/${s.id}"><span class="ic">${s.emoji}</span><span class="grow"><b>${esc(s.name)}</b><div class="bar" style="margin-top:8px"><i style="width:${Math.max(pc, 3)}%"></i></div><span class="muted tiny">${pc}% mastered</span></span></a>`;
  }).join('') + `</div></div>`;
  h += `<div class="sect"><h2>My exams</h2><div class="stack">` + RC.subjects.map((s) => `<div class="card s-${s.id}" style="padding:12px 14px"><div class="row"><span class="emo">${s.emoji}</span><div class="grow"><b>${esc(s.name)}</b><p class="muted small">${esc(s.board)}</p><p class="small">${esc(s.exam)}</p></div></div></div>`).join('') + `<p class="muted tiny">Exact 2027 exam dates come out from the exam boards — your teachers will tell you.</p></div></div>`;
  return h;
}

function stars(n) { return '⭐'.repeat(n) + '<span style="filter:grayscale(1);opacity:.3">' + '⭐'.repeat(3 - n) + '</span>'; }
function viewSubject(s) {
  let h = `<div class="shead s-${s.id}"><div class="row"><span style="font-size:34px">${s.emoji}</span><div class="grow"><h1>${esc(s.name)}</h1><p class="board">${esc(s.board)}</p></div></div><div class="bar" style="background:rgba(255,255,255,.35)"><i style="width:${Math.max(3, mastery(s))}%;background:#fff"></i></div><p class="small">${mastery(s)}% mastered · ${esc(s.exam)}</p></div>`;
  if (s.id === 'englit') {
    const lit = state.settings.lit || [];
    h += `<div class="sect"><div class="card row"><span class="emo">📚</span><div class="grow"><b>My books</b><p class="muted small">${lit.length ? lit.map((b) => esc((BOOKS.find((x) => x.id === b) || {}).name || b)).join(' · ') : 'Not picked yet'}</p></div><button class="btn sm" data-act="books">Change</button></div></div>`;
  }
  if (s.intro) h += `<div class="sect"><div class="tip"><span class="emo">💡</span><p class="small">${esc(s.intro)}</p></div></div>`;
  const units = unitsOf(s);
  let curShown = false;
  for (const u of units) {
    const tag = u.tag ? `<span class="pill ${u.tag}">${esc(u.tagText || '')}</span>` : '';
    h += `<div class="unit s-${s.id}"><div class="unit-h"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><b>${u.emoji || ''} ${esc(u.title)}</b>${tag}</div>${u.blurb ? `<p>${esc(u.blurb)}</p>` : ''}</div><div class="path">`;
    u.lessons.forEach((l, i) => {
      const r = rec(l.id), open = unlocked(l), off = [0, 44, 64, 44, 0, -44, -64, -44][i % 8];
      const cur = open && r.lvl < 1 && !curShown; if (cur) curShown = true;
      h += `<button class="node ${open ? '' : 'locked'} ${r.lvl >= 3 ? 'gold' : ''} ${cur ? 'cur' : ''}" style="transform:translateX(${off}px)" data-act="${open ? 'lesson' : 'locked'}" data-id="${l.id}">${cur ? '<span class="start">START</span>' : ''}<span class="dot">${open ? (r.lvl >= 3 ? '👑' : l.emoji || '⭐') : '🔒'}</span><span class="stars">${stars(r.lvl)}</span><span class="lbl">${esc(l.title)}</span></button>`;
    });
    h += `</div></div>`;
  }
  if (!units.length && s.id === 'englit') h += `<div class="sect"><button class="btn full pink" data-act="books">📚 Pick my books</button></div>`;
  return h;
}

function viewPractice() {
  const m = missCount();
  let h = `<div class="sect" style="margin-top:14px"><h1>Practice 🎯</h1><p class="muted">Quick rounds. No new stuff — just making it stick.</p></div>`;
  h += `<div class="sect"><button class="btn full yellow" data-act="mistakes" ${m ? '' : 'disabled'}>🛠️ Fix my mistakes${m ? ` (${m})` : ' — none yet!'}</button>
    <p class="muted small">Questions you got wrong come back here. Get each one right twice to clear it.</p></div>`;
  h += `<div class="sect"><h2>Quick 5 ⚡</h2><p class="muted small">5 questions from things you have already done.</p><div class="stack">` + RC.subjects.map((s) => {
    const done = lessonsOf(s).filter((l) => rec(l.id).lvl >= 1).length;
    return `<button class="btn full sub s-${s.id}" data-act="quick" data-id="${s.id}" ${done ? '' : 'disabled'}>${s.emoji} ${esc(s.name)}${done ? '' : ' — do a lesson first'}</button>`;
  }).join('') + `</div></div>`;
  h += `<div class="sect"><h2>Maths warm-ups 🔢</h2><p class="muted small">Fast facts make every maths question easier.</p><div class="stack">
    <button class="btn full blue" data-act="drill" data-id="tables">✖️ Times tables round</button>
    <button class="btn full blue" data-act="drill" data-id="bonds">➕ Number bonds & money round</button>
    <button class="btn full blue" data-act="drill" data-id="fdp">🍕 Fractions, decimals & % round</button></div></div>`;
  return h;
}

const BADGES = [
  ['first', '🌱', 'First lesson', () => state.tot.lessons >= 1],
  ['l10', '📗', '10 lessons', () => state.tot.lessons >= 10],
  ['l50', '📚', '50 lessons', () => state.tot.lessons >= 50],
  ['s3', '🔥', '3-day streak', () => streak() >= 3],
  ['s7', '🏆', '7-day streak', () => streak() >= 7],
  ['c100', '💯', '100 right answers', () => state.tot.correct >= 100],
  ['fix10', '🛠️', 'Fixed 10 mistakes', () => state.tot.fixed >= 10],
  ['crown', '👑', 'First crown', () => Object.values(state.les).some((r) => r.lvl >= 3)],
  ['all', '🌈', 'Tried every subject', () => RC.subjects.every((s) => lessonsOf(s).some((l) => rec(l.id).n > 0))],
  ['mathsfan', '🔢', '10 maths lessons', () => SUBJ.maths.units.flatMap((u) => u.lessons).reduce((a, l) => a + rec(l.id).n, 0) >= 10],
  ['xp500', '⚡', '500 XP', () => state.xp >= 500],
  ['perfect', '🎯', 'Perfect lesson', () => !!state.badges.perfect],
];
function checkBadges() {
  const got = [];
  for (const [id, e, name, test] of BADGES) if (id !== 'perfect' && !state.badges[id] && test()) { state.badges[id] = D.today(); got.push(e + ' ' + name); }
  return got;
}
function viewProgress() {
  const tot = state.tot;
  let h = `<div class="sect" style="margin-top:14px"><h1>My progress 📈</h1></div>`;
  h += `<div class="sect"><div class="stats3"><div class="st"><b>🔥 ${streak()}</b><small>day streak</small></div><div class="st"><b>${tot.lessons}</b><small>lessons done</small></div><div class="st"><b>${tot.correct}</b><small>right answers</small></div></div></div>`;
  h += `<div class="sect"><h2>Subjects</h2><div class="stack">` + RC.subjects.map((s) => {
    const ls = lessonsOf(s), started = ls.filter((l) => rec(l.id).lvl >= 1).length;
    return `<a class="card s-${s.id}" href="#/subject/${s.id}" style="text-decoration:none;color:inherit"><div class="row"><span class="emo">${s.emoji}</span><b class="grow">${esc(s.name)}</b><b>${mastery(s)}%</b></div><div class="bar" style="margin-top:10px"><i style="width:${Math.max(2, mastery(s))}%"></i></div><p class="muted tiny" style="margin-top:6px">${started} of ${ls.length} lessons started</p></a>`;
  }).join('') + `</div></div>`;
  // last 5 weeks, Monday first
  const t = D.today(), [y, mo, dd] = t.split('-').map(Number), wd = (new Date(y, mo - 1, dd).getDay() + 6) % 7;
  let start = D.add(t, -wd - 28), cal = '';
  for (let i = 0; i < 35; i++) { const k = D.add(start, i); const on = activeOn(k); cal += `<i class="${on ? 'on' : ''} ${k === t ? 'today' : ''}" title="${k}">${k > t ? '' : Number(k.slice(8))}</i>`; }
  h += `<div class="sect"><h2>Days I revised</h2><div class="card"><div class="cal" style="margin-bottom:6px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<i style="background:none">${x}</i>`).join('')}</div><div class="cal">${cal}</div></div></div>`;
  // strong / needs work
  const all = RC.subjects.flatMap((s) => lessonsOf(s));
  const strong = all.filter((l) => rec(l.id).lvl >= 3).slice(0, 8);
  const weakScore = {};
  for (const k in state.miss) { if (!(state.miss[k] > 0)) continue; const lid = k.startsWith('g:') ? k.split(':')[1] : (QBY[k] || {}).lesson; if (lid && LESSON[lid]) weakScore[lid] = (weakScore[lid] || 0) + state.miss[k]; }
  const weak = Object.keys(weakScore).sort((a, b) => weakScore[b] - weakScore[a]).slice(0, 6).map((id) => LESSON[id]);
  h += `<div class="sect"><h2>Needs more practice 🛠️</h2>${weak.length ? `<div class="toplist">${weak.map((l) => `<button class="it" data-act="lesson" data-id="${l.id}" style="cursor:pointer;text-align:left"><span>${SUBJ[l.subj].emoji}</span><span class="grow">${esc(l.title)}</span><span class="muted small">Practise ›</span></button>`).join('')}</div>` : '<p class="muted small">Nothing yet — do some lessons and this will fill in.</p>'}</div>`;
  h += `<div class="sect"><h2>I'm strong at 💪</h2>${strong.length ? `<div class="toplist">${strong.map((l) => `<div class="it"><span>👑</span><span class="grow">${esc(l.title)}</span><span class="muted small">${esc(SUBJ[l.subj].name)}</span></div>`).join('')}</div>` : '<p class="muted small">Get all 3 stars on a lesson to earn a crown 👑</p>'}</div>`;
  h += `<div class="sect"><h2>Badges</h2><div class="badges">` + BADGES.map(([id, e, name]) => `<div class="badge ${state.badges[id] ? '' : 'off'}"><span class="e">${e}</span><b>${esc(name)}</b></div>`).join('') + `</div></div>`;
  return h;
}

function seg(key, opts) { return `<div class="seg">` + opts.map(([v, t, style]) => `<button data-act="set" data-k="${key}" data-v="${v}" aria-pressed="${String(state.settings[key]) === String(v)}" ${style ? `class="swatch" style="${style}" title="${t}" aria-label="${t}"` : ''}>${style ? '' : t}</button>`).join('') + `</div>`; }
function viewSettings() {
  const st = state.settings;
  let h = `<div class="sect" style="margin-top:14px"><h1>Settings ⚙️</h1><p class="muted small">Make it comfy to read. Signed in as <b>${esc(state.name)}</b> — your progress saves on this device automatically.</p></div>`;
  h += `<div class="sect setrow"><h3>Letters</h3>${seg('font', [['lexend', 'Lexend'], ['atkinson', 'Atkinson'], ['nunito', 'Nunito']])}</div>`;
  h += `<div class="sect setrow"><h3>Text size</h3>${seg('size', [[1, 'Small'], [2, 'Medium'], [3, 'Big'], [4, 'Huge']])}</div>`;
  h += `<div class="sect setrow"><h3>Background colour</h3><p class="muted small">Some people find a tinted page easier to read.</p>${seg('tint', [['cream', 'Cream', 'background:#FFF8EC'], ['white', 'White', 'background:#fff'], ['blue', 'Blue', 'background:#EEF6FF'], ['green', 'Green', 'background:#F0F8EC'], ['pink', 'Pink', 'background:#FFF1F6'], ['dark', 'Dark', 'background:#161E24']])}</div>`;
  h += `<div class="sect setrow"><h3>Daily goal</h3>${seg('goal', [[1, '1 lesson'], [2, '2 lessons'], [3, '3 lessons'], [5, '5 lessons']])}</div>`;
  h += `<div class="sect stack">
    <label class="switch"><span><b>🔊 Read questions out loud</b><br><span class="muted small">Reads each question to you automatically.</span></span><input type="checkbox" data-act="tog" data-k="speak" ${st.speak ? 'checked' : ''}></label>
    <label class="switch"><span><b>🎵 Sounds</b></span><input type="checkbox" data-act="tog" data-k="sound" ${st.sound ? 'checked' : ''}></label>
    <label class="switch"><span><b>🧃 Brain-break reminders</b><br><span class="muted small">A nudge to stretch after a couple of lessons.</span></span><input type="checkbox" data-act="tog" data-k="breaks" ${st.breaks ? 'checked' : ''}></label></div>`;
  h += `<div class="sect setrow"><h3>Reading voice speed</h3>${seg('rate', [[0.75, 'Slow'], [0.9, 'Normal'], [1.05, 'Fast']])}<button class="btn sm" data-act="testvoice" style="align-self:flex-start">🔊 Test the voice</button></div>`;
  h += `<div class="sect setrow"><h3>English books</h3><button class="btn" data-act="books">📚 Choose my books and poems</button></div>`;
  h += `<div class="sect setrow"><h3>Back up my progress</h3><p class="muted small">Progress lives on this phone/laptop. Copy this code somewhere safe (or send it to yourself) — paste it back to restore, or to move to another device.</p>
    <div class="row"><button class="btn sm blue" data-act="backup">📋 Copy backup code</button><button class="btn sm" data-act="download">💾 Save file</button></div>
    <textarea class="code" id="restorebox" placeholder="Paste a backup code here to restore…"></textarea>
    <button class="btn sm" data-act="restore" style="align-self:flex-start">♻️ Restore from code</button></div>`;
  h += `<div class="sect setrow"><h3>Start again</h3><button class="btn sm red" data-act="reset" style="align-self:flex-start">Reset all progress</button></div>`;
  h += `<div class="sect"><p class="muted tiny">Content checked against Comberton Village College's course pages and the official AQA, Pearson BTEC and WJEC specifications (Sept 2026). If a teacher says something different, trust your teacher!</p></div>`;
  return h;
}

/* ---------- bottom sheet ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = html; $('#sheet').hidden = false; $('#sheetbg').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetbg').hidden = true; Speak.stop(); }
$('#sheetbg').addEventListener('click', closeSheet);

function lessonSheet(l) {
  const s = SUBJ[l.subj], r = rec(l.id), lvl = Math.min(3, r.lvl + 1);
  const tips = (l.tip || []).map((t) => `<div class="tip"><span class="emo">💡</span><p>${esc(t)}</p></div>`).join('');
  const lvlName = ['', 'Level 1 · The basics', 'Level 2 · Getting there', 'Level 3 · Stretch yourself'];
  openSheet(`<div class="row s-${s.id}"><span style="font-size:40px">${l.emoji || s.emoji}</span><div class="grow"><h2>${esc(l.title)}</h2><p class="muted small">${esc(s.name)} · ${esc(l.unit.title)}</p></div><button class="iconbtn" data-act="say-tips" aria-label="Read tips out loud">🔊</button></div>
    <div class="row s-${s.id}"><span class="lvl">${r.lvl >= 3 ? '👑 Mastered — practice mode' : lvlName[lvl]}</span><span class="stars">${stars(r.lvl)}</span></div>
    ${tips ? `<div class="tiplist" id="tiplist">${tips}</div>` : ''}
    <button class="btn full green" data-act="go" data-id="${l.id}" data-lvl="${lvl}">${r.n ? 'Practise' : 'Start'} ▶</button>
    ${lvl > 1 && r.lvl < 3 ? `<button class="btn full ghost" data-act="go" data-id="${l.id}" data-lvl="${lvl - 1}">Try an easier round</button>` : ''}
    <button class="btn full ghost" data-act="close">Not now</button>`);
}

function booksSheet() {
  const lit = new Set(state.settings.lit || []);
  const groups = [['shakes', 'Shakespeare play (pick 1)'], ['novel', '19th-century novel (pick 1)'], ['modern', 'Modern play or novel (pick 1)'], ['poetry', 'Poetry cluster (pick 1)']];
  let h = `<h2>📚 My English books</h2><p class="muted small">Tap the ones your class studies. Not sure? Ask your English teacher — you can change this any time.</p>`;
  for (const [g, t] of groups) {
    h += `<h3>${t}</h3><div class="books">` + BOOKS.filter((b) => b.group === g).map((b) => `<button class="book" data-act="book" data-id="${b.id}" aria-pressed="${lit.has(b.id)}"><span class="e">${b.emoji}</span><span class="grow"><b>${esc(b.name)}</b><br><span class="muted small">${esc(b.by)}</span></span><span class="tick">✓</span></button>`).join('') + `</div>`;
  }
  h += `<p class="muted tiny">Only the most common AQA choices are here. If your class does a different one, the skills lessons still help.</p><button class="btn full pink" data-act="books-done">Done</button>`;
  openSheet(h);
}

/* ============================================================
   Lessons
   ============================================================ */
let sess = null;
let runCount = 0; // lessons finished since the app opened (for brain breaks)

function makeQ(l, level) {
  if (l.gen) { const g = pickOne(l.gen); const q = g(level); q.lesson = l.id; q.lvl = level; q.gkey = 'g:' + l.id + ':' + level; return q; }
  return null;
}
function buildLesson(l, level) {
  const N = l.n || 6, out = [];
  if (l.gen) {
    for (let i = 0; i < N; i++) {
      const lv = i === 0 ? Math.max(1, level - 1) : i === N - 1 ? Math.min(3, level + 1) : level;
      const q = makeQ(l, lv); if (i === N - 1 && lv > level) q.stretch = true; out.push(q);
    }
    return out;
  }
  // questions at or below this level (borrow from one level up if a lesson is short on easy ones)
  let pool = l.qs.filter((q) => (q.d || 1) <= level);
  if (pool.length < 5) pool = l.qs.filter((q) => (q.d || 1) <= level + 1);
  const missed = shuffle(pool.filter((q) => state.miss[q.id] > 0)).slice(0, 2);
  const atLvl = shuffle(pool.filter((q) => (q.d || 1) === level && !missed.includes(q)));
  const rest = shuffle(pool.filter((q) => !missed.includes(q) && !atLvl.includes(q)));
  const chosen = missed.concat(atLvl.slice(0, 3));
  for (const q of rest.concat(atLvl.slice(3))) { if (chosen.length >= N - 1) break; chosen.push(q); }
  // finish with one stretch question from the next level up (or fill up if there isn't one)
  const up = level < 3 ? shuffle(l.qs.filter((q) => (q.d || 1) === level + 1 && !chosen.includes(q))) : [];
  if (up.length) chosen.push(Object.assign({}, up[0], { stretch: true }));
  else for (const q of rest.concat(atLvl)) { if (chosen.length >= N) break; if (!chosen.includes(q)) chosen.push(q); }
  // easy first, stretch last
  return chosen.sort((a, b) => (a.stretch ? 9 : a.d || 1) - (b.stretch ? 9 : b.d || 1));
}
function startSession(opts) {
  sess = Object.assign({ i: 0, xp: 0, score: 0, results: [], again: 0, sel: null, checked: false, hint: false }, opts);
  sess.total = sess.qs.length;
  $('#session').hidden = false; document.body.style.overflow = 'hidden';
  closeSheet();
  renderQ();
}
function startLesson(id, lvl) {
  const l = LESSON[id]; if (!l) return;
  const level = Math.max(1, Math.min(3, lvl || Math.min(3, rec(id).lvl + 1)));
  startSession({ mode: 'lesson', lesson: l, subj: SUBJ[l.subj], level, qs: buildLesson(l, level) });
}
function startMistakes() {
  const keys = shuffle(Object.keys(state.miss).filter((k) => state.miss[k] > 0));
  const qs = [];
  for (const k of keys) {
    if (qs.length >= 6) break;
    if (k.startsWith('g:')) { const [, lid, lv] = k.split(':'); if (LESSON[lid]) { const q = makeQ(LESSON[lid], +lv); q.fix = k; qs.push(q); } }
    else if (QBY[k]) qs.push(QBY[k]);
  }
  if (!qs.length) { toast('No mistakes to fix — nice!'); return; }
  startSession({ mode: 'mistakes', qs, subj: null });
}
function startQuick(sid) {
  const s = SUBJ[sid], done = lessonsOf(s).filter((l) => rec(l.id).lvl >= 1);
  const qs = [];
  for (let i = 0; i < 5; i++) {
    const l = pickOne(done), lv = Math.max(1, rec(l.id).lvl);
    if (l.gen) qs.push(makeQ(l, lv));
    else { const pool = l.qs.filter((q) => (q.d || 1) <= lv && !qs.includes(q)); if (pool.length) qs.push(pickOne(pool)); }
  }
  startSession({ mode: 'quick', qs, subj: s });
}
function startDrill(kind) {
  const qs = []; for (let i = 0; i < 8; i++) qs.push(RC.drills[kind](i < 3 ? 1 : i < 6 ? 2 : 3));
  startSession({ mode: 'drill', qs, subj: SUBJ.maths, drill: kind });
}
function endSession(quit) {
  Speak.stop(); $('#session').hidden = true; document.body.style.overflow = ''; sess = null; if (quit) route();
}

function qText(q) {
  let t = q.q; if (q.ex) t = q.ex + '. ' + t;
  if (q.t === 'mc') t += '. ' + q._opts.map((o, i) => 'Option ' + 'ABCD'[i] + ': ' + o).join('. ');
  if (q.t === 'tf') t += '. True or false?';
  return t;
}
function prepQ(q) {
  if (q._ready) return;
  if (q.t === 'mc') q._opts = shuffle([q.a].concat(q.w.slice(0, q.max || 3)));
  if (q.t === 'match') { q._left = shuffle(q.pairs.map((p) => p[0])); q._right = shuffle(q.pairs.map((p) => p[1])); q._done = []; q._err = 0; }
  if (q.t === 'order') { q._bank = shuffle(q.items); while (q.items.length > 1 && q._bank.join('|') === q.items.join('|')) q._bank = shuffle(q.items); q._seq = []; }
  q._ready = true;
}
function renderQ() {
  const q = sess.qs[sess.i]; if (!q) return finish();
  prepQ(q); sess.sel = null; sess.checked = false; sess.hint = false; sess.matchPick = null;
  const s = sess.subj || SUBJ[(LESSON[q.lesson] || {}).subj] || SUBJ.maths;
  const done = sess.i, all = sess.qs.length;
  let body = '';
  const tag = `<div class="qtag s-${s.id}"><span>${s.emoji} ${esc(sess.mode === 'lesson' ? sess.lesson.title : sess.mode === 'mistakes' ? 'Fix my mistakes' : sess.mode === 'drill' ? 'Warm-up' : 'Quick 5')}</span>${q.stretch ? '<span class="stretch">⭐ Stretch question</span>' : ''}${q._again ? '<span class="again">🔁 Try again</span>' : ''}</div>`;
  const prompt = q.t === 'match' ? (q.q || 'Match the pairs') : q.t === 'order' ? q.q : q.q;
  body += tag + (q.ex ? `<div class="extract">${esc(q.ex)}</div>` : '') + `<div class="q"><h2>${esc(prompt)}</h2><button class="iconbtn" data-act="say" aria-label="Read out loud">🔊</button></div>`;
  if (q.t === 'mc') body += `<div class="opts">` + q._opts.map((o, i) => `<button class="opt" data-act="pick" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('') + `</div>`;
  else if (q.t === 'tf') body += `<div class="tfrow"><button class="opt" data-act="pick" data-i="1"><span>👍</span>True</button><button class="opt" data-act="pick" data-i="0"><span>👎</span>False</button></div>`;
  else if (q.t === 'num') body += `<div class="numin">${q.pre ? `<span class="unit">${esc(q.pre)}</span>` : ''}<input id="numbox" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="?" aria-label="Your answer">${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}</div>`;
  else if (q.t === 'match') body += `<p class="muted small">Tap one on the left, then its partner on the right.</p><div class="match"><div class="opts">` + q._left.map((x, i) => `<button class="opt" data-act="ml" data-i="${i}">${esc(x)}</button>`).join('') + `</div><div class="opts">` + q._right.map((x, i) => `<button class="opt" data-act="mr" data-i="${i}">${esc(x)}</button>`).join('') + `</div></div>`;
  else if (q.t === 'order') body += `<p class="muted small">Tap them in the right order. Tap again to undo.</p><div class="order-slots" id="slots"></div><div class="order-bank" id="bank"></div>`;
  const canHint = (q.t === 'mc' && q._opts.length >= 3) || q.hint;
  body += `<div class="helpers">${canHint ? '<button class="btn sm" data-act="hint">💡 Help me</button>' : ''}</div><div id="hintbox"></div>`;
  $('#session').innerHTML = `<div class="sess-top"><button class="x" data-act="quit" aria-label="Stop lesson">✕</button><div class="prog"><i style="width:${Math.round(done / all * 100)}%"></i></div></div>
    <div class="sess-body s-${s.id}">${body}</div>
    <div class="foot" id="foot"><div class="foot-in"><button class="btn full green" id="checkbtn" data-act="check" ${q.t === 'match' ? 'hidden' : 'disabled'}>Check</button></div></div>`;
  if (q.t === 'order') drawOrder(q);
  if (q.t === 'num') { const b = $('#numbox'); b.addEventListener('input', () => { $('#checkbtn').disabled = !b.value.trim(); }); b.addEventListener('keydown', (e) => { if (e.key === 'Enter' && b.value.trim()) check(); }); setTimeout(() => b.focus(), 60); }
  $('#session').scrollTop = 0;
  if (state.settings.speak) setTimeout(() => Speak.say(qText(q)), 250);
}
function drawOrder(q) {
  $('#slots').innerHTML = q._seq.map((x, i) => `<button class="opt" data-act="ounpick" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(x)}</span></button>`).join('') || '<p class="muted small" style="margin:auto">Your order goes here</p>';
  $('#bank').innerHTML = q._bank.map((x, i) => `<button class="opt" data-act="opick" data-i="${i}"><span class="k">•</span><span>${esc(x)}</span></button>`).join('');
  $('#checkbtn').disabled = q._bank.length > 0;
}
function norm(s) { return String(s).toLowerCase().replace(/[−–]/g, '-').replace(/^[a-z]\s*=/, '').replace(/[£$%,\s]|cm|kg|km|m²|cm²|°|mm|ml|g$|m$|p$/g, '').replace(/^\+/, ''); }
function numOk(q, v) {
  const n = parseFloat(norm(v)); if (isNaN(n)) return false;
  const a = Number(q.a); return Math.abs(n - a) <= (q.tol != null ? q.tol : 1e-9) + 1e-9;
}
function check() {
  const q = sess.qs[sess.i]; if (sess.checked) return;
  let ok = false, ans = '';
  if (q.t === 'mc') { if (sess.sel == null) return; ok = q._opts[sess.sel] === q.a; ans = q.a; }
  else if (q.t === 'tf') { if (sess.sel == null) return; ok = (sess.sel === 1) === q.a; ans = q.a ? 'True' : 'False'; }
  else if (q.t === 'num') { const v = $('#numbox').value; if (!v.trim()) return; ok = numOk(q, v); ans = (q.pre || '') + q.a + (q.unit ? ' ' + q.unit : ''); $('#numbox').disabled = true; }
  else if (q.t === 'order') { ok = q._seq.join('|') === q.items.join('|'); ans = q.items.map((x, i) => (i + 1) + '. ' + x).join('\n'); }
  else if (q.t === 'match') { ok = q._err === 0; ans = q.pairs.map((p) => p[0] + ' → ' + p[1]).join('\n'); }
  sess.checked = true;
  if (q.t === 'mc' || q.t === 'tf') $$('.opt[data-act="pick"]').forEach((b) => { b.disabled = true; const i = +b.dataset.i; const right = q.t === 'mc' ? q._opts[i] === q.a : (i === 1) === q.a; if (right) b.classList.add('ok'); else if (i === sess.sel) b.classList.add('bad'); });
  record(q, ok);
  $$('[data-act="hint"]').forEach((x) => { x.disabled = true; });
  const foot = $('#foot'); foot.className = 'foot ' + (ok ? 'good' : 'bad');
  // wrong: always spell out the right answer (the green option can be easy to miss)
  const ansLine = ok ? '' : q.t === 'tf' ? `<p class="fb-why"><b>It's ${esc(ans)}.</b></p>` : `<p class="fb-why"><b>Answer:</b> ${esc(ans)}</p>`;
  const why = q.why ? `<p class="fb-why">${esc(q.why)}</p>` : '';
  foot.innerHTML = `<div class="foot-in"><div class="fb-h"><span>${ok ? '✅' : '💛'}</span><span class="grow">${ok ? pickOne(PRAISE) : pickOne(NUDGE)}</span>${q.why || !ok ? '<button class="iconbtn" data-act="say-fb" aria-label="Read explanation">🔊</button>' : ''}</div>${ansLine}${why}<button class="btn full go" data-act="next">Continue</button></div>`;
  foot._say = (ok ? '' : 'The answer is ' + ans + '. ') + (q.why || '');
  if (ok) { Sound.correct(); buzz(12); confetti({ n: 30, spread: 10, y: innerHeight - 160 }); }
  else { Sound.wrong(); buzz([20, 40, 20]); $('.sess-body').classList.add('shake'); }
}
function record(q, ok) {
  const again = !!q._again;
  if (!again) { sess.results.push(ok); if (ok) sess.score++; }
  const key = q.gkey ? (q.fix || q.gkey) : q.id;
  if (ok) {
    const gain = again ? 1 : 2; addXP(gain); xpFloat(gain, $('#checkbtn') || $('.fb-h'));
    state.tot.correct++; day().c++;
    if (key && state.miss[key] > 0) { state.miss[key]--; if (state.miss[key] <= 0) { delete state.miss[key]; state.tot.fixed++; } }
  } else {
    if (key && !again) state.miss[key] = 2;
    // Duolingo-style: missed questions come back once at the end of the round
    if (!again && sess.mode !== 'drill') { const c = q.gkey ? makeQ(LESSON[q.lesson], q.lvl) : Object.assign({}, q); if (q.gkey && q.fix) c.fix = q.fix; c._again = true; c._ready = false; if (!q.gkey) { c.id = q.id; } sess.qs.push(c); }
  }
  save();
}
function finish() {
  const total = sess.results.length, sc = sess.score, pct = total ? sc / total : 0;
  let lvlUp = false, newLvl = 0, title = '', starsN = pct >= 0.99 ? 3 : pct >= 0.66 ? 2 : pct > 0 ? 1 : 0;
  const d = day();
  if (sess.mode === 'lesson') {
    const l = sess.lesson, r = state.les[l.id] || (state.les[l.id] = { lvl: 0, n: 0, best: 0 });
    r.n++; r.best = Math.max(r.best, Math.round(pct * 100)); r.last = D.today();
    if (pct >= 0.66 && sess.level > r.lvl) { r.lvl = sess.level; lvlUp = true; }
    newLvl = r.lvl;
    title = lvlUp ? (r.lvl >= 3 ? 'Crown earned! 👑' : `Level ${r.lvl} done!`) : pct >= 0.66 ? 'Lesson done!' : 'Good effort!';
  } else title = sess.mode === 'mistakes' ? 'Mistakes fixed!' : 'Round done!';
  const bonus = 5 + (pct >= 0.99 && total >= 4 ? 5 : 0); addXP(bonus);
  if (pct >= 0.99 && total >= 4) state.badges.perfect = state.badges.perfect || D.today();
  d.n++; state.tot.lessons++;
  const sid = sess.subj ? sess.subj.id : 'mix'; d.subj[sid] = (d.subj[sid] || 0) + 1;
  runCount++;
  const newBadges = checkBadges(); save();
  const goalHit = d.n === state.settings.goal;
  const msg = pct >= 0.99 ? 'Perfect! Every single one right 🎯' : pct >= 0.66 ? 'Really good work. Your brain is levelling up.' : pct >= 0.34 ? 'Getting there! Practice makes it stick — try it again soon.' : 'That was a tricky one. Try the easier round — no shame in building up slowly 💛';
  const brk = state.settings.breaks && runCount % 2 === 0;
  const nx = sess.mode === 'lesson' ? nextUp() : null;
  $('#session').innerHTML = `<div class="sess-body"><div class="done-card">
      <div class="big">${pct >= 0.66 ? '🎉' : '💪'}</div><h1>${title}</h1>
      <div class="bigstars">${'⭐'.repeat(starsN)}<span class="off">${'⭐'.repeat(3 - starsN)}</span></div>
      <p class="muted">${msg}</p>
      <div class="done-stats"><div class="st"><b>${sc}/${total}</b><small>right first time</small></div><div class="st"><b>+${sess.xp}</b><small>XP</small></div><div class="st"><b>🔥 ${streak()}</b><small>day streak</small></div></div>
      ${lvlUp && newLvl < 3 ? `<div class="tip" style="width:100%"><span class="emo">🔓</span><p class="small">Next time this lesson goes up to <b>Level ${newLvl + 1}</b> — a little bit harder.</p></div>` : ''}
      ${goalHit ? '<div class="tip" style="width:100%;background:var(--green-t)"><span class="emo">🎯</span><p class="small"><b>Daily goal done!</b> Brilliant.</p></div>' : ''}
      ${newBadges.map((b) => `<div class="tip" style="width:100%;background:var(--purple-t)"><span class="emo">🏅</span><p class="small">New badge: <b>${esc(b)}</b></p></div>`).join('')}
      ${brk ? '<div class="tip" style="width:100%;background:var(--blue-t)"><span class="emo">🧃</span><p class="small"><b>Brain break!</b> Stand up, stretch, grab a drink. 2 minutes, then come back fresh.</p></div>' : ''}
    </div></div>
    <div class="foot"><div class="foot-in">
      ${sess.mode === 'lesson' && pct < 0.34 && sess.level > 1 ? `<button class="btn full yellow" data-act="go" data-id="${sess.lesson.id}" data-lvl="${sess.level - 1}">Try the easier round</button>` : ''}
      ${nx ? `<button class="btn full green" data-act="go" data-id="${nx.id}">Next: ${esc(nx.title)} ▶</button>` : ''}
      <button class="btn full" data-act="home">Back to home</button></div></div>`;
  Sound.win(); buzz([30, 50, 30]); confetti({ n: pct >= 0.66 ? 160 : 60, spread: 18, y: innerHeight * 0.3 });
  sess.done = true;
}

/* ============================================================
   Clicks
   ============================================================ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (b.tagName === 'INPUT') return;
  switch (act) {
    case 'start': startLesson(id); break;
    case 'lesson': lessonSheet(LESSON[id]); break;
    case 'locked': toast('🔒 Finish the lesson before this one to unlock it'); break;
    case 'go': if (sess) endSession(); startLesson(id, b.dataset.lvl ? +b.dataset.lvl : 0); break;
    case 'close': closeSheet(); break;
    case 'say-tips': { const l = LESSON[$('[data-act="go"]', $('#sheet')).dataset.id]; Speak.say(l.title + '. ' + (l.tip || []).join('. ')); break; }
    case 'mistakes': startMistakes(); break;
    case 'quick': startQuick(id); break;
    case 'drill': startDrill(id); break;
    case 'books': booksSheet(); break;
    case 'book': {
      const lit = new Set(state.settings.lit || []), bk = BOOKS.find((x) => x.id === id);
      if (lit.has(id)) lit.delete(id); else { for (const o of BOOKS) if (o.group === bk.group && o.id !== id) lit.delete(o.id); lit.add(id); }
      state.settings.lit = [...lit]; save(); booksSheet(); break;
    }
    case 'books-done': if (!state.settings.lit) state.settings.lit = []; save(); closeSheet(); route(); break;
    case 'set': { let v = b.dataset.v; if (/^[\d.]+$/.test(v)) v = +v; state.settings[b.dataset.k] = v; save(); applyLook(); route(); break; }
    case 'testvoice': Speak.say(`Hi ${state.name}! This is how I will read your questions.`); break;
    case 'backup': {
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Backup code copied ✅')).catch(() => { $('#restorebox').value = code; $('#restorebox').select(); toast('Copy the code from the box'); });
      break;
    }
    case 'download': {
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'chloe-revision-backup-' + D.today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); break;
    }
    case 'restore': {
      const raw = $('#restorebox').value.trim(); if (!raw) { toast('Paste a code first'); break; }
      try { let s; try { s = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch (x) { s = JSON.parse(raw); } if (!s || !s.v) throw 0; state = merge(DEFAULTS, s); save(); applyLook(); toast('Progress restored ✅'); route(); } catch (x) { toast('That code did not work — check you copied all of it'); }
      break;
    }
    case 'reset': if (confirm('Reset ALL progress? This cannot be undone.') && confirm('Really sure? Maybe copy a backup code first.')) { const st = state.settings; state = merge(DEFAULTS, {}); state.created = D.today(); state.settings = st; save(); route(); toast('Fresh start!'); } break;
    // lesson controls
    case 'quit': if (sess.done || sess.i === 0 && !sess.results.length || confirm('Stop this lesson? Answers so far are still saved.')) endSession(true); break;
    case 'home': endSession(); location.hash = '#/home'; route(); break;
    case 'say': Speak.say(qText(sess.qs[sess.i])); break;
    case 'say-fb': Speak.say($('#foot')._say || ''); break;
    case 'pick': if (sess.checked) break; sess.sel = +b.dataset.i; $$('.opt[data-act="pick"]').forEach((x) => x.classList.toggle('sel', x === b)); $('#checkbtn').disabled = false; Sound.tap(); break;
    case 'hint': {
      const q = sess.qs[sess.i]; if (sess.hint || sess.checked) break; sess.hint = true; b.disabled = true;
      if (q.t === 'mc') { const wrong = $$('.opt[data-act="pick"]').filter((x) => q._opts[+x.dataset.i] !== q.a && !x.classList.contains('sel')); if (wrong.length) pickOne(wrong).classList.add('gone'); }
      if (q.hint) $('#hintbox').innerHTML = `<div class="tip"><span class="emo">💡</span><p class="small">${esc(q.hint)}</p></div>`;
      break;
    }
    case 'check': check(); break;
    case 'next': sess.i++; renderQ(); break;
    case 'ml': case 'mr': matchTap(b, act); break;
    case 'opick': { const q = sess.qs[sess.i]; if (sess.checked) break; q._seq.push(q._bank.splice(+b.dataset.i, 1)[0]); Sound.tap(); drawOrder(q); break; }
    case 'ounpick': { const q = sess.qs[sess.i]; if (sess.checked) break; q._bank.push(q._seq.splice(+b.dataset.i, 1)[0]); drawOrder(q); break; }
  }
  if (act === 'set' || act === 'book') e.preventDefault();
});
document.addEventListener('change', (e) => {
  const b = e.target.closest('[data-act="tog"]'); if (!b) return;
  state.settings[b.dataset.k] = b.checked; save();
});
function matchTap(b, side) {
  const q = sess.qs[sess.i]; if (sess.checked) return;
  if (side === 'ml') { $$('.opt[data-act="ml"]').forEach((x) => x.classList.toggle('sel', x === b)); sess.matchPick = b; Sound.tap(); return; }
  const L = sess.matchPick; if (!L) { toast('Pick one on the left first'); return; }
  const left = q._left[+L.dataset.i], right = q._right[+b.dataset.i];
  const good = q.pairs.some((p) => p[0] === left && p[1] === right);
  if (good) {
    L.classList.remove('sel'); L.classList.add('done'); b.classList.add('done'); q._done.push(left); sess.matchPick = null; Sound.correct();
    if (q._done.length === q.pairs.length) { const cb = $('#checkbtn'); cb.hidden = false; check(); }
  } else {
    q._err++; b.classList.add('bad'); L.classList.add('bad'); Sound.wrong(); buzz(30);
    setTimeout(() => { b.classList.remove('bad'); L.classList.remove('bad', 'sel'); sess.matchPick = null; }, 450);
  }
}
document.addEventListener('keydown', (e) => {
  if (!sess || $('#session').hidden) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const q = sess.qs[sess.i];
  if (e.key === 'Enter') { if (sess.done) return; if (sess.checked) { $('[data-act="next"]').click(); } else if (!$('#checkbtn').disabled) check(); e.preventDefault(); }
  else if (q && !sess.checked && (q.t === 'mc') && /^[1-4]$/.test(e.key)) { const o = $$('.opt[data-act="pick"]')[+e.key - 1]; if (o) o.click(); }
});

/* ---------- go ---------- */
applyLook();
route();
