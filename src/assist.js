/* ============================================================
   CHLOE'S ASSISTANT — works with no internet.
   1. Maths solver (solver.js): exact answers with steps.
   2. Lesson search: finds the checked facts from this app's lessons.
   3. Offline brain: a small AI model (Qwen3.5 via WebLLM, WebGPU) that
      explains things, using 1 + 2 so it sticks to correct facts.
   4. Photo reader: PaddleOCR (PP-OCRv6) reads the text in a photo, after she crops it.
   The model is downloaded once (on Wi-Fi) and cached on the device.
   ============================================================ */
const ASK_KEY = 'chloe-assist-v1';
let chat = [];
try { chat = JSON.parse(localStorage.getItem(ASK_KEY)) || []; } catch (e) { chat = []; }
const saveChat = () => { try { localStorage.setItem(ASK_KEY, JSON.stringify(chat.slice(-30).map((m) => Object.assign({}, m, { img: undefined })))); } catch (e) { /* full */ } };
let pendingPhoto = null; // { url, text }

/* ---------- lesson search (BM25 over every question, answer, explanation and tip) ---------- */
const STOP = new Set('a an the is are was were be been of to in on at for and or but if then so it its this that these those what which who whom how why when where do does did can could should would will i me my you your we our they them their he she his her with as by from about into than too very just also not no yes please explain tell help mean means meaning give example examples work out find some any more most name names list all main key thing things like know need about using use'.split(' '));
const stem = (w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '').replace(/e$/, '') : w);
const toks = (t) => String(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9%]+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)).map(stem);
let IDX = null;
function buildIndex() {
  const docs = [];
  for (const s of RC.subjects) for (const u of s.units) {
    (u.facts || []).forEach((t) => docs.push({ s, l: u.lessons[0], u: u.id, head: `${s.name} · ${u.title} (key facts)`, text: t, kind: 'fact' }));
    for (const l of u.lessons) {
    const head = `${s.name} · ${l.title}`;
    (l.tip || []).forEach((t) => docs.push({ s, l, u: u.id, head, text: t, kind: 'tip' }));
    (l.qs || []).forEach((q) => {
      const ans = q.t === 'tf' ? (q.a ? 'True' : 'False') : q.t === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join('; ') : q.t === 'order' ? q.items.join(' → ') : q.a;
      docs.push({ s, l, u: u.id, head, q, text: `${q.ex ? q.ex + ' ' : ''}${q.q} → ${ans}. ${q.why || ''}`, kind: 'q' });
    });
    }
  }
  docs.forEach((d) => { if (!d.u) d.u = d.l.unit.id; });
  for (const d of docs) { d.tk = toks(d.text + ' ' + d.l.title); d.len = d.tk.length; }
  const df = {}; docs.forEach((d) => new Set(d.tk).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  IDX = { docs, df, avg: docs.reduce((a, d) => a + d.len, 0) / docs.length, N: docs.length };
}
// if a question names a book, character, poem or subject, only search there
const SCOPES = [
  [/christmas carol|scrooge|cratchit|marley|tiny tim|fezziwig|ghost of christmas/, 'u', 'lACC', /christmas|carol/g],
  [/macbeth|banquo|duncan|macduff|birnam/, 'u', 'lMac', null],
  [/romeo|juliet|tybalt|mercutio|capulet|montague|friar laurence/, 'u', 'lRJ', null],
  [/jekyll|hyde|utterson|lanyon/, 'u', 'lJH', null],
  [/inspector calls|goole|birling|eva smith|gerald|sheila/, 'u', 'lAIC', /inspector calls|an inspector/g],
  [/ozymandias|prelude|last duchess|light brigade|storm on the island|bayonet charge|poppies|war photographer|emigr[eé]e|checking out me history|kamikaze|power and conflict/, 'u', 'lPC', /power and conflict/g],
  [/hospitality|catering/, 's', 'hosp', /hospitality|and|catering/g],
  [/health and social care|health & social care|\bhsc\b|btec/, 's', 'hsc', /health and social care|health & social care|\bhsc\b|btec/g],
];
function searchNotes(query, k) {
  if (!IDX) buildIndex();
  let q = String(query).toLowerCase(), scope = null;
  for (const [re, kind, id, strip] of SCOPES) if (re.test(q)) { scope = [kind, id]; if (strip) { const q2 = q.replace(strip, ' '); if (toks(q2).length) q = q2; } break; }
  const qt = [...new Set(toks(q))]; if (!qt.length) return [];
  const scored = [];
  for (const d of IDX.docs) {
    if (scope && (scope[0] === 'u' ? d.u !== scope[1] : d.s.id !== scope[1])) continue;
    let sc = 0;
    for (const w of qt) {
      const f = d.tk.filter((x) => x === w).length; if (!f) continue;
      const idf = Math.log(1 + (IDX.N - IDX.df[w] + 0.5) / (IDX.df[w] + 0.5));
      sc += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / IDX.avg));
    }
    if (d.kind === 'fact') sc *= 1.3;
    if (sc > 0) scored.push({ d, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  const best = scored[0] ? scored[0].sc : 0, out = [], per = {};
  for (const x of scored) {
    if (x.sc < Math.max(2.2, best * 0.45) || out.length >= (k || 4)) break;
    if ((per[x.d.l.id] = (per[x.d.l.id] || 0) + 1) > 2) continue;
    out.push(x.d);
  }
  return out;
}

/* ---------- exact course definitions ---------- */
function findDef(text) {
  const t = ' ' + String(text).toLowerCase().replace(/[’']/g, "'").replace(/-/g, ' ') + ' ';
  let best = null;
  for (const g of RC.glossary || []) {
    const term = g[0].replace(/ /g, '\\s+');
    const re = new RegExp(`(what(?:'s| is| are| does| do)|whats|define|definition of|meaning of|explain|tell me about)\\s+(?:a |an |the |my )?${term}(?:s|es)?\\b|\\b${term}(?:s|es)?\\b[^?.]*\\b(mean|means|stand for|stands for)\\b`);
    if (re.test(t) && (!best || g[0].length > best[0].length)) best = g;
  }
  return best && { term: best[0], subj: best[1], text: best[2] };
}

/* ---------- offline brain (WebLLM) ----------
   Phones only let one GPU memory block be 128–256 MB. Models that need more
   either crash or (worse) talk gibberish, so the model is chosen from the
   device's real WebGPU limits, and every wake-up runs a quick sense check. */
const AI_MODELS = {
  std: { name: 'Laptop brain', f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC', size: '1.1 GB', note: 'The cleverest. Needs a laptop or PC.', big: true, qwen3: true },
  phone: { name: 'Phone brain', f16: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', size: '0.9 GB', note: 'Made to fit phones and tablets.' },
  tiny: { name: 'Mini brain', f16: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', size: '0.7 GB', note: 'Only if the Phone brain runs out of memory. Less accurate.' },
};
const AI_ORDER = ['std', 'phone', 'tiny'];
const AI = { status: 'off', progress: 0, text: '', engine: null, gpu: undefined, busy: false, err: '', errDetail: '', lib: null, starting: null, worker: null };
async function gpuInfo() {
  if (AI.gpu !== undefined) return AI.gpu;
  try {
    if (!navigator.gpu) return (AI.gpu = null);
    const a = await navigator.gpu.requestAdapter(); if (!a) return (AI.gpu = null);
    const L = a.limits;
    AI.gpu = { f16: a.features.has('shader-f16'), bind: L.maxStorageBufferBindingSize, buf: L.maxBufferSize, big: L.maxStorageBufferBindingSize >= (1 << 30) && L.maxBufferSize >= (1 << 30), info: a.info ? [a.info.vendor, a.info.architecture, a.info.device].filter(Boolean).join(' ') : '' };
  } catch (e) { AI.gpu = null; }
  return AI.gpu;
}
function modelId(key) { const m = AI_MODELS[key] || AI_MODELS.phone; return AI.gpu && AI.gpu.f16 ? m.f16 : m.f32; }
const fits = (key) => !!AI_MODELS[key] && (!AI_MODELS[key].big || !!(AI.gpu && AI.gpu.big));
async function aiLib() { if (!AI.lib) AI.lib = await import('./ai/webllm.js'); return AI.lib; }
function recommendModel() { return AI.gpu && AI.gpu.big ? 'std' : 'phone'; }
function diag(e) {
  const g = AI.gpu || {};
  return [`Error: ${String(e && (e.stack || e.message) || e).slice(0, 600)}`, `Model: ${state.settings.aiModel} (${modelId(state.settings.aiModel)})`,
    `GPU: ${g.info || '?'} · f16 ${g.f16} · bind ${Math.round((g.bind || 0) / 1048576)}MB · buffer ${Math.round((g.buf || 0) / 1048576)}MB`,
    `Memory: ${navigator.deviceMemory || '?'}GB · Online: ${navigator.onLine}`, `Browser: ${navigator.userAgent}`, `Time: ${new Date().toISOString()}`].join('\n');
}
async function aiRefresh() {
  const g = await gpuInfo();
  if (!g) { AI.status = 'nogpu'; return; }
  if (AI.engine) { AI.status = 'ready'; return; }
  if (AI.starting || AI.status === 'error') return;
  let key = state.settings.aiModel;
  if (key === 'lite') { key = 'tiny'; state.settings.aiModel = 'tiny'; save(); } // older setting name
  if (!key) { AI.status = 'off'; return; }
  if (!fits(key)) { AI.status = 'wrongmodel'; return; }
  try { const lib = await aiLib(); AI.status = (await lib.hasModelInCache(modelId(key))) ? 'cached' : 'off'; } catch (e) { AI.status = 'off'; }
}
// only one start at a time: tapping "wake up" while it was already waking used to start a second copy
function aiStart(key) { if (AI.starting) return AI.starting; AI.starting = aiStartInner(key).finally(() => { AI.starting = null; drawBrain(); }); return AI.starting; }
async function makeEngine(lib, id) {
  const cfg = { initProgressCallback: (r) => { AI.progress = r.progress || 0; AI.text = r.text || ''; drawBrain(); } };
  try {
    AI.worker = new Worker(new URL('./ai/worker.js', location.href), { type: 'module' });
    return await lib.CreateWebWorkerMLCEngine(AI.worker, id, cfg);
  } catch (e) {
    try { if (AI.worker) AI.worker.terminate(); } catch (x) { /* ignore */ }
    AI.worker = null;
    const m = String(e && e.message || e);
    // some phone browsers don't allow WebGPU inside a background worker, so run it on the page instead
    if (/webgpu|gpu|worker|not.?available|not.?supported/i.test(m) && !/lost|memory|OOM/i.test(m)) return await lib.CreateMLCEngine(id, cfg);
    throw e;
  }
}
async function senseCheck(eng, key) {
  const req = { messages: [{ role: 'user', content: 'Reply with just the word: yes' }], max_tokens: 6, temperature: 0 };
  if (AI_MODELS[key].qwen3) req.extra_body = { enable_thinking: false };
  const r = await eng.chat.completions.create(req);
  const t = String(r.choices[0].message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try { await eng.resetChat(); } catch (e) { /* ignore */ }
  return /\byes\b/i.test(t);
}
async function aiStartInner(key) {
  const g = await gpuInfo(); if (!g) { AI.status = 'nogpu'; return; }
  if (!fits(key)) key = recommendModel();
  if (AI.engine && state.settings.aiModel === key) { AI.status = 'ready'; return; }
  if (AI.engine) { try { await AI.engine.unload(); } catch (e) { /* ignore */ } AI.engine = null; }
  state.settings.aiModel = key; save();
  let cached = false; const lib = await aiLib();
  try { cached = await lib.hasModelInCache(modelId(key)); } catch (e) { /* ignore */ }
  if (!cached && !navigator.onLine) { AI.status = 'off'; AI.err = 'You need Wi-Fi for the one-time download. Try again at home!'; return; }
  AI.status = cached ? 'loading' : 'downloading'; AI.progress = 0; AI.err = ''; AI.errDetail = ''; drawBrain();
  let eng = null;
  try {
    eng = await makeEngine(lib, modelId(key));
    AI.status = 'checking'; drawBrain();
    if (!(await senseCheck(eng, key))) throw new Error('SENSE_CHECK: the model loaded but answered with nonsense on this device');
    AI.engine = eng; AI.status = 'ready'; state.settings.aiReady = true; state.settings.aiMemFails = 0; save();
    if (!cached) { toast('🧠 Offline brain downloaded! It now works with no internet.'); Sound.win(); }
  } catch (e) {
    try { if (eng) await eng.unload(); } catch (x) { /* ignore */ }
    try { if (AI.worker) AI.worker.terminate(); } catch (x) { /* ignore */ }
    AI.worker = null; AI.engine = null; AI.status = 'error'; AI.errDetail = diag(e);
    const msg = String(e && e.message || e), next = AI_ORDER[AI_ORDER.indexOf(key) + 1];
    const definite = /SENSE_CHECK|binding|limit|exceed/i.test(msg); // this model can never work on this device
    const memory = /memory|device.?lost|allocate|OOM|buffer/i.test(msg); // might just be other apps using memory
    if (memory && !definite) state.settings.aiMemFails = (state.settings.aiMemFails || 0) + 1;
    const tooBig = definite || (memory && state.settings.aiMemFails >= 2);
    if (memory && !tooBig) AI.err = 'My brain ran short of memory this time. Close some other apps, then tap "Try again".';
    else if (tooBig && next) {
      state.settings.aiMemFails = 0;
      AI.err = `The ${AI_MODELS[key].name} is too big for this device. ` + (navigator.onLine ? `Switching to the ${AI_MODELS[next].name}…` : `Next time you're on Wi-Fi, open Ask and I'll switch to the ${AI_MODELS[next].name}.`);
      state.settings.aiModel = next; save();
      if (navigator.onLine) { try { await lib.deleteModelAllInfoInCache(modelId(key)); } catch (x) { /* frees the space */ } setTimeout(() => aiStart(next), 50); }
    } else if (tooBig) AI.err = 'This device ran out of memory, even for the smallest brain. The maths solver, photo reader and lesson search still work!';
    else if (/fetch|network|Failed to|load failed/i.test(msg)) AI.err = 'The download stopped (internet dropped?). Tap "Try again" — it carries on where it left off.';
    else AI.err = 'Something went wrong starting my brain. Tap "Try again", or copy the details below and send them to Max.';
  }
}
// if the brain dies mid-chat (e.g. the phone put the app to sleep), wake it again once and retry
async function aiRecover() {
  try { if (AI.engine) await AI.engine.unload(); } catch (e) { /* ignore */ }
  try { if (AI.worker) AI.worker.terminate(); } catch (e) { /* ignore */ }
  AI.engine = null; AI.worker = null; AI.status = 'cached';
  await aiStart(state.settings.aiModel);
  return AI.status === 'ready';
}
async function aiDelete() {
  if (!state.settings.aiModel) return;
  try { if (AI.engine) await AI.engine.unload(); } catch (e) { /* ignore */ }
  AI.engine = null;
  try { const lib = await aiLib(); for (const k of AI_ORDER) await lib.deleteModelAllInfoInCache(modelId(k)).catch(() => {}); } catch (e) { /* ignore */ }
  state.settings.aiModel = null; state.settings.aiReady = false; save(); AI.status = 'off'; drawBrain(); toast('Offline brain removed');
}

const SYSTEM = `You are "Chloe's Assistant", a kind tutor inside Chloe's GCSE revision app. Chloe is in Year 11 in England. Her courses: AQA GCSE Maths 8300 (Foundation tier), AQA GCSE English Language 8700, AQA GCSE English Literature 8702, Pearson BTEC Tech Award in Health and Social Care, and WJEC Level 1/2 Award in Hospitality and Catering.
Rules:
1. Answer the question in your first sentence.
2. Then explain in 2 to 4 short, simple sentences, or a few short bullet points. Stop as soon as the question is answered. Never repeat yourself.
3. For maths, show the working as short numbered steps.
4. NOTES and a WORKED ANSWER may be given. They are correct, so use them. Use exactly the numbers in a WORKED ANSWER. Ignore any note that is not about the question.
5. If you are not sure, say so and suggest she asks her teacher. Never make up facts, quotes, dates or laws.
6. For questions about a book, play or poem: only use facts that are in the NOTES. Do not name any character, event or quote that is not in the NOTES. If the notes don't cover it, say you're not sure and suggest checking with her teacher.
7. Use simple everyday words and British spelling. Be warm and encouraging.`;
function buildMessages(userText, notes, sol, def) {
  let sys = SYSTEM;
  // the exact definition is already on screen, so the AI only adds an example + a memory tip (it can't reword it wrongly)
  if (def) sys += `\n\nChloe asked what "${def.term}" means. This DEFINITION from her course is already shown to her above your reply:\n${def.text}\nDo NOT repeat, reword or add to the definition. Reply with only: one new, simple example that fits it, then one short tip to help her remember it.`;
  if (notes.length) sys += '\n\nNOTES FROM CHLOE\'S COURSE (these are correct):\n' + notes.map((n) => `- ${n.head}: ${n.text.slice(0, 260)}`).join('\n');
  if (sol) sys += `\n\nWORKED ANSWER to her question (checked by a calculator, so use exactly these numbers):\n${sol.title}\n${sol.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\nAnswer: ${sol.answer}\nExplain these steps simply.`;
  const msgs = [{ role: 'system', content: sys }];
  const hist = chat.filter((m) => (m.role === 'user' || m.role === 'ai') && m.text && !m.typing).slice(-5, -1);
  for (const m of hist) msgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.text).slice(0, 400) });
  msgs.push({ role: 'user', content: userText });
  return msgs;
}

/* ---------- photo reader: PaddleOCR (PP-OCRv6) running offline with ONNX Runtime ----------
   Much better than Tesseract on real phone photos (tilt, shadows, blur), and it also picks up
   diagram labels and table numbers. Chloe first crops/rotates so only the question is read. */
let PPO = null;
async function ppLoad() {
  if (PPO) return PPO;
  const ort = await import('./ocr/ort.wasm.min.mjs');
  ort.env.wasm.wasmPaths = new URL('./ocr/', location.href).href;
  ort.env.wasm.numThreads = 1; // GitHub Pages can't enable multi-threading
  const eocr = await import('./ocr/esearch-ocr.js');
  const dic = await (await fetch('ocr/pp/dict.txt')).text();
  PPO = await eocr.init({ det: { input: 'ocr/pp/det.onnx' }, rec: { input: 'ocr/pp/rec.onnx', decodeDic: dic }, ort,
    analyzeLayout: { docDirs: [{ block: 'tb', inline: 'lr' }] } }); // English: normal left-to-right, top-to-bottom reading only
  return PPO;
}
// put the words back into lines (and table rows) using where they sit on the page — works on tilted photos too
function layoutText(src) {
  if (!src || !src.length) return '';
  const angs = src.map((s) => Math.atan2(s.box[1][1] - s.box[0][1], s.box[1][0] - s.box[0][0])).sort((a, b) => a - b);
  const a = angs[angs.length >> 1], ca = Math.cos(-a), sa = Math.sin(-a);
  const items = src.filter((s) => s.text && s.text.trim()).map((s) => {
    const cx = s.box.reduce((t, p) => t + p[0], 0) / 4, cy = s.box.reduce((t, p) => t + p[1], 0) / 4;
    const w = Math.hypot(s.box[1][0] - s.box[0][0], s.box[1][1] - s.box[0][1]), h = Math.hypot(s.box[3][0] - s.box[0][0], s.box[3][1] - s.box[0][1]);
    return { t: s.text.trim(), x: cx * ca - cy * sa - w / 2, y: cx * sa + cy * ca, h };
  });
  if (!items.length) return '';
  const hMed = items.map((i) => i.h).sort((p, q) => p - q)[items.length >> 1];
  items.sort((p, q) => p.y - q.y);
  const lines = [];
  for (const it of items) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(it.y - L.y) < hMed * 0.55) { L.items.push(it); L.y = (L.y * (L.items.length - 1) + it.y) / L.items.length; } else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((L) => L.items.sort((p, q) => p.x - q.x).map((i) => i.t).join('   ')).join('\n');
}
async function readPhoto(canvas) {
  const ocr = await ppLoad();
  const r = await ocr.ocr(canvas);
  const src = r.src || [];
  const conf = src.length ? Math.round(src.reduce((t, s) => t + (s.mean || 0), 0) / src.length * 100) : 0;
  return { text: layoutText(src).trim(), conf };
}

/* ---------- crop + rotate screen ---------- */
const CROP = { base: null, rect: null, drag: null };
async function fileToCanvas(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv;
}
function rotateCanvas(cv) {
  const r = document.createElement('canvas'); r.width = cv.height; r.height = cv.width;
  const g = r.getContext('2d'); g.translate(r.width, 0); g.rotate(Math.PI / 2); g.drawImage(cv, 0, 0); return r;
}
function openCrop(cv) {
  CROP.base = cv; CROP.rect = { x: 0.03, y: 0.03, w: 0.94, h: 0.94 };
  let el = $('#crop');
  if (!el) { el = document.createElement('div'); el.id = 'crop'; el.className = 'crop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Crop your photo'); document.body.appendChild(el); }
  el.hidden = false;
  el.innerHTML = `<div class="crop-top"><button class="x" data-act="crop-cancel" aria-label="Cancel">✕</button><div class="grow"><b>✂️ Drag the box around the question</b><p class="tiny muted">Just the question you're stuck on — it reads it much better.</p></div></div>
    <div class="crop-stage" id="cropstage"><div class="crop-wrap"><img id="cropimg" alt="Your photo"><div class="crop-box" id="cropbox"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
    <div class="crop-foot"><button class="btn" data-act="crop-rotate">↻ Rotate</button><button class="btn" data-act="crop-all">Whole photo</button><button class="btn pink grow" data-act="crop-read">Read this ›</button></div>`;
  drawCrop();
  const stage = $('#cropstage');
  stage.addEventListener('pointerdown', cropDown); stage.addEventListener('pointermove', cropMove);
  stage.addEventListener('pointerup', () => { CROP.drag = null; }); stage.addEventListener('pointercancel', () => { CROP.drag = null; });
}
function drawCrop() {
  const img = $('#cropimg'), box = $('#cropbox'); if (!img) return;
  if (img.dataset.src !== String(CROP.base.width) + 'x' + CROP.base.height) { img.src = CROP.base.toDataURL('image/jpeg', 0.85); img.dataset.src = CROP.base.width + 'x' + CROP.base.height; }
  const r = CROP.rect;
  box.style.left = r.x * 100 + '%'; box.style.top = r.y * 100 + '%'; box.style.width = r.w * 100 + '%'; box.style.height = r.h * 100 + '%';
}
function cropPt(e) { const b = $('#cropimg').getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; }
function cropDown(e) {
  const p = cropPt(e), r = CROP.rect, h = e.target.dataset && e.target.dataset.h;
  const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (h) CROP.drag = { h, p, r: Object.assign({}, r) };
  else if (inside) CROP.drag = { h: 'move', p, r: Object.assign({}, r) };
  else { CROP.rect = { x: p.x, y: p.y, w: 0.001, h: 0.001 }; CROP.drag = { h: 'se', p, r: Object.assign({}, CROP.rect) }; } // drag out a new box
  e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); e.preventDefault();
}
function cropMove(e) {
  const d = CROP.drag; if (!d) return;
  const p = cropPt(e), dx = p.x - d.p.x, dy = p.y - d.p.y, o = d.r, MIN = 0.06, cl = (v) => Math.max(0, Math.min(1, v));
  let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
  if (d.h === 'move') { const w = o.w, h = o.h; x1 = Math.max(0, Math.min(1 - w, o.x + dx)); y1 = Math.max(0, Math.min(1 - h, o.y + dy)); x2 = x1 + w; y2 = y1 + h; }
  else { if (d.h.includes('w')) x1 = cl(o.x + dx); if (d.h.includes('e')) x2 = cl(o.x + o.w + dx); if (d.h.includes('n')) y1 = cl(o.y + dy); if (d.h.includes('s')) y2 = cl(o.y + o.h + dy); }
  if (x2 - x1 < MIN) { if (d.h.includes('w')) x1 = x2 - MIN; else x2 = x1 + MIN; }
  if (y2 - y1 < MIN) { if (d.h.includes('n')) y1 = y2 - MIN; else y2 = y1 + MIN; }
  CROP.rect = { x: cl(x1), y: cl(y1), w: cl(x2) - cl(x1), h: cl(y2) - cl(y1) }; drawCrop(); e.preventDefault();
}
function croppedCanvas() {
  const b = CROP.base, r = CROP.rect, sx = Math.round(r.x * b.width), sy = Math.round(r.y * b.height), sw = Math.max(8, Math.round(r.w * b.width)), sh = Math.max(8, Math.round(r.h * b.height));
  // small crops get enlarged, huge ones shrunk
  const scale = Math.max(sw, sh) < 1000 ? Math.min(3, 1000 / Math.max(sw, sh)) : Math.min(1, 1800 / Math.max(sw, sh));
  const cv = document.createElement('canvas'); cv.width = Math.round(sw * scale); cv.height = Math.round(sh * scale);
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(b, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv;
}
function closeCrop() { const el = $('#crop'); if (el) el.hidden = true; }
async function readCropped(whole) {
  if (whole) CROP.rect = { x: 0, y: 0, w: 1, h: 1 };
  const cv = croppedCanvas(); closeCrop();
  const thumb = document.createElement('canvas'), tk = Math.min(1, 480 / Math.max(cv.width, cv.height)); thumb.width = cv.width * tk; thumb.height = cv.height * tk; thumb.getContext('2d').drawImage(cv, 0, 0, thumb.width, thumb.height);
  chat.push({ role: 'user', text: '📷 (photo)', img: thumb.toDataURL('image/jpeg', 0.75) });
  const i = chat.length; chat.push({ role: 'ai', text: '📷 Reading your photo…' + (PPO ? '' : ' (the first time takes a few seconds)'), typing: true }); drawChat();
  try {
    const r = await readPhoto(cv);
    chat.splice(i, 1);
    if (!r.text) chat.push({ role: 'ai', text: 'I couldn\'t find any words in that photo. Try again closer up, with the question filling the box — or type it in.' });
    else chat.push({ role: 'ocr', text: r.text, conf: r.conf });
  } catch (err) { chat[i] = { role: 'ai', text: 'Sorry — I couldn\'t read that photo. (' + String(err && err.message || err).slice(0, 80) + ')' }; }
  saveChat(); drawChat();
}
async function onPhoto(e) {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try { openCrop(await fileToCanvas(f)); } catch (err) { chat.push({ role: 'ai', text: 'Sorry — I couldn\'t open that photo. Try taking it again.' }); drawChat(); }
  ppLoad().catch(() => {}); // warm up the reader while she crops
}

/* ---------- UI ---------- */
function mdLite(t) {
  const lines = esc(t).split('\n'); let html = '', list = null;
  for (let ln of lines) {
    ln = ln.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1<i>$2</i>').replace(/^#{1,4}\s*/, '');
    const b = ln.match(/^\s*[-•*]\s+(.*)/), n = ln.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (b || n) { const tag = b ? 'ul' : 'ol'; if (list !== tag) { if (list) html += `</${list}>`; html += `<${tag}>`; list = tag; } html += `<li>${(b || n)[b ? 1 : 2]}</li>`; }
    else { if (list) { html += `</${list}>`; list = null; } if (ln.trim()) html += `<p>${ln}</p>`; }
  }
  if (list) html += `</${list}>`;
  return html;
}
function brainPill() {
  const st = AI.status;
  const m = { nogpu: ['⚪', 'Brain not supported here'], off: ['⚪', 'Brain off'], cached: ['🟡', 'Brain asleep — tap to wake'], wrongmodel: ['🟠', 'Brain needs a quick switch'], downloading: ['⬇️', `Downloading ${Math.round(AI.progress * 100)}%`], loading: ['🟡', `Waking up ${Math.round(AI.progress * 100)}%`], checking: ['🟡', 'Nearly ready…'], ready: ['🟢', `${(AI_MODELS[state.settings.aiModel] || {}).name || 'Brain'} ready`], error: ['🔴', 'Brain problem — tap'] }[st] || ['⚪', 'Brain off'];
  return `<button class="brainpill" data-act="brain">${m[0]} ${m[1]}</button>`;
}
function brainCard() {
  const st = AI.status, rec = recommendModel(), cur = state.settings.aiModel;
  if (st === 'ready') return '';
  if (st === 'nogpu') return `<div class="tip" style="background:var(--blue-t)"><span class="emo">💡</span><p class="small">This device can't run the AI brain (it needs <b>WebGPU</b>: on iPhone that means iOS 26 or newer). I can still <b>solve maths step by step</b>, <b>read photos</b> and <b>search your lessons</b> — all with no internet.</p></div>`;
  if (st === 'downloading' || st === 'loading' || st === 'checking') return `<div class="card stack"><b>${st === 'downloading' ? `⬇️ Downloading the ${AI_MODELS[cur].name}…` : st === 'checking' ? '🧠 Nearly ready — checking it works…' : '🧠 Waking up my brain…'}</b><div class="bar"><i style="width:${Math.max(2, Math.round((st === 'checking' ? 1 : AI.progress) * 100))}%;background:var(--pink)"></i></div><p class="muted tiny">${st === 'downloading' ? 'Keep this screen open. This only happens once — after this it works at school with no Wi-Fi.' : 'This takes a few seconds each time the app opens.'}</p></div>`;
  if (st === 'cached') return `<button class="btn full pink" data-act="ai-start" data-id="${cur}">🧠 Wake up my brain</button>`;
  if (st === 'wrongmodel') return `<div class="card stack"><b>🧠 Your brain needs a quick switch</b><p class="small">The ${esc(AI_MODELS[cur].name)} you downloaded is too big for this device's graphics chip — that's what caused the error. The <b>${AI_MODELS[rec].name}</b> (${AI_MODELS[rec].size}) is made to fit.</p><p class="small"><b>Do this at home on Wi-Fi</b> (one-time download).</p><button class="btn full pink" data-act="ai-switch" data-id="${rec}">Switch to the ${AI_MODELS[rec].name}</button></div>`;
  if (st === 'error') return `<div class="card stack"><b>🧠 My brain had a problem</b><p class="small" style="color:var(--red-d)">${esc(AI.err)}</p>
    ${AI.starting ? '' : `<button class="btn full pink" data-act="ai-start" data-id="${cur || rec}">🔄 Try again</button>`}
    ${AI.errDetail ? `<details class="notes"><summary>Details for Max</summary><pre class="diag">${esc(AI.errDetail)}</pre><button class="btn sm" data-act="copy-diag">📋 Copy details</button></details>` : ''}</div>`;
  if (!AI.open && !AI.err) return `<button class="chip brainbar" data-act="brain-open">🧠 <b>Turn on my offline brain</b> — so I can explain anything ›</button>`;
  const opts = AI_ORDER.filter((k) => fits(k) && (k !== 'tiny' || !AI.gpu.big));
  return `<div class="card stack"><div class="row"><b class="grow">🧠 Switch on my offline brain</b><button class="chip" data-act="brain-close">Hide</button></div><p class="small">Right now I can solve maths, read photos and search your lessons. Turn on the brain so I can <b>explain anything</b> in my own words — even with no internet.</p>
    <p class="small"><b>One-time download — do it at home on Wi-Fi.</b> Then it works at school offline.</p>
    ${AI.err ? `<p class="small" style="color:var(--red-d)">${esc(AI.err)}</p>` : ''}
    ${opts.map((k) => `<button class="btn full ${k === rec ? 'pink' : ''}" data-act="ai-start" data-id="${k}">${AI_MODELS[k].name} · ${AI_MODELS[k].size}${k === rec ? ' ⭐ best for this device' : ''}</button><p class="muted tiny" style="margin-top:-6px">${AI_MODELS[k].note}</p>`).join('')}
  </div>`;
}
function drawBrain() {
  const p = $('#brainpill'); if (p) p.innerHTML = brainPill();
  const c = $('#braincard'); if (c) c.innerHTML = brainCard();
  if ($('#aistatus') && typeof fillOfflineStatus === 'function') fillOfflineStatus();
}
const STARTERS = ['What is 15% of £80?', 'What is a metaphor?', 'Solve 3x + 5 = 20', 'What does SMART stand for?', 'What temperature should a fridge be?', 'Who is Inspector Goole?'];
function msgHTML(m, i) {
  if (m.role === 'user') return `<div class="msg me">${m.img ? `<img src="${m.img}" alt="Your photo">` : ''}${m.photo ? `<p class="tiny muted">📷 Question from my photo</p>` : ''}<p>${esc(m.text)}</p></div>`;
  if (m.role === 'def') return `<div class="msg defn"><div class="solh" style="color:var(--blue-d)">📘 From your course</div><p>${esc(m.def.text)}</p></div>`;
  if (m.role === 'sol') return `<div class="msg sol"><div class="solh">✅ ${m.sol.subj === 'hsc' ? 'Checked answer <span class="tiny">(against your course)' : 'Worked answer <span class="tiny">(checked by the calculator)'}</span></div><b>${esc(m.sol.title)}</b><ol>${m.sol.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><div class="solans">Answer: ${esc(m.sol.answer)}</div>${m.sol.tip ? `<p class="tiny muted">💡 ${esc(m.sol.tip)}</p>` : ''}</div>`;
  if (m.role === 'ocr') return `<div class="msg bot"><p class="small"><b>📷 I read this from your photo.</b> Fix anything I got wrong, then ask your question:</p><textarea class="ocrbox" id="ocr${i}" rows="4">${esc(m.text)}</textarea><p class="tiny muted">${m.conf < 80 ? 'Some of it was hard to read, so check it carefully. ' : ''}Numbers and labels from diagrams or tables are included, but I can\'t see the shapes themselves, so add anything missing (e.g. "it\'s a right-angled triangle").</p><div class="wrap-row"><button class="btn sm pink" data-act="ocr-ask" data-i="${i}" data-q="How do I answer this question?">How do I answer this?</button><button class="btn sm" data-act="ocr-ask" data-i="${i}" data-q="Explain what this means in simple words.">Explain it simply</button></div></div>`;
  const links = (m.lessons || []).map((id) => LESSON[id] ? `<button class="chip" data-act="lesson-from-ask" data-id="${id}">${SUBJ[LESSON[id].subj].emoji} Practise: ${esc(LESSON[id].title)}</button>` : '').join('');
  return `<div class="msg bot">${m.html || mdLite(m.text || '')}${m.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : ''}${m.notes && m.notes.length && !m.typing ? `<details class="notes"><summary>📘 Checked facts from your lessons</summary><ul>${m.notes.map((n) => `<li><b>${esc(n.head)}:</b> ${esc(n.text)}</li>`).join('')}</ul></details>` : ''}${links ? `<div class="wrap-row" style="margin-top:8px">${links}</div>` : ''}${!m.typing && m.text ? `<div class="msgtools"><button class="iconbtn sm" data-act="say-msg" data-i="${i}" aria-label="Read out loud">🔊</button>${m.ai ? '<span class="tiny muted">AI can make mistakes — check with your teacher if unsure.</span>' : ''}</div>` : ''}</div>`;
}
function drawChat(scroll) {
  const box = $('#chat'); if (!box) return;
  if (!chat.length) box.innerHTML = `<div class="msg bot"><p><b>Hi ${esc(state.name)}! 👋 I'm your assistant.</b></p><p>Stuck on something? Ask me anything about Maths, English, Health & Social Care or Hospitality — or tap 📷 to snap a question.</p><p class="small muted">I work with no internet 📴</p></div><div class="wrap-row">${STARTERS.map((s) => `<button class="chip" data-act="ask-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  else box.innerHTML = chat.map(msgHTML).join('') + (AI.busy ? '' : `<div class="wrap-row">${['Explain it more simply', 'Give me an example', 'Test me on this'].map((s) => `<button class="chip" data-act="ask-chip" data-q="${s}">${s}</button>`).join('')}<button class="chip" data-act="ask-clear">🧹 New chat</button></div>`);
  if (scroll !== false) box.scrollTop = box.scrollHeight;
}
function openAssist(prefill, autoSend) {
  let el = $('#ask');
  if (!el) { el = document.createElement('div'); el.id = 'ask'; el.className = 'ask'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', "Chloe's Assistant"); document.body.appendChild(el); }
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.innerHTML = `<div class="ask-top"><button class="x" data-act="ask-close" aria-label="Close">✕</button><div class="grow"><b>🤖 Chloe's Assistant</b><div id="brainpill">${brainPill()}</div></div></div>
    <div class="ask-body" id="chat"></div>
    <div id="braincard" class="ask-brain">${brainCard()}</div>
    <div class="ask-foot"><label class="iconbtn" aria-label="Add a photo" title="Add a photo">📷<input type="file" accept="image/*" id="photoin" hidden></label>
      <textarea id="askbox" rows="1" placeholder="Ask me anything…" aria-label="Your question"></textarea>
      <button class="iconbtn send" data-act="ask-send" aria-label="Send">➤</button></div>
    <p class="tiny muted ask-hint">Tip: tap the 🎤 on your keyboard to talk instead of typing.</p>`;
  drawChat();
  const box = $('#askbox');
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = Math.min(140, box.scrollHeight) + 'px'; });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAsk(); } });
  $('#photoin').addEventListener('change', onPhoto);
  aiRefresh().then(() => { drawBrain(); if (AI.status === 'cached') aiStart(state.settings.aiModel); });
  if (prefill) { box.value = prefill; if (autoSend) sendAsk(); }
}
function closeAssist() { const el = $('#ask'); if (el) el.hidden = true; if ($('#session').hidden) document.body.style.overflow = ''; Speak.stop(); }
async function sendAsk(textIn, photoText) {
  const box = $('#askbox'); const text = (textIn != null ? textIn : box.value).trim(); if (!text || AI.busy) return;
  if (textIn == null) { box.value = ''; box.style.height = 'auto'; }
  const full = photoText ? `${photoText}\n\n${text}` : text;
  chat.push({ role: 'user', text: photoText ? `${text}\n\n“${photoText.slice(0, 300)}${photoText.length > 300 ? '…' : ''}”` : text, photo: !!photoText });
  // follow-ups like "explain it more simply" should use the earlier question too
  const lastQ = [...chat].reverse().find((m, j) => m.role === 'user' && j > 0);
  // short follow-ups ("give me an example", "I don't get it") build on the previous question
  const isFollow = !photoText && lastQ && text.length < 45 && /^(explain it more simply|give me an example|test me on this|what do you mean|i (still )?don.?t (get|understand)|again|why\??$|how\??$|explain (that|it)|tell me more|more)/i.test(text);
  const context = isFollow ? (lastQ.text + ' ' + text) : full;
  const sol = Solver.solve(photoText ? photoText + ' ' + text : (isFollow ? lastQ.text : text));
  let notes = searchNotes(context, 4);
  if (sol) notes = notes.filter((n) => n.s.id === (sol.subj || 'maths')); // keep only notes from the same subject as the worked answer
  const def = !sol && !isFollow ? findDef(text) : null;
  if (def) chat.push({ role: 'def', def });
  if (sol && !isFollow) chat.push({ role: 'sol', sol });
  const lessons = [...new Set(notes.map((n) => n.l.id))].slice(0, 2);
  if (!lessons.length && sol) { const m = LESSON_BY_SOLVE(sol.title); if (m) lessons.push(m); }
  saveChat(); drawChat();
  // if the brain is still waking up, wait for it rather than giving a weaker answer
  if (AI.starting) { const w = { role: 'ai', text: '🧠 Just waking my brain up…', typing: true }; chat.push(w); drawChat(); try { await AI.starting; } catch (e) { /* handled below */ } chat.splice(chat.indexOf(w), 1); }
  if (AI.status !== 'ready') { chat.push(fallbackAnswer(text, notes, sol, lessons, def)); saveChat(); drawChat(); return; }
  const m = { role: 'ai', text: '', typing: true, ai: true, lessons, notes: notes.slice(0, 3).map((n) => ({ head: n.head, text: n.text })) }; chat.push(m); AI.busy = true; drawChat();
  const gen = async () => {
    const stream = await AI.engine.chat.completions.create({ messages: buildMessages(full, notes, sol, def), stream: true, temperature: 0.3, top_p: 0.9, repetition_penalty: 1.05, max_tokens: 320, ...(AI_MODELS[state.settings.aiModel].qwen3 ? { extra_body: { enable_thinking: false } } : {}) });
    let raw = '', last = 0;
    for await (const ch of stream) {
      raw += (ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content) || '';
      m.text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
      // small models sometimes get stuck in a loop: stop as soon as a line repeats
      const lines = m.text.split('\n').map((x) => x.trim().replace(/^[-*•\d.)\s]+/, '')).filter((x) => x.length > 12);
      if (lines.length !== new Set(lines).size) { try { AI.engine.interruptGenerate(); } catch (e) { /* ignore */ } break; }
      if (performance.now() - last > 80) { last = performance.now(); drawChat(); }
    }
  };
  try {
    try { await gen(); }
    catch (e1) { m.text = '🧠 My brain nodded off — waking it up again…'; drawChat(); if (!(await aiRecover())) throw e1; m.text = ''; await gen(); }
    const seen = new Set(); m.text = m.text.split('\n').filter((x) => { const k = x.trim().replace(/^[-*•\d.)\s]+/, ''); if (k.length > 12 && seen.has(k)) return false; seen.add(k); return true; }).join('\n').trim();
    if (!m.text) m.text = 'Hmm, I got a bit stuck. Could you ask that a different way?';
  } catch (err) { AI.errDetail = diag(err); m.text = 'Sorry — my brain hiccuped. ' + (sol || notes.length ? 'The notes above are still correct though!' : 'Try asking again.'); m.ai = false; }
  m.typing = false; AI.busy = false; saveChat(); drawChat();
}
function LESSON_BY_SOLVE(title) {
  const t = title.toLowerCase(), map = [[/%|percent/, 'm-percent'], [/increase|decrease/, 'm-pchange'], [/ratio|share/, 'm-share'], [/solve/, 'm-eq'], [/mean|median|mode|range/, 'm-avg'], [/angle/, 'm-angles'], [/pythag/, 'm-pythag'], [/circle/, 'm-circles'], [/sequence/, 'm-seq'], [/prime|factor|hcf|lcm/, 'm-factors'], [/round/, 'm-round'], [/\//, 'm-fracof'], [/area|rectangle|triangle|trapezium/, 'm-area'], [/volume/, 'm-volume'], [/→/, 'm-units'], [/substitut/, 'm-subst']];
  for (const [re, id] of map) if (re.test(t)) return id; return null;
}
function fallbackAnswer(text, notes, sol, lessons, def) {
  if (def) return { role: 'ai', text: 'That is the definition from your course ☝️. Want to practise it? Tap below.', lessons };
  if (sol && !notes.length) return { role: 'ai', text: 'That\'s the method above ☝️ — go through it one step at a time. Want to practise? Tap the lesson below.', lessons };
  if (notes.length) {
    const lines = notes.slice(0, 3).map((n) => {
      if (!n.q) return `- **${n.head}:** ${n.text}`;
      const q = n.q, ans = q.t === 'tf' ? (q.a ? 'True' : 'False') : q.t === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join('; ') : q.t === 'order' ? q.items.join(' → ') : q.a;
      return `- **${n.head}:** ${q.q} → **${ans}**${q.why ? '. ' + q.why : ''}`;
    });
    return { role: 'ai', text: (sol ? 'The method is above ☝️. ' : '') + 'Here\'s what your lessons say:\n' + lines.join('\n'), lessons };
  }
  return { role: 'ai', text: AI.status === 'nogpu' ? 'I couldn\'t find that in your lessons. Try using different words — for example the name of the topic ("percentages", "metaphor", "care values").' : 'I couldn\'t find that in your lessons. Try different words — or switch on my offline brain (at the bottom) so I can explain anything.' };
}
/* clicks for the assistant */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'ask') { e.preventDefault(); openAssist(); }
  else if (act === 'ask-close') closeAssist();
  else if (act === 'ask-send') sendAsk();
  else if (act === 'ask-chip') sendAsk(b.dataset.q);
  else if (act === 'crop-cancel') closeCrop();
  else if (act === 'crop-rotate') { CROP.base = rotateCanvas(CROP.base); CROP.rect = { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }; drawCrop(); }
  else if (act === 'crop-all') readCropped(true);
  else if (act === 'crop-read') readCropped(false);
  else if (act === 'ask-clear') { chat = []; saveChat(); drawChat(); }
  else if (act === 'ocr-ask') { const t = $('#ocr' + b.dataset.i).value.trim(); chat.splice(+b.dataset.i, 1); sendAsk(b.dataset.q, t); }
  else if (act === 'say-msg') { const m = chat[+b.dataset.i]; Speak.say(m.role === 'sol' ? m.sol.steps.join('. ') + '. Answer: ' + m.sol.answer : m.text); }
  else if (act === 'brain') { if (AI.status === 'cached') aiStart(state.settings.aiModel); else if (AI.status === 'off') { AI.open = true; drawBrain(); } else { const c = $('#braincard'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } }
  else if (act === 'ai-start') { AI.open = false; if (AI.status === 'error') AI.status = 'off'; aiStart(b.dataset.id); }
  else if (act === 'ai-switch') { (async () => { const old = state.settings.aiModel; try { const lib = await aiLib(); await lib.deleteModelAllInfoInCache(modelId(old)); } catch (x) { /* ignore */ } AI.status = 'off'; aiStart(b.dataset.id); })(); }
  else if (act === 'copy-diag') { (navigator.clipboard ? navigator.clipboard.writeText(AI.errDetail) : Promise.reject()).then(() => toast('Copied — paste it in a message to Max')).catch(() => toast('Press and hold the text to copy it')); }
  else if (act === 'brain-open') { AI.open = true; drawBrain(); }
  else if (act === 'brain-close') { AI.open = false; AI.err = ''; drawBrain(); }
  else if (act === 'ai-delete') { if (confirm('Delete the offline brain from this device? You can download it again later.')) aiDelete(); }
  else if (act === 'lesson-from-ask') { closeAssist(); if (!$('#session').hidden) return; lessonSheet(LESSON[b.dataset.id]); }
  else if (act === 'ask-about') {
    const q = sess && sess.qs[sess.i]; if (!q) return;
    const ans = q.t === 'tf' ? (q.a ? 'True' : 'False') : q.t === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join(', ') : q.t === 'order' ? q.items.join(', then ') : (q.pre || '') + q.a + (q.unit ? ' ' + q.unit : '');
    openAssist(`I got this wrong and I don't get it:\n${q.ex ? '"' + q.ex + '"\n' : ''}${q.q}\nThe answer is: ${ans}. Can you explain why?`, true);
  }
});

/* ---------- go ---------- */
applyLook();
route();
